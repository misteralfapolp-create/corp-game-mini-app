// ================= ИГРОВАЯ ЛОГИКА =================

// ================= БИРЖА =================
async function loadMarketScreen() {
    var c = document.getElementById('market-content');
    c.innerHTML = 'Загрузка...';
    var result = await supabase.from('players').select('*').eq('status', 'Биржа труда').neq('vk_id', currentUser.vk_id).order('level', { ascending: false }).limit(100);
    if(!result.data || !result.data.length) { c.innerHTML = '<p style="color:#aaa;text-align:center;">На бирже никого нет</p>'; return; }
    c.innerHTML = '<p style="font-size:11px;color:#aaa;margin-bottom:10px;">Найдено ' + result.data.length + ' безработных</p>';
    result.data.forEach(function(player) {
        renderEmployeeCard(player, c, false, true);
        var cost = (player.level || 1) * 50;
        var btn = document.createElement('button');
        btn.className = 'btn-hire-small';
        btn.textContent = '💼 ' + cost;
        btn.onclick = function(e) { e.stopPropagation(); hirePlayer(player); };
        c.lastChild.appendChild(btn);
    });
}

// ================= ЗАДАНИЯ =================
function toggleTasks() {
    var panel = document.getElementById('tasks-panel');
    if(panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        renderTasks();
        document.getElementById('earn-btn').textContent = '🔼 Скрыть';
    } else {
        panel.style.display = 'none';
        document.getElementById('earn-btn').textContent = '💰 Заработать';
    }
}

function doGroupTask() {
    window.open(GROUP_URL, '_blank');
    toast('📱 Откройте группу и подпишитесь', 'info');
}

async function checkGroupTask() {
    if(currentUser.task_group_done) { toast('Уже выполнено!', 'info'); return; }
    try {
        var result = await vkBridge.send('VKWebAppCallAPIMethod', { method: 'groups.isMember', params: { group_id: GROUP_ID, user_id: currentUser.vk_id, v: '5.199' } });
        if(result.response === 1) {
            await supabase.from('players').update({ experience: (currentUser.experience || 0) + 1000, task_group_done: true }).eq('vk_id', currentUser.vk_id);
            currentUser.experience += 1000;
            currentUser.task_group_done = true;
            toast('✅ +1000 опыта!', 'success');
            renderAll();
        } else { toast('Не подписаны', 'error'); }
    } catch(e) {
        await supabase.from('players').update({ experience: (currentUser.experience || 0) + 1000, task_group_done: true }).eq('vk_id', currentUser.vk_id);
        currentUser.experience += 1000;
        currentUser.task_group_done = true;
        toast('✅ +1000 опыта!', 'success');
        renderAll();
    }
}

// ================= УВЕДОМЛЕНИЯ =================

function doNotifyTask() {
    // Открываем ЛС группы — игрок пишет любое слово
    window.open('https://vk.com/write-' + GROUP_ID, '_blank');
    toast('📝 Напишите любое слово в сообщения группы, затем нажмите «Проверить»', 'info');
}

async function checkNotifyTask() {
    if(currentUser.task_notify_done) { toast('Уже выполнено!', 'info'); return; }
    
    // Проверяем, разрешил ли игрок сообщения от группы
    try {
        var result = await vkBridge.send('VKWebAppCallAPIMethod', {
            method: 'messages.isMessagesFromGroupAllowed',
            params: {
                group_id: GROUP_ID,
                user_id: currentUser.vk_id,
                v: '5.199'
            }
        });
        
        if(result && result.response && result.response.is_allowed === 1) {
            await completeNotifyTask();
        } else {
            toast('❌ Не разрешено. Напишите любое слово в ЛС группы!', 'error');
        }
    } catch(e) {
        // Пробуем отправить тестовое сообщение
        var sent = sendPersonalMessageSync(currentUser.vk_id, '✅ Уведомления подключены!');
        if(sent) {
            await completeNotifyTask();
        } else {
            toast('❌ Напишите группе любое слово и попробуйте снова', 'error');
        }
    }
}

async function completeNotifyTask() {
    if(currentUser.task_notify_done) return;
    await supabase.from('players').update({ experience: (currentUser.experience || 0) + 1000, task_notify_done: true }).eq('vk_id', currentUser.vk_id);
    currentUser.experience += 1000;
    currentUser.task_notify_done = true;
    toast('✅ +1000 опыта за уведомления!', 'success');
    renderAll();
    renderTasks();
}

// Отправка ЛС (синхронная для проверки)
function sendPersonalMessageSync(vkId, message) {
    if(!GROUP_TOKEN) return false;
    try {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.vk.com/method/messages.send', false);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.send('user_id=' + vkId + '&message=' + encodeURIComponent(message) + '&access_token=' + GROUP_TOKEN + '&v=5.199&random_id=' + Math.floor(Math.random() * 999999));
        var response = JSON.parse(xhr.responseText);
        return response && response.response;
    } catch(e) { return false; }
}

// Отправка ЛС (асинхронная для уведомлений)
function sendPersonalMessage(vkId, message) {
    if(!GROUP_TOKEN) return;
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.vk.com/method/messages.send', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.send('user_id=' + vkId + '&message=' + encodeURIComponent(message) + '&access_token=' + GROUP_TOKEN + '&v=5.199&random_id=' + Math.floor(Math.random() * 999999));
}

function doPromoTask() {
    openSettings();
    toast('Введите промокод', 'info');
}

// ================= ТОП =================
function switchTopSubtab(sub) {
    topSubtab = sub;
    document.querySelectorAll('.subtab').forEach(function(s){ s.classList.remove('active'); });
    document.getElementById('subtab-' + sub).classList.add('active');
    if(sub === 'players') loadTopPlayersScreen();
    else loadTopCompaniesScreen();
}

async function loadTopPlayersScreen() {
    var c = document.getElementById('top-content');
    c.innerHTML = 'Загрузка...';
    var allResult = await supabase.from('players').select('vk_id,first_name,last_name,photo_200,experience,level,company,company_group_id,owner_id,status').order('experience', { ascending: false }).limit(100);
    if(allResult.error) { c.innerHTML = 'Ошибка'; return; }
    c.innerHTML = '';
    if(!allResult.data.length) { c.innerHTML = '<p style="color:#aaa;">Нет данных</p>'; return; }
    allResult.data.forEach(function(p, i) {
        var rc = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
        var isMe = p.vk_id === currentUser.vk_id;
        var lvl = p.level || 1;
        var jobTitle = getJobTitle(lvl);
        
        var div = document.createElement('div');
        div.className = 'player-item';
        div.style.background = isMe ? 'rgba(76,175,80,0.1)' : '';
        div.style.cursor = 'pointer';
        div.onclick = function(){ openPlayerModalById(p.vk_id); };
        
        div.innerHTML = '<div class="rank ' + rc + '">' + (i+1) + '</div>' +
            '<img src="' + (p.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="event.stopPropagation();window.open(\'https://vk.com/id' + p.vk_id + '\',\'_blank\')">' +
            '<div class="info">' +
                '<div class="name">' + p.first_name + ' ' + p.last_name + (isMe ? ' ⭐' : '') + '</div>' +
                '<div class="detail">' + jobTitle + ' (ур.' + lvl + ')</div>' +
                '<div class="detail" style="color:#4caf50;">📈 +' + lvl + ' оп/час</div>' +
                '<div class="detail" style="color:#ffd700;">⭐ ' + (p.experience || 0) + ' опыта</div>';
        
        if(p.company) {
            div.querySelector('.info').innerHTML += '<div class="detail" style="color:#ff9800;cursor:pointer;" onclick="event.stopPropagation();openCompanyModal(\'' + p.company + '\')">🏢 ' + p.company + '</div>';
        }
        
        div.querySelector('.info').innerHTML += '</div>';
        c.appendChild(div);
    });
}

async function loadTopCompaniesScreen() {
    var c = document.getElementById('top-content');
    c.innerHTML = 'Загрузка...';
    var r = await supabase.from('players').select('company,experience,company_group_id').neq('company', null);
    if(r.error) { c.innerHTML = 'Ошибка'; return; }
    var comps = {};
    r.data.forEach(function(p) {
        if(!p.company) return;
        if(!comps[p.company]) comps[p.company] = { name: p.company, totalExp: 0, count: 0, groupId: p.company_group_id };
        comps[p.company].totalExp += (p.experience || 0);
        comps[p.company].count++;
    });
    var sorted = Object.values(comps).sort(function(a, b){ return b.totalExp - a.totalExp; });
    c.innerHTML = '';
    if(!sorted.length) { c.innerHTML = '<p style="color:#aaa;">Компаний пока нет</p>'; }
    sorted.forEach(function(co, i) {
        var isMine = co.name === currentUser.company;
        var div = document.createElement('div');
        div.className = 'player-item';
        div.style.background = isMine ? 'rgba(76,175,80,0.1)' : '';
        div.style.cursor = 'pointer';
        var groupIcon = co.groupId ? ' 📱' : '';
        div.innerHTML = '<div style="font-weight:700;width:25px;">' + (i+1) + '.</div><div class="info"><div class="name">' + co.name + groupIcon + (isMine ? ' ⭐' : '') + '</div><div class="detail">👥 ' + co.count + ' уч. • ⭐' + co.totalExp + ' опыта</div></div>';
        div.onclick = function(){ if(co.groupId) window.open('https://vk.com/club' + co.groupId, '_blank'); openCompanyModal(co.name); };
        c.appendChild(div);
    });
    if(!currentUser.company) {
        var btn = document.createElement('button');
        btn.className = 'btn-create';
        btn.textContent = '🚀 Создать компанию';
        btn.onclick = createCompany;
        c.appendChild(btn);
    }
}

// ================= МОЯ КОМПАНИЯ =================
async function loadMyCompanyScreen() {
    if(!currentUser.company) {
        document.getElementById('my-company-name').textContent = 'У вас нет компании';
        document.getElementById('my-company-stats').textContent = '';
        document.getElementById('my-company-members').innerHTML = '<p style="color:#aaa;text-align:center;margin:20px 0;">Создайте компанию из своей группы ВК!</p><button class="btn-create" onclick="createCompany()">🚀 Создать компанию</button>';
        document.getElementById('my-company-leave-btn').style.display = 'none';
        return;
    }
    document.getElementById('my-company-name').textContent = currentUser.company;
    if(currentUser.company_group_id) {
        document.getElementById('my-company-name').innerHTML += ' <a href="https://vk.com/club' + currentUser.company_group_id + '" target="_blank" style="color:#4a76a8;font-size:12px;">📱 Группа</a>';
    }
    var r = await supabase.from('players').select('*').eq('company', currentUser.company).order('level', { ascending: false });
    if(r.data) {
        document.getElementById('my-company-stats').textContent = '👥 ' + r.data.length + ' сотрудников';
        var list = document.getElementById('my-company-members');
        list.innerHTML = '';
        r.data.forEach(function(p, i) {
            var lvl = p.level || 1;
            var div = document.createElement('div');
            div.className = 'player-item';
            div.style.cursor = 'pointer';
            div.onclick = function(){ openPlayerModalById(p.vk_id); };
            div.innerHTML = '<div style="font-weight:700;width:25px;">' + (i+1) + '.</div>' +
                '<img src="' + (p.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'">' +
                '<div class="info"><div class="name">' + p.first_name + ' ' + p.last_name + '</div>' +
                '<div class="detail">' + getJobTitle(lvl) + ' (ур.' + lvl + ')</div>' +
                '<div class="detail" style="color:#4caf50;">📈 +' + lvl + ' оп/час</div>' +
                '<div class="detail" style="color:#ffd700;">⭐ ' + (p.experience || 0) + ' опыта</div></div>';
            list.appendChild(div);
        });
    }
    document.getElementById('my-company-leave-btn').style.display = 'block';
    document.getElementById('my-company-leave-btn').onclick = async function() {
        await supabase.from('players').update({ company: null, company_group_id: null }).eq('vk_id', currentUser.vk_id);
        currentUser.company = null;
        currentUser.company_group_id = null;
        toast('Вышли из компании', 'info');
        goTo('profile');
        location.reload();
    };
}

// ================= СОЗДАНИЕ КОМПАНИИ =================
async function createCompany() {
    try {
        var tokenResult = await vkBridge.send('VKWebAppGetAuthToken', {
            app_id: parseInt(APP_ID),
            scope: 'groups'
        });
        
        if(!tokenResult || !tokenResult.access_token) {
            toast('Не удалось получить доступ к группам', 'error');
            return;
        }
        
        var groupsResult = await vkBridge.send('VKWebAppCallAPIMethod', {
            method: 'groups.get',
            params: {
                filter: 'admin',
                extended: 1,
                access_token: tokenResult.access_token,
                v: '5.199'
            }
        });
        
        if(groupsResult && groupsResult.response && groupsResult.response.items && groupsResult.response.items.length > 0) {
            var groups = groupsResult.response.items;
            
            var modal = document.getElementById('input-modal');
            document.getElementById('input-modal-title').textContent = 'Выберите группу';
            var input = document.getElementById('input-modal-input');
            input.style.display = 'none';
            
            var listContainer = document.createElement('div');
            listContainer.id = 'groups-list';
            listContainer.style.cssText = 'max-height:300px;overflow-y:auto;margin:10px 0;';
            
            groups.forEach(function(g) {
                var item = document.createElement('div');
                item.style.cssText = 'padding:12px;margin:4px 0;background:rgba(255,255,255,0.08);border-radius:8px;cursor:pointer;font-size:14px;transition:0.2s;';
                item.textContent = g.name;
                item.onmouseover = function() { this.style.background = 'rgba(74,118,168,0.4)'; };
                item.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.08)'; };
                item.onclick = function() {
                    modal.style.display = 'none';
                    var oldList = document.getElementById('groups-list');
                    if(oldList) oldList.remove();
                    input.style.display = 'block';
                    
                    supabase.from('players').update({
                        company: g.name,
                        company_group_id: g.id
                    }).eq('vk_id', currentUser.vk_id).then(function() {
                        currentUser.company = g.name;
                        currentUser.company_group_id = g.id;
                        toast('✅ Компания «' + g.name + '» создана!', 'success');
                        location.reload();
                    });
                };
                listContainer.appendChild(item);
            });
            
            var buttonsContainer = input.parentNode;
            buttonsContainer.insertBefore(listContainer, document.getElementById('input-modal-ok').parentNode);
            
            modal.style.display = 'flex';
            
            document.getElementById('input-modal-cancel').onclick = function() {
                modal.style.display = 'none';
                var oldList = document.getElementById('groups-list');
                if(oldList) oldList.remove();
                input.style.display = 'block';
            };
            
            document.getElementById('input-modal-ok').style.display = 'none';
            
        } else {
            toast('У вас нет групп для управления', 'error');
        }
    } catch(e) {
        console.error(e);
        toast('Ошибка получения групп. Попробуйте позже.', 'error');
    }
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

function closePlayerModal() { document.getElementById('player-modal').style.display = 'none'; }

// ================= МОДАЛКА КОМПАНИИ =================
async function openCompanyModal(name) {
    var r0 = await supabase.from('players').select('company,company_group_id').eq('company', name).limit(1);
    var groupId = (r0.data && r0.data.length > 0) ? r0.data[0].company_group_id : null;
    document.getElementById('company-modal').style.display = 'flex';
    document.getElementById('modal-company-name').innerHTML = '🏢 ' + name;
    if(groupId) document.getElementById('modal-company-name').innerHTML += ' <a href="https://vk.com/club' + groupId + '" target="_blank" style="color:#4a76a8;font-size:13px;">📱</a>';
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
                await supabase.from('players').update({ company: null, company_group_id: null }).eq('vk_id', currentUser.vk_id);
                currentUser.company = null;
                currentUser.company_group_id = null;
                toast('Вышли из компании', 'info');
                closeCompanyModal();
                location.reload();
            };
        } else {
            jb.style.display = 'block';
            jb.onclick = async function() {
                await supabase.from('players').update({ company: name }).eq('vk_id', currentUser.vk_id);
                currentUser.company = name;
                toast('✅ Вступили!', 'success');
                closeCompanyModal();
                location.reload();
            };
        }
    }
}

function closeCompanyModal() { document.getElementById('company-modal').style.display = 'none'; }

// ================= НАСТРОЙКИ =================
function openSettings() {
    document.getElementById('settings-modal').style.display = 'flex';
    document.getElementById('promo-input').value = '';
    document.getElementById('promo-go-btn').onclick = applyPromo;
}

function closeSettings() { document.getElementById('settings-modal').style.display = 'none'; }

async function applyPromo() {
    var code = document.getElementById('promo-input').value.trim().toUpperCase();
    if(!code) { toast('Введите промокод!', 'error'); return; }
    var r = await supabase.from('promocodes').select('*').eq('code', code).maybeSingle();
    if(!r.data) { toast('Промокод не найден!', 'error'); return; }
    var promo = r.data;
    if(promo.used_by && promo.used_by.includes(currentUser.vk_id)) { toast('Вы уже использовали!', 'error'); return; }
    if(promo.used_by && promo.used_by.length >= promo.max_uses) { toast('Промокод не действует!', 'error'); return; }
    var newExp = (currentUser.experience || 0) + promo.reward_exp + 1000;
    await supabase.from('players').update({ experience: newExp }).eq('vk_id', currentUser.vk_id);
    currentUser.experience = newExp;
    var usedBy = promo.used_by || [];
    usedBy.push(currentUser.vk_id);
    await supabase.from('promocodes').update({ used_by: usedBy }).eq('code', code);
    await supabase.from('players').update({ task_promo_done: true }).eq('vk_id', currentUser.vk_id);
    currentUser.task_promo_done = true;
    toast('🎁 +' + (promo.reward_exp + 1000) + ' опыта!', 'success');
    closeSettings();
    renderAll();
    renderTasks();
}

// ================= ПРИГЛАШЕНИЕ =================
function inviteFriend() {
    var refLink = 'https://vk.com/app' + APP_ID + '#ref_' + currentUser.vk_id;
    vkBridge.send('VKWebAppShare', { link: refLink, text: '🎮 Присоединяйся к Корпоративным Играм! Стань моим сотрудником!' })
        .then(function(){ toast('✅ Отправлено!', 'success'); })
        .catch(function() {
            navigator.clipboard.writeText(refLink)
                .then(function(){ toast('🔗 Скопировано!', 'info'); })
                .catch(function(){ toast('Не удалось отправить', 'error'); });
        });
}
