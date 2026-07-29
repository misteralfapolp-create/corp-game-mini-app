// ================= ЗАПУСК ПРИЛОЖЕНИЯ =================

async function initApp() {
    try {
        console.log('🚀 APP STARTED');
        
        document.getElementById('player-name').textContent = 'Загрузка...';
        
        // 1. Получаем пользователя VK
        currentVkUser = await vkBridge.send('VKWebAppGetUserInfo');
        console.log('✅ Пользователь VK:', currentVkUser.id);
        
        var invitedBy = getRefFromHash() || new URLSearchParams(window.location.search).get('ref');
        if (invitedBy && parseInt(invitedBy) === currentVkUser.id) invitedBy = null;
        
        // 2. Загружаем данные пользователя из Supabase
        var r = await supabase.from('players').select('*').eq('vk_id', currentVkUser.id).maybeSingle();
        
        if (r.error) {
            console.error('❌ Ошибка БД:', r.error);
            document.getElementById('player-name').textContent = 'Ошибка БД';
            return;
        }
        
        // 3. Если пользователь не найден — создаём
        if (!r.data) {
            var ownerId = null;
            if (invitedBy) { 
                ownerId = parseInt(invitedBy); 
            } else if (currentVkUser.id !== MY_VK_ID) { 
                ownerId = MY_VK_ID; 
            }
            
            var insertResult = await supabase.from('players').insert([{
                vk_id: currentVkUser.id,
                first_name: currentVkUser.first_name,
                last_name: currentVkUser.last_name,
                photo_200: currentVkUser.photo_200 || '',
                status: ownerId ? 'Работает' : 'Биржа труда',
                company: null,
                role: ownerId ? 'Учёный' : null,
                experience: 0,
                invited_by: invitedBy ? parseInt(invitedBy) : null,
                last_collect: new Date().toISOString(),
                pending_experience: 0,
                level: 1,
                hire_cost: 100,
                owner_id: ownerId,
                company_group_id: null,
                task_group_done: false,
                task_promo_done: false,
                task_notify_done: false,
                max_pending: 0
            }]);
            
            if (insertResult.error) {
                console.error('❌ Ошибка создания:', insertResult.error);
                document.getElementById('player-name').textContent = 'Ошибка создания';
                return;
            }
            
            if (invitedBy) { 
                await giveReferralBonus(parseInt(invitedBy)); 
            } else if (ownerId === MY_VK_ID) { 
                await giveReferralBonus(MY_VK_ID); 
            }
            
            location.reload();
            return;
        }
        
        currentUser = r.data;
        console.log('✅ Пользователь загружен:', currentUser.first_name);
        
        // 4. ОПТИМИЗАЦИЯ: все обновления полей одним запросом
        var updates = {};
        var needUpdate = false;
        
        if (currentUser.level === undefined) { updates.level = 1; needUpdate = true; }
        if (currentUser.owner_id === undefined) { 
            updates.owner_id = null; 
            updates.last_collect = new Date().toISOString(); 
            updates.pending_experience = 0;
            needUpdate = true; 
        }
        if (currentUser.company_group_id === undefined) { updates.company_group_id = null; needUpdate = true; }
        if (currentUser.task_group_done === undefined) { 
            updates.task_group_done = false; 
            updates.task_promo_done = false; 
            updates.max_pending = 0;
            needUpdate = true; 
        }
        if (currentUser.task_notify_done === undefined) { updates.task_notify_done = false; needUpdate = true; }
        
        if (needUpdate) {
            await supabase.from('players').update(updates).eq('vk_id', currentUser.vk_id);
            Object.assign(currentUser, updates);
        }
        
        // 5. Обработка реферала
        if (invitedBy && parseInt(invitedBy) !== currentUser.vk_id && !currentUser.owner_id) {
            var inv2 = await supabase.from('players').select('vk_id').eq('vk_id', parseInt(invitedBy)).maybeSingle();
            if (inv2.data) {
                await supabase.from('players').update({
                    owner_id: parseInt(invitedBy), 
                    status: 'Работает', 
                    role: 'Учёный'
                }).eq('vk_id', currentUser.vk_id);
                await giveReferralBonus(parseInt(invitedBy));
                currentUser.owner_id = parseInt(invitedBy);
                currentUser.status = 'Работает';
                currentUser.role = 'Учёный';
            }
        }
        
        // 6. ОПТИМИЗАЦИЯ: запускаем параллельно
        await Promise.all([
            updateAllStats(),
            loadMyTeam(true)
        ]);
        
        // 7. Рендерим UI
        renderAll();
        updateNavButtons('profile');
        
        console.log('✅ ВСЕ ГОТОВО!');
        
    } catch (e) {
        console.error('❌ ОШИБКА:', e);
        document.getElementById('player-name').textContent = 'Ошибка: ' + (e.message || 'неизвестная');
    }
}

// ================= ЗАПУСК ПРИ ЗАГРУЗКЕ =================
window.addEventListener('load', function() {
    console.log('📄 Страница загружена');
    if (typeof vkBridge !== 'undefined') {
        console.log('🔄 Инициализация VK Bridge...');
        vkBridge.send('VKWebAppInit').then(function() {
            console.log('✅ VK Bridge инициализирован');
            return initApp();
        }).catch(function(err) {
            console.error('❌ Ошибка VK Bridge:', err);
            document.getElementById('player-name').textContent = 'Ошибка VK: ' + err.message;
        });
    } else {
        console.error('❌ VK Bridge не загружен');
        document.getElementById('player-name').textContent = 'VK Bridge не загружен';
    }
});

// ================= ОБРАБОТЧИКИ =================
document.addEventListener('DOMContentLoaded', function() {
    // Сабтабы
    var subtabPlayers = document.getElementById('subtab-players');
    var subtabCompanies = document.getElementById('subtab-companies');
    
    if (subtabPlayers) {
        subtabPlayers.addEventListener('click', function(){ 
            console.log('Переключение на игроков');
            switchTopSubtab('players'); 
        });
    }
    
    if (subtabCompanies) {
        subtabCompanies.addEventListener('click', function(){ 
            console.log('Переключение на компании');
            switchTopSubtab('companies'); 
        });
    }
    
    // Кнопка "Загрузить ещё"
    var loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', function(){ 
            console.log('Загрузка ещё сотрудников');
            loadMyTeam(false); 
        });
    }
    
    console.log('📋 Обработчики событий добавлены');
});
