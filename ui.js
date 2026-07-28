// ================= UI: УВЕДОМЛЕНИЯ, МОДАЛКИ, НАВИГАЦИЯ =================

function toast(msg, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(function(){ el.remove(); }, 2500);
}

function openVkProfile() {
    if(currentVkUser) window.open('https://vk.com/id' + currentVkUser.id, '_blank');
}

function showInputModal(title, placeholder, defaultValue, callback) {
    var modal = document.getElementById('input-modal');
    if(!modal) { callback(null); return; }
    document.getElementById('input-modal-title').textContent = title;
    var input = document.getElementById('input-modal-input');
    input.value = defaultValue || '';
    input.placeholder = placeholder || '';
    input.style.display = 'block';
    modal.style.display = 'flex';
    document.getElementById('input-modal-ok').style.display = 'block';
    document.getElementById('input-modal-ok').onclick = function() {
        modal.style.display = 'none';
        var oldList = document.getElementById('groups-list');
        if(oldList) oldList.remove();
        callback(input.value.trim());
    };
    document.getElementById('input-modal-cancel').onclick = function() {
        modal.style.display = 'none';
        var oldList = document.getElementById('groups-list');
        if(oldList) oldList.remove();
        callback(null);
    };
}

function goTo(screen) {
    document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
    document.getElementById('screen-' + screen).classList.add('active');
    updateNavButtons(screen);
    if(screen === 'top') switchTopSubtab(topSubtab);
    if(screen === 'market') loadMarketScreen();
    if(screen === 'my-company') loadMyCompanyScreen();
}

function updateNavButtons(screen) {
    var bar = document.getElementById('nav-bar');
    bar.innerHTML = '';
    if(screen === 'profile') {
        addNavBtn('top', '🏆 Топ'); addNavBtn('market', '💼 Биржа'); addNavBtn('my-company', '🏢 Компания');
    } else if(screen === 'top') {
        addNavBtn('profile', '🏠 Профиль'); addNavBtn('market', '💼 Биржа'); addNavBtn('my-company', '🏢 Компания');
    } else if(screen === 'market') {
        addNavBtn('profile', '🏠 Профиль'); addNavBtn('top', '🏆 Топ'); addNavBtn('my-company', '🏢 Компания');
    } else if(screen === 'my-company') {
        addNavBtn('profile', '🏠 Профиль'); addNavBtn('top', '🏆 Топ'); addNavBtn('market', '💼 Биржа');
    }
}

function addNavBtn(screen, label) {
    var bar = document.getElementById('nav-bar');
    var btn = document.createElement('div');
    btn.className = 'nav-btn';
    btn.textContent = label;
    btn.onclick = function(){ goTo(screen); };
    bar.appendChild(btn);
}

// Карточка сотрудника
function renderEmployeeCard(emp, container, showActions, showCompany) {
    var lvl = emp.level || 1;
    var jobTitle = getJobTitle(lvl);
    var income = lvl;
    var cost = emp.hire_cost || 100;
    var sellPrice = Math.floor(cost * 0.8);
    var balance = emp.experience || 0;
    var upgradeCost = (emp.level || 1) * 50;
    
    var div = document.createElement('div');
    div.className = 'player-item';
    
    var html = '<img src="' + (emp.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="openPlayerModalById(' + emp.vk_id + ')" style="cursor:pointer;">';
    html += '<div class="info" onclick="openPlayerModalById(' + emp.vk_id + ')" style="cursor:pointer;">';
    html += '<div class="name">' + emp.first_name + ' ' + emp.last_name + '</div>';
    html += '<div class="detail">' + jobTitle + ' (ур.' + lvl + ')</div>';
    html += '<div class="detail" style="color:#4caf50;">📈 Доход: +' + income + ' оп/час</div>';
    html += '<div class="detail" style="color:#ffd700;">⭐ Баланс: ' + balance + ' опыта</div>';
    html += '<div class="detail">💰 Цена: ' + cost + ' опыта</div>';
    
    if(showCompany && emp.company) {
        html += '<div class="detail" style="color:#ff9800;cursor:pointer;" onclick="event.stopPropagation();openCompanyModal(\'' + emp.company + '\')">🏢 ' + emp.company + '</div>';
    }
    
    html += '</div>';
    
    if(showActions) {
        html += '<div class="btn-group">';
        html += '<button class="btn-upgrade" onclick="event.stopPropagation();upgradeEmployee(' + emp.vk_id + ')">⬆ ' + upgradeCost + '</button>';
        html += '<button class="btn-fire" onclick="event.stopPropagation();fireEmployee(' + emp.vk_id + ')">🔥 +' + sellPrice + '</button>';
        html += '</div>';
    }
    
    div.innerHTML = html;
    container.appendChild(div);
    
    return div;
}

// Модалка игрока
function renderPlayerModalContent(player) {
    var lvl = player.level || 1;
    var jobTitle = getJobTitle(lvl);
    var income = lvl;
    var cost = player.hire_cost || 100;
    var sellPrice = Math.floor(cost * 0.8);
    var balance = player.experience || 0;
    
    document.getElementById('modal-player-header').innerHTML = 
        '<img src="' + (player.photo_200 || 'https://vk.com/images/camera_200.png') + '" style="width:50px;height:50px;border-radius:50%;vertical-align:middle;margin-right:10px;cursor:pointer;" onclick="window.open(\'https://vk.com/id' + player.vk_id + '\',\'_blank\')">' +
        '<span style="font-size:18px;font-weight:700;">' + player.first_name + ' ' + player.last_name + '</span>';
    
    var infoHtml = '<div style="margin:10px 0;">';
    infoHtml += '<div><b>' + jobTitle + '</b> (ур.' + lvl + ')</div>';
    infoHtml += '<div style="color:#4caf50;">📈 Доход: +' + income + ' оп/час</div>';
    infoHtml += '<div style="color:#ffd700;">⭐ Баланс: ' + balance + ' опыта</div>';
    infoHtml += '<div>💰 Цена: ' + cost + ' опыта</div>';
    
    if(player.company) {
        infoHtml += '<div style="color:#ff9800;cursor:pointer;" onclick="openCompanyModal(\'' + player.company + '\')">🏢 Компания: ' + player.company + '</div>';
    }
    
    if(player.owner_id && player.owner_id !== player.vk_id) {
        infoHtml += '<div id="modal-owner-info">🔒 Загрузка...</div>';
    }
    
    infoHtml += '</div>';
    
    document.getElementById('modal-player-stats').innerHTML = infoHtml;
    
    var hireBtn = document.getElementById('modal-hire-btn');
    var fireBtn = document.getElementById('modal-fire-btn');
    hireBtn.style.display = 'none';
    fireBtn.style.display = 'none';
    
    var isMyOwner = currentUser.owner_id && currentUser.owner_id === player.vk_id;
    var isMyEmployee = player.owner_id === currentUser.vk_id;
    var isMe = player.vk_id === currentUser.vk_id;
    
    if(!isMe && !isMyOwner) {
        if(!player.owner_id || player.status === 'Биржа труда') {
            hireBtn.style.display = 'block';
            hireBtn.textContent = '💼 Нанять за ' + cost + ' опыта';
            hireBtn.onclick = function() { hirePlayer(player); };
        }
    }
    
    if(isMyEmployee) {
        fireBtn.style.display = 'block';
        fireBtn.textContent = '🔥 Уволить (+' + sellPrice + ' опыта)';
        fireBtn.onclick = function() { firePlayer(player); };
    }
    
    if(player.owner_id && player.owner_id !== player.vk_id) {
        supabase.from('players').select('first_name,last_name,vk_id').eq('vk_id', player.owner_id).maybeSingle().then(function(r) {
            if(r.data) {
                document.getElementById('modal-owner-info').innerHTML = '🔒 Работает на: <b style="cursor:pointer;text-decoration:underline;color:#ff9800;" onclick="openPlayerModalById(' + r.data.vk_id + ')">' + r.data.first_name + ' ' + r.data.last_name + '</b>';
            }
        });
    }
    
    supabase.from('players').select('*').eq('owner_id', player.vk_id).order('level', { ascending: false }).then(function(r) {
        var list = document.getElementById('modal-player-employees');
        list.innerHTML = '';
        if(!r.data || !r.data.length) {
            list.innerHTML = '<p style="color:#aaa;text-align:center;">Нет сотрудников</p>';
            return;
        }
        list.innerHTML = '<div class="section-title" style="margin-top:10px;">👥 Сотрудники (' + r.data.length + ')</div>';
        r.data.forEach(function(emp) {
            var card = renderEmployeeCard(emp, list, false, true);
            if(emp.owner_id !== currentUser.vk_id && emp.vk_id !== currentUser.vk_id) {
                var stealCost = Math.floor((emp.hire_cost || 100) * 1.5);
                var btn = document.createElement('button');
                btn.className = 'btn-steal';
                btn.textContent = '💰 ' + stealCost;
                btn.onclick = function(e) {
                    e.stopPropagation();
                    stealEmployee(emp, stealCost);
                };
                card.appendChild(btn);
            }
        });
    });
}

function renderTasks() {
    var listEl = document.getElementById('tasks-list');
    if(!listEl) return;
    var html = '';
    
    // ЗАДАНИЕ: ПОСМОТРЕТЬ РЕКЛАМУ
    var remaining = getRemainingAds ? getRemainingAds() : 0;
    var adText = '🎬 Посмотреть рекламу (+' + REWARDED_AD_BONUS + ' опыта)';
    if(remaining <= 0) {
        adText += ' ❌ (лимит)';
    } else {
        adText += ' (осталось ' + remaining + ' раз)';
    }
    
    html += '<div class="task-item"><div class="task-info"><b>' + adText + '</b><br><span style="font-size:11px;color:#aaa;">Максимум ' + REWARDED_AD_LIMIT + ' раз в день • 1 мин кулдаун</span></div>';
    if(remaining > 0) {
        html += '<button class="btn-task" onclick="doRewardedAd()" style="background:linear-gradient(135deg,#ff9800,#f57c00);color:#fff;">▶ Смотреть</button>';
    } else {
        html += '<span style="color:#f44336;">❌ Лимит</span>';
    }
    html += '</div>';
    
    // ЗАДАНИЕ: ПОДПИСКА
    if(!currentUser || !currentUser.task_group_done) {
        html += '<div class="task-item"><div class="task-info"><b>📱 Подписаться на группу</b><br><span style="font-size:11px;color:#aaa;">Награда: 1000 опыта</span></div>';
        html += '<div style="display:flex;gap:4px;"><button class="btn-task" onclick="doGroupTask()">▶ Выполнить</button><button class="btn-task-check" onclick="checkGroupTask()">🔍 Проверить</button></div>';
        html += '</div>';
    }
    
    // ЗАДАНИЕ: УВЕДОМЛЕНИЯ
    if(!currentUser || !currentUser.task_notify_done) {
        html += '<div class="task-item"><div class="task-info"><b>🔔 Подключить уведомления</b><br><span style="font-size:11px;color:#aaa;">Награда: 1000 опыта</span></div>';
        html += '<div style="display:flex;gap:4px;"><button class="btn-task" onclick="doNotifyTask()">▶ Выполнить</button><button class="btn-task-check" onclick="checkNotifyTask()">🔍 Проверить</button></div>';
        html += '</div>';
    }
    
    // ЗАДАНИЕ: ПРОМОКОД
    html += '<div class="task-item"><div class="task-info"><b>🎁 Ввести промокод</b><br><span style="font-size:11px;color:#aaa;">Награда: 1000 опыта</span></div>';
    html += '<button class="btn-task" onclick="doPromoTask()">▶ Выполнить</button>';
    html += '</div>';
    
    if(html === '') html = '<p style="color:#4caf50;text-align:center;">✅ Все задания выполнены!</p>';
    listEl.innerHTML = html;
}

function renderAll() {
    updateNavButtons('profile');
    document.getElementById('header-avatar').src = currentUser.photo_200 || (currentVkUser ? currentVkUser.photo_200 : '') || 'https://vk.com/images/camera_200.png';
    document.getElementById('player-name').textContent = currentUser.first_name + ' ' + currentUser.last_name;
    document.getElementById('exp-value').textContent = currentUser.experience || 0;
    
    var compEl = document.getElementById('company-display');
    if(currentUser.company) {
        compEl.innerHTML = '🏢 <span style="cursor:pointer;" onclick="goTo(\'my-company\')">' + currentUser.company + '</span>';
        if(currentUser.company_group_id) compEl.innerHTML += ' <a href="https://vk.com/club' + currentUser.company_group_id + '" target="_blank" style="color:#4a76a8;font-size:10px;">📱</a>';
    } else { compEl.textContent = ''; }
    
    document.getElementById('collect-panel').style.display = myTeamTotal ? 'flex' : 'none';
    if(myTeamTotal) {
        document.getElementById('collect-amount').textContent = currentUser.pending_experience || 0;
        document.getElementById('collect-btn').onclick = collectExperience;
    }
    document.getElementById('invite-friend-btn').onclick = inviteFriend;
    renderTasks();
    loadMyTeam(true);
}

function loadMyTeam(reset) {
    if(reset) { myTeamOffset = 0; document.getElementById('my-team-list').innerHTML = ''; }
    var list = document.getElementById('my-team-list');
    if(!myTeam.length) {
        list.innerHTML = '<p style="color:#aaa;text-align:center;">Нет сотрудников</p>';
        document.getElementById('load-more-btn').style.display = 'none';
        return;
    }
    var page = myTeam.slice(myTeamOffset, myTeamOffset + TEAM_PAGE_SIZE);
    page.forEach(function(emp) { renderEmployeeCard(emp, list, true, true); });
    myTeamOffset += page.length;
    document.getElementById('load-more-btn').style.display = (myTeamOffset < myTeamTotal) ? 'block' : 'none';
}
