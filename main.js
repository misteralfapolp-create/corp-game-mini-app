// ================= ЗАПУСК ПРИЛОЖЕНИЯ =================

var appInitialized = false;

async function initApp() {
    if (appInitialized) {
        console.log('Приложение уже инициализировано');
        return;
    }
    appInitialized = true;
    
    try {
        console.log('🚀 APP STARTED');
        console.log('1. Проверка VK Bridge:', typeof vkBridge !== 'undefined' ? 'OK ✅' : 'NOT LOADED ❌');
        console.log('2. Проверка Supabase:', typeof supabase !== 'undefined' ? 'OK ✅' : 'NOT LOADED ❌');
        
        document.getElementById('player-name').textContent = 'Загрузка...';
        
        console.log('3. Получаем данные пользователя VK...');
        currentVkUser = await vkBridge.send('VKWebAppGetUserInfo');
        console.log('4. Пользователь VK загружен:', currentVkUser.id, currentVkUser.first_name);
        
        var invitedBy = getRefFromHash() || new URLSearchParams(window.location.search).get('ref');
        if (invitedBy && parseInt(invitedBy) === currentVkUser.id) invitedBy = null;
        console.log('5. Реферал:', invitedBy || 'нет');
        
        console.log('6. Запрос к Supabase...');
        var r = await supabase.from('players').select('*').eq('vk_id', currentVkUser.id).maybeSingle();
        console.log('7. Результат Supabase:', r);
        
        if (r.error) {
            console.error('❌ Ошибка БД:', r.error);
            document.getElementById('player-name').textContent = 'Ошибка БД: ' + r.error.message;
            return;
        }
        
        if (!r.data) {
            console.log('8. Создаём нового пользователя...');
            var ownerId = null;
            if (invitedBy) { 
                ownerId = parseInt(invitedBy); 
            } else if (currentVkUser.id !== MY_VK_ID) { 
                ownerId = MY_VK_ID; 
            }
            console.log('9. ownerId:', ownerId);
            
            var insertResult = await supabase.from('players').insert([{
                vk_id: currentVkUser.id,
                first_name: currentVkUser.first_name,
                last_name: currentVkUser.last_name,
                photo_200: currentVkUser.photo_200 || '',
                status: ownerId ? 'Работает' : 'Биржа труда',
                company: null,
                role: ownerId ? 'Учёный' : null,
                experience: 0,
                income_per_hour: 0,
                invited_by: invitedBy ? parseInt(invitedBy) : null,
                last_collect: new Date().toISOString(),
                pending_experience: 0,
                level: 1,
                hire_cost: 100,
                total_company_exp: 0,
                owner_id: ownerId,
                company_group_id: null,
                max_pending: 0,
                task_group_done: false,
                task_promo_done: false,
                company_photo: null
            }]);
            
            if (insertResult.error) {
                console.error('❌ Ошибка создания:', insertResult.error);
                document.getElementById('player-name').textContent = 'Ошибка создания: ' + insertResult.error.message;
                return;
            }
            
            console.log('10. Пользователь создан!');
            
            if (invitedBy) { 
                console.log('11. Начисляем бонус рефералу:', invitedBy);
                await giveReferralBonus(parseInt(invitedBy)); 
            } else if (ownerId === MY_VK_ID) { 
                console.log('12. Начисляем бонус владельцу:', MY_VK_ID);
                await giveReferralBonus(MY_VK_ID); 
            }
            
            location.reload();
            return;
        }
        
        currentUser = r.data;
        console.log('13. Пользователь загружен:', currentUser.first_name, currentUser.last_name, 'ID:', currentUser.vk_id);
        
        // Проверяем и добавляем недостающие поля
        if (currentUser.level === undefined) {
            await supabase.from('players').update({level: 1}).eq('vk_id', currentUser.vk_id);
            currentUser.level = 1;
        }
        if (currentUser.owner_id === undefined) {
            await supabase.from('players').update({
                owner_id: null, 
                last_collect: new Date().toISOString(), 
                pending_experience: 0
            }).eq('vk_id', currentUser.vk_id);
            currentUser.owner_id = null;
        }
        if (currentUser.company_group_id === undefined) {
            await supabase.from('players').update({company_group_id: null}).eq('vk_id', currentUser.vk_id);
            currentUser.company_group_id = null;
        }
        if (currentUser.task_group_done === undefined) {
            await supabase.from('players').update({
                task_group_done: false, 
                task_promo_done: false, 
                max_pending: 0
            }).eq('vk_id', currentUser.vk_id);
            currentUser.task_group_done = false;
            currentUser.task_promo_done = false;
            currentUser.max_pending = 0;
        }
        if (currentUser.task_notify_done === undefined) {
            await supabase.from('players').update({ task_notify_done: false }).eq('vk_id', currentUser.vk_id);
            currentUser.task_notify_done = false;
        }
        
        // Обработка реферала
        if (invitedBy && parseInt(invitedBy) !== currentUser.vk_id && !currentUser.owner_id) {
            console.log('14. Обработка реферала для существующего пользователя:', invitedBy);
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
                console.log('15. Реферал обработан');
            }
        }
        
        console.log('16. Обновляем статистику...');
        await updateAllStats();
        
        console.log('17. Рендерим UI...');
        renderAll();
        
        console.log('18. ✅ ВСЕ ГОТОВО!');
        
    } catch (e) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', e);
        console.error('Сообщение:', e.message);
        console.error('Стек:', e.stack);
        document.getElementById('player-name').textContent = 'Ошибка: ' + (e.message || 'неизвестная');
        alert('❌ Ошибка при загрузке: ' + e.message + '\n\nОткрой консоль браузера (F12) для деталей.');
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
