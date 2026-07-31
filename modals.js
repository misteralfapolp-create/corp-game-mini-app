// ================= СОЗДАНИЕ КОМПАНИИ =================

async function createCompany() {
    try {
        // Проверяем APP_ID
        if (!APP_ID || APP_ID === '') {
            toast('Ошибка: APP_ID не задан в config.js', 'error');
            console.error('APP_ID не задан');
            return;
        }
        
        console.log('=== СОЗДАНИЕ КОМПАНИИ ===');
        console.log('APP_ID:', APP_ID);
        console.log('currentUser:', currentUser);
        
        // Проверяем, есть ли уже компания
        if (currentUser.company) {
            toast('У вас уже есть компания: ' + currentUser.company, 'info');
            return;
        }
        
        // Определяем окружение
        var isMobile = window.location.href.includes('vk.com') && 
                       (window.location.href.includes('mobile') || 
                        window.navigator.userAgent.includes('Mobile'));
        
        console.log('Окружение:', isMobile ? 'Мобильное приложение VK' : 'Браузер/Web');
        
        // Для браузера — показываем инструкцию с кнопкой
        if (!isMobile) {
            showBrowserAuthModal();
            return;
        }
        
        // Для мобильного приложения — стандартный поток
        console.log('1. Запрашиваем токен...');
        var tokenResult;
        try {
            tokenResult = await vkBridge.send('VKWebAppGetAuthToken', {
                app_id: String(APP_ID),
                scope: 'groups'
            });
            console.log('2. Токен получен:', tokenResult);
        } catch(tokenError) {
            console.error('Ошибка получения токена:', tokenError);
            toast('Ошибка доступа к группам. Попробуйте позже.', 'error');
            return;
        }
        
        if(!tokenResult || !tokenResult.access_token) {
            toast('Не удалось получить доступ к группам', 'error');
            return;
        }
        
        console.log('3. Запрашиваем группы...');
        var groupsResult;
        try {
            groupsResult = await vkBridge.send('VKWebAppCallAPIMethod', {
                method: 'groups.get',
                params: {
                    filter: 'admin',
                    extended: 1,
                    access_token: tokenResult.access_token,
                    v: '5.199'
                }
            });
            console.log('4. Группы получены:', groupsResult);
        } catch(apiError) {
            console.error('Ошибка VK API:', apiError);
            toast('Ошибка загрузки групп: ' + (apiError.message || 'неизвестная'), 'error');
            return;
        }
        
        // Проверяем ответ
        if (!groupsResult || !groupsResult.response) {
            console.error('Некорректный ответ:', groupsResult);
            toast('Ошибка: не удалось загрузить список групп', 'error');
            return;
        }
        
        var items = groupsResult.response.items || [];
        console.log('5. Найдено групп:', items.length);
        
        if (items.length === 0) {
            toast('У вас нет групп, где вы администратор', 'info');
            return;
        }
        
        // Показываем список групп
        showGroupsList(items);
        
    } catch(e) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА:', e);
        toast('Ошибка: ' + (e.message || 'неизвестная'), 'error');
    }
}

// ================= ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =================

// Показать модалку для браузера
function showBrowserAuthModal() {
    var modal = document.getElementById('input-modal');
    document.getElementById('input-modal-title').textContent = '⚠️ Доступ к группам';
    var input = document.getElementById('input-modal-input');
    input.style.display = 'none';
    document.getElementById('input-modal-ok').style.display = 'none';
    
    // Удаляем старые элементы
    var oldInfo = document.getElementById('groups-info');
    if (oldInfo) oldInfo.remove();
    var oldList = document.getElementById('groups-list');
    if (oldList) oldList.remove();
    
    var infoDiv = document.createElement('div');
    infoDiv.id = 'groups-info';
    infoDiv.style.cssText = 'padding:15px;margin:10px 0;background:rgba(255,152,0,0.1);border-radius:10px;text-align:center;';
    infoDiv.innerHTML = `
        <p style="color:#ff9800;font-size:15px;font-weight:600;">📱 Для создания компании нужно разрешить доступ к группам.</p>
        <p style="color:#aaa;font-size:13px;margin-top:8px;">Нажмите кнопку ниже, чтобы открыть окно разрешений ВКонтакте.</p>
        <button onclick="requestGroupsAccess()" style="margin-top:14px;padding:14px 28px;background:#4a76a8;color:#fff;border:none;border-radius:10px;font-size:16px;cursor:pointer;font-weight:700;box-shadow:0 2px 12px rgba(74,118,168,0.3);">
            🔓 Разрешить доступ
        </button>
        <button onclick="closeGroupsInfo()" style="margin-top:10px;padding:10px 24px;background:rgba(255,255,255,0.08);color:#aaa;border:none;border-radius:8px;font-size:14px;cursor:pointer;">
            Отмена
        </button>
        <p style="color:#666;font-size:11px;margin-top:12px;">После разрешения закройте окно и нажмите "Создать компанию" снова</p>
    `;
    
    var buttonsContainer = input.parentNode;
    buttonsContainer.insertBefore(infoDiv, document.getElementById('input-modal-ok').parentNode);
    
    modal.style.display = 'flex';
    
    document.getElementById('input-modal-cancel').onclick = function() {
        modal.style.display = 'none';
        var old = document.getElementById('groups-info');
        if (old) old.remove();
        input.style.display = 'block';
        document.getElementById('input-modal-ok').style.display = 'block';
    };
}

// Запрос доступа к группам (для браузера)
function requestGroupsAccess() {
    // Закрываем модалку
    var modal = document.getElementById('input-modal');
    modal.style.display = 'none';
    
    // Открываем окно авторизации VK
    var authUrl = 'https://oauth.vk.com/authorize?' +
        'client_id=' + APP_ID +
        '&display=page' +
        '&redirect_uri=https://oauth.vk.com/blank.html' +
        '&scope=groups' +
        '&response_type=token' +
        '&v=5.199';
    
    console.log('Открываем авторизацию:', authUrl);
    
    // Открываем в новом окне
    var win = window.open(authUrl, 'vk_auth', 'width=700,height=600,menubar=no,toolbar=no,location=no,status=no');
    
    if (!win || win.closed || typeof win.closed === 'undefined') {
        toast('⚠️ Разрешите всплывающие окна для ВКонтакте', 'error');
        return;
    }
    
    toast('📱 Разрешите доступ в открывшемся окне', 'info');
    
    // Проверяем, закрылось ли окно
    var checkInterval = setInterval(function() {
        try {
            if (win.closed) {
                clearInterval(checkInterval);
                // Проверяем, успешно ли разрешили
                toast('✅ Если вы разрешили доступ, попробуйте создать компанию снова', 'success');
            }
        } catch(e) {
            // Окно закрыто или ошибка доступа
            clearInterval(checkInterval);
        }
    }, 1500);
    
    // Таймаут на случай, если окно зависло
    setTimeout(function() {
        clearInterval(checkInterval);
    }, 60000);
}

// Закрыть информационное окно
function closeGroupsInfo() {
    var modal = document.getElementById('input-modal');
    modal.style.display = 'none';
    var old = document.getElementById('groups-info');
    if (old) old.remove();
    var input = document.getElementById('input-modal-input');
    input.style.display = 'block';
    document.getElementById('input-modal-ok').style.display = 'block';
}

// Показать список групп
function showGroupsList(items) {
    var modal = document.getElementById('input-modal');
    document.getElementById('input-modal-title').textContent = 'Выберите группу для компании';
    var input = document.getElementById('input-modal-input');
    input.style.display = 'none';
    
    var oldList = document.getElementById('groups-list');
    if (oldList) oldList.remove();
    var oldInfo = document.getElementById('groups-info');
    if (oldInfo) oldInfo.remove();
    
    var listContainer = document.createElement('div');
    listContainer.id = 'groups-list';
    listContainer.style.cssText = 'max-height:300px;overflow-y:auto;margin:10px 0;';
    
    items.forEach(function(g) {
        var item = document.createElement('div');
        item.style.cssText = 'padding:12px;margin:4px 0;background:rgba(255,255,255,0.08);border-radius:8px;cursor:pointer;font-size:14px;transition:0.2s;display:flex;align-items:center;gap:10px;';
        
        var avatar = g.photo_200 || g.photo_100 || 'https://vk.com/images/community_200.png';
        item.innerHTML = '<img src="' + avatar + '" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;" onerror="this.style.display=\'none\'">' +
            '<span>' + g.name + ' (' + (g.members_count || 0) + ' участ.)</span>';
        
        item.onmouseover = function() { this.style.background = 'rgba(74,118,168,0.4)'; };
        item.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.08)'; };
        item.onclick = function() {
            modal.style.display = 'none';
            var oldList2 = document.getElementById('groups-list');
            if(oldList2) oldList2.remove();
            input.style.display = 'block';
            document.getElementById('input-modal-ok').style.display = 'block';
            
            console.log('Выбрана группа:', g.name, 'ID:', g.id);
            
            supabase.from('players')
                .select('company')
                .eq('company', g.name)
                .limit(1)
                .then(function(existing) {
                    if(existing.data && existing.data.length > 0) {
                        toast('Компания с названием "' + g.name + '" уже существует', 'error');
                        return;
                    }
                    
                    supabase.from('players').update({
                        company: g.name,
                        company_group_id: g.id
                    }).eq('vk_id', currentUser.vk_id).then(function(updateResult) {
                        if (updateResult.error) {
                            console.error('Ошибка сохранения:', updateResult.error);
                            toast('Ошибка создания компании: ' + updateResult.error.message, 'error');
                            return;
                        }
                        
                        currentUser.company = g.name;
                        currentUser.company_group_id = g.id;
                        toast('✅ Компания «' + g.name + '» создана!', 'success');
                        
                        updateAllStats();
                        renderAll();
                        loadMyCompanyScreen();
                    });
                });
        };
        listContainer.appendChild(item);
    });
    
    var buttonsContainer = input.parentNode;
    buttonsContainer.insertBefore(listContainer, document.getElementById('input-modal-ok').parentNode);
    
    modal.style.display = 'flex';
    
    document.getElementById('input-modal-cancel').onclick = function() {
        modal.style.display = 'none';
        var oldList3 = document.getElementById('groups-list');
        if(oldList3) oldList3.remove();
        input.style.display = 'block';
        document.getElementById('input-modal-ok').style.display = 'block';
    };
    
    document.getElementById('input-modal-ok').style.display = 'none';
}

// ================= МОДАЛКА ИГРОКА =================
async function openPlayerModalById(vkId) {
    var r = await supabase.from('players').select('*').eq('vk_id', vkId).maybeSingle();
    if(r.data) {
        var modal = document.getElementById('player-modal');
        modal.style.display = 'flex';
        renderPlayerModalContent(r.data);
    }
}

function closePlayerModal() { 
    document.getElementById('player-modal').style.display = 'none'; 
}

// ================= МОДАЛКА КОМПАНИИ =================
async function openCompanyModal(name) {
    var r0 = await supabase.from('players').select('company,company_group_id').eq('company', name).limit(1);
    var groupId = (r0.data && r0.data.length > 0) ? r0.data[0].company_group_id : null;
    document.getElementById('company-modal').style.display = 'flex';
    
    var avatarHtml = groupId ? '<img src="https://vk.com/images/community_200.png?gid=' + groupId + '" style="width:40px;height:40px;border-radius:50%;vertical-align:middle;margin-right:10px;" onerror="this.style.display=\'none\'">' : '';
    document.getElementById('modal-company-name').innerHTML = avatarHtml + '🏢 ' + name;
    
    if(groupId) {
        document.getElementById('modal-company-name').innerHTML += ' <a href="https://vk.com/club' + groupId + '" target="_blank" style="color:#4a76a8;font-size:13px;">📱</a>';
    }
    
    var r = await supabase.from('players').select('*').eq('company', name);
    if(r.data) {
        document.getElementById('modal-company-stats').textContent = '👥 ' + r.data.length + ' сотрудников';
        var list = document.getElementById('modal-company-members');
        list.innerHTML = '';
        r.data.forEach(function(p) {
            var lvl = p.level || 1;
            var div = document.createElement('div');
            div.className = 'player-item';
            div.style.cursor = 'pointer';
            div.onclick = function(){ closeCompanyModal(); openPlayerModalById(p.vk_id); };
            div.innerHTML = '<img src="' + (p.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'">' +
                '<div class="info"><div class="name">' + p.first_name + ' ' + p.last_name + '</div>' +
                '<div class="detail">' + getJobTitle(lvl) + ' (ур.' + lvl + ')</div>' +
                '<div class="detail" style="color:#4caf50;">📈 +' + lvl + ' оп/час</div>' +
                '<div class="detail" style="color:#ffd700;">⭐ ' + (p.experience || 0) + ' опыта</div></div>';
            list.appendChild(div);
        });
        
        var jb = document.getElementById('modal-join-btn');
        var lb = document.getElementById('modal-leave-btn');
        jb.style.display = 'none';
        lb.style.display = 'none';
        
        if(currentUser.company === name) {
            lb.style.display = 'block';
            lb.textContent = '🚪 Выйти из компании (бесплатно)';
            lb.onclick = async function() {
                await supabase.from('players').update({ 
                    company: null, 
                    company_group_id: null,
                    status: 'Биржа труда'
                }).eq('vk_id', currentUser.vk_id);
                currentUser.company = null;
                currentUser.company_group_id = null;
                currentUser.status = 'Биржа труда';
                toast('Вышли из компании', 'info');
                closeCompanyModal();
                await updateAllStats();
                renderAll();
            };
        } else {
            jb.style.display = 'block';
            jb.onclick = async function() {
                if (currentUser.company) {
                    toast('Вы уже в компании: ' + currentUser.company, 'error');
                    return;
                }
                await supabase.from('players').update({ 
                    company: name,
                    status: 'Работает'
                }).eq('vk_id', currentUser.vk_id);
                currentUser.company = name;
                currentUser.status = 'Работает';
                toast('✅ Вступили!', 'success');
                closeCompanyModal();
                await updateAllStats();
                renderAll();
            };
        }
    }
}

function closeCompanyModal() { 
    document.getElementById('company-modal').style.display = 'none'; 
}

// ================= НАСТРОЙКИ =================
function openSettings() {
    document.getElementById('settings-modal').style.display = 'flex';
    document.getElementById('promo-input').value = '';
    document.getElementById('promo-go-btn').onclick = applyPromo;
}

function closeSettings() { 
    document.getElementById('settings-modal').style.display = 'none'; 
}

async function applyPromo() {
    var code = document.getElementById('promo-input').value.trim().toUpperCase();
    if(!code) { toast('Введите промокод!', 'error'); return; }
    
    var r = await supabase.from('promocodes').select('*').eq('code', code).maybeSingle();
    if(!r.data) { toast('Промокод не найден!', 'error'); return; }
    
    var promo = r.data;
    
    if(promo.expires_at && new Date(promo.expires_at) < new Date()) {
        toast('Промокод истек!', 'error');
        return;
    }
    
    if(promo.used_by && promo.used_by.includes(currentUser.vk_id)) { 
        toast('Вы уже использовали этот промокод!', 'error'); 
        return; 
    }
    if(promo.used_by && promo.used_by.length >= promo.max_uses) { 
        toast('Промокод уже использован максимальное количество раз!', 'error'); 
        return; 
    }
    
    var newExp = (currentUser.experience || 0) + promo.reward_exp;
    await supabase.from('players').update({ experience: newExp }).eq('vk_id', currentUser.vk_id);
    currentUser.experience = newExp;
    
    var usedBy = promo.used_by || [];
    usedBy.push(currentUser.vk_id);
    await supabase.from('promocodes').update({ used_by: usedBy }).eq('code', code);
    await supabase.from('players').update({ task_promo_done: true }).eq('vk_id', currentUser.vk_id);
    currentUser.task_promo_done = true;
    
    toast('🎁 +' + promo.reward_exp + ' опыта!', 'success');
    closeSettings();
    renderAll();
    renderTasks();
}

// ================= ПРИГЛАШЕНИЕ =================
function inviteFriend() {
    var refLink = 'https://vk.com/app' + APP_ID + '#ref_' + currentUser.vk_id;
    vkBridge.send('VKWebAppShare', { 
        link: refLink, 
        text: '🎮 Присоединяйся к Корпоративным Играм! Стань моим сотрудником!' 
    })
    .then(function(){ 
        toast('✅ Отправлено!', 'success'); 
    })
    .catch(function() {
        navigator.clipboard.writeText(refLink)
            .then(function(){ 
                toast('🔗 Ссылка скопирована!', 'info'); 
            })
            .catch(function(){ 
                toast('Не удалось отправить', 'error'); 
            });
    });
}

// ============================================================
// ❗ ВАЖНО: Регистрируем функции глобально для HTML
// ============================================================
window.createCompany = createCompany;
window.openPlayerModalById = openPlayerModalById;
window.closePlayerModal = closePlayerModal;
window.openCompanyModal = openCompanyModal;
window.closeCompanyModal = closeCompanyModal;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.applyPromo = applyPromo;
window.inviteFriend = inviteFriend;
window.requestGroupsAccess = requestGroupsAccess;
window.closeGroupsInfo = closeGroupsInfo;
window.showBrowserAuthModal = showBrowserAuthModal;
window.showGroupsList = showGroupsList;

console.log('✅ modals.js загружен');
