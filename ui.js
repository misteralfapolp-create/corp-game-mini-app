// ================= UI: УВЕДОМЛЕНИЯ, МОДАЛКИ, НАВИГАЦИЯ =================

// Toast-уведомление
function toast(msg, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(function(){ el.remove(); }, 2500);
}

// Открыть профиль ВК
function openVkProfile() {
    if(currentVkUser) window.open('https://vk.com/id' + currentVkUser.id, '_blank');
}

// Извлечь ref из хеша
function getRefFromHash() {
    var m = window.location.hash.match(/ref_(\d+)/);
    return m ? m[1] : null;
}

// Модалка ввода
function showInputModal(title, placeholder, defaultValue, callback) {
    var modal = document.getElementById('input-modal');
    if(!modal) { callback(null); return; }
    document.getElementById('input-modal-title').textContent = title;
    var input = document.getElementById('input-modal-input');
    input.value = defaultValue || '';
    input.placeholder = placeholder || '';
    modal.style.display = 'flex';
    document.getElementById('input-modal-ok').onclick = function() {
        modal.style.display = 'none';
        callback(input.value.trim());
    };
    document.getElementById('input-modal-cancel').onclick = function() {
        modal.style.display = 'none';
        callback(null);
    };
}

// Навигация
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

// Отображение сотрудника
function renderEmployeeItem(emp, container, isMine) {
    var cost = Math.floor(emp.hire_cost || 100);
    var upgradeCost = Math.floor(cost * 1.5);
    var fireIncome = Math.floor(cost * 0.8);
    var div = document.createElement('div');
    div.className = 'player-item';
    div.innerHTML = '<img src="' + (emp.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="openPlayerModalById(' + emp.vk_id + ')">' +
        '<div class="info" onclick="openPlayerModalById(' + emp.vk_id + ')"><div class="name">' + emp.first_name + ' ' + emp.last_name + '<span class="lvl">' + (emp.level || 1) + ' ур</span></div>' +
        '<div class="detail">🔬 +' + (emp.income_per_hour || 0) + ' оп/час • 💰' + cost + '</div></div>';
    if(isMine) {
        div.innerHTML += '<div class="btn-group"><button class="btn-upgrade">⬆ ' + upgradeCost + '</button><button class="btn-fire">🔥 +' + fireIncome + '</button></div>';
    }
    container.appendChild(div);
    if(isMine) {
        div.querySelector('.btn-upgrade').onclick = function(e){ e.stopPropagation(); upgradeEmployee(emp); };
        div.querySelector('.btn-fire').onclick = function(e){ e.stopPropagation(); fireEmployee(emp); };
    }
}

// Отрисовка заданий
function renderTasks() {
    var listEl = document.getElementById('tasks-list');
    if(!listEl) return;
    var html = '';
    html += '<div class="task-item"><div class="task-info"><b>📱 Подписаться на группу</b><br><span style="font-size:11px;color:#aaa;">Награда: 1000 опыта</span></div>';
    if(currentUser && currentUser.task_group_done) {
        html += '<span style="color:#4caf50;">✅ Выполнено</span>';
    } else {
        html += '<div style="display:flex;gap:4px;"><button class="btn-task" onclick="doGroupTask()">▶ Выполнить</button><button class="btn-task-check" onclick="checkGroupTask()">🔍 Проверить</button></div>';
    }
    html += '</div>';
    html += '<div class="task-item"><div class="task-info"><b>🎁 Ввести промокод</b><br><span style="font-size:11px;color:#aaa;">Награда: 1000 опыта</span></div>';
    html += '<button class="btn-task" onclick="doPromoTask()">▶ Выполнить</button>';
    html += '</div>';
    listEl.innerHTML = html;
}

// Отрисовка главного экрана
function renderAll() {
    document.getElementById('header-avatar').src = currentUser.photo_200 || (currentVkUser ? currentVkUser.photo_200 : '') || 'https://vk.com/images/camera_200.png';
    document.getElementById('player-name').textContent = currentUser.first_name + ' ' + currentUser.last_name;
    document.getElementById('exp-value').textContent = currentUser.experience || 0;
    
    var compEl = document.getElementById('company-display');
    if(currentUser.company) {
        var groupLink = currentUser.company_group_id ? ' <a href="https://vk.com/club' + currentUser.company_group_id + '" target="_blank" style="color:#4a76a8;font-size:10px;">📱</a>' : '';
        compEl.innerHTML = '🏢 <span style="cursor:pointer;" onclick="goTo(\'my-company\')">' + currentUser.company + '</span>' + groupLink;
    } else {
        compEl.textContent = '';
    }
    
    document.getElementById('collect-panel').style.display = myTeamTotal ? 'flex' : 'none';
    if(myTeamTotal) {
        document.getElementById('collect-amount').textContent = currentUser.pending_experience || 0;
        document.getElementById('collect-btn').onclick = collectExperience;
    }
    document.getElementById('invite-friend-btn').onclick = inviteFriend;
    renderTasks();
    loadMyTeam(true);
}
