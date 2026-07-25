// ================= ИГРОВАЯ ЛОГИКА =================

// Прокачка сотрудника
async function upgradeEmployee(emp) {
    var cost = Math.floor((emp.hire_cost || 100) * 1.5);
    if((currentUser.experience || 0) < cost) { toast('Недостаточно опыта!', 'error'); return; }
    await supabase.from('players').update({ experience: Math.max(0, (currentUser.experience || 0) - cost) }).eq('vk_id', currentUser.vk_id);
    var newCost = Math.floor((emp.hire_cost || 100) * 1.5);
    await supabase.from('players').update({ level: (emp.level || 1) + 1, income_per_hour: (emp.income_per_hour || 0) + 1, hire_cost: newCost }).eq('vk_id', emp.vk_id);
    currentUser.experience = Math.max(0, (currentUser.experience || 0) - cost);
    await supabase.from('players').update({ last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.last_collect = new Date().toISOString();
    toast('✅ Прокачано!', 'success');
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

// Увольнение сотрудника
async function fireEmployee(emp) {
    var fireIncome = Math.floor((emp.hire_cost || 100) * 0.8);
    await supabase.from('players').update({ experience: (currentUser.experience || 0) + fireIncome }).eq('vk_id', currentUser.vk_id);
    var newCost = Math.floor((emp.hire_cost || 100) * 1.5);
    await supabase.from('players').update({ owner_id: null, status: 'Биржа труда', role: null, income_per_hour: 0, level: 1, hire_cost: newCost }).eq('vk_id', emp.vk_id);
    currentUser.experience += fireIncome;
    toast('🔥 Уволен! +' + fireIncome + ' опыта', 'info');
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

// ================= БИРЖА =================
async function loadMarketScreen() {
    var c = document.getElementById('market-content');
    c.innerHTML = 'Загрузка...';
    var result = await supabase.from('players').select('*').eq('status', 'Биржа труда').neq('vk_id', currentUser.vk_id).order('experience', { ascending: false }).limit(100);
    if(!result.data || !result.data.length) { c.innerHTML = '<p style="color:#aaa;text-align:center;">На бирже никого нет</p>'; return; }
    c.innerHTML = '<p style="font-size:11px;color:#aaa;margin-bottom:10px;">Найдено ' + result.data.length + ' безработных</p>';
    result.data.forEach(function(player) {
        var hireCost = player.hire_cost || 100;
        var div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = '<img src="' + (player.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="openPlayerModalById(' + player.vk_id + ')"><div class="info" onclick="openPlayerModalById(' + player.vk_id + ')"><div class="name">' + player.first_name + ' ' + player.last_name + '</div><div class="detail">⭐' + (player.experience || 0) + ' • 💰' + hireCost + '</div></div><button class="btn-hire-small" data-id="' + player.vk_id + '">💼 ' + hireCost + '</button>';
        c.appendChild(div);
    });
    c.querySelectorAll('.btn-hire-small').forEach(function(btn) {
        btn.onclick = async function(e) {
            e.stopPropagation();
            var empId = parseInt(this.getAttribute('data-id'));
            var hireCost = 100;
            if((currentUser.experience || 0) < hireCost) { toast('Недостаточно опыта!', 'error'); return; }
            await supabase.from('players').update({ experience: Math.max(0, (currentUser.experience || 0) - hireCost) }).eq('vk_id', currentUser.vk_id);
            await supabase.from('players').update({ owner_id: currentUser.vk_id, status: 'Работает', role: 'Учёный', income_per_hour: 1, level: 1, hire_cost: hireCost }).eq('vk_id', empId);
            currentUser.experience = Math.max(0, (currentUser.experience || 0) - hireCost);
            await supabase.from('players').update({ last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
            currentUser.last_collect = new Date().toISOString();
            toast('✅ Нанят!', 'success');
            await updateAllStats();
            loadMyTeam(true);
            renderAll();
            loadMarketScreen();
        };
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
    var allResult = await supabase.from('players').select('vk_id,first_name,last_name,photo_200,experience').order('experience', { ascending: false }).limit(100);
    if(allResult.error) { c.innerHTML = 'Ошибка'; return; }
    c.innerHTML = '';
    if(!allResult.data.length) { c.innerHTML = '<p style="color:#aaa;">Нет данных</p>'; return; }
    allResult.data.forEach(function(p, i) {
        var rc = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
        var isMe = p.vk_id === currentUser.vk_id;
        var div = document.createElement('div');
        div.className = 'player-item';
        div.style.background = isMe ? 'rgba(76,175,80,0.1)' : '';
        div.innerHTML = '<div class="rank ' + rc + '">' + (i+1) + '</div><img src="' + (p.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="event.stopPropagation();window.open(\'https://vk.com/id' + p.vk_id + '\',\'_blank\')"><div class="info"><div class="name">' + p.first_name + ' ' + p.last_name + (isMe ? ' ⭐' : '') + '</div><div class="detail">⭐' + (p.experience || 0) + '</div></div>';
        div.onclick = function(){ openPlayerModalById(p.vk_id); };
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
    var r = await supabase.from('players').select('*').eq('company', currentUser.company).order('experience', { ascending: false });
    if(r.data) {
        document.getElementById('my-company-stats').textContent = '👥 ' + r.data.length + ' сотрудников';
        var list = document.getElementById('my-company-members');
        list.innerHTML = '';
        r.data.forEach(function(p, i) {
            var div = document.createElement('div');
            div.className = 'player-item';
            div.innerHTML = '<div style="font-weight:700;width:25px;">' + (i+1) + '.</div><img src="' + (p.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'"><div class="info" onclick="openPlayerModalById(' + p.vk_id + ')"><div class="name">' + p.first_name + ' ' + p.last_name + '</div><div class="detail">⭐' + (p.experience || 0) + '</div></div>';
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
        var result = await vkBridge.send('VKWebAppGetCommunityAuthToken', { app_id: String(APP_ID), scope: 'manage' });
        if(result.groups && result.groups.length > 0) {
            var groupNames = result.groups.map(function(g, i){ return (i+1) + '. ' + g.name; }).join('\n');
            showInputModal('Выберите группу\n(введите номер)\n\n' + groupNames, 'Номер группы', '1', function(choice) {
                if(!choice) return;
                var idx = parseInt(choice) - 1;
                if(idx >= 0 && idx < result.groups.length) {
                    var g = result.groups[idx];
                    supabase.from('players').update({ company: g.name, company_group_id: g.id }).eq('vk_id', currentUser.vk_id).then(function() {
                        currentUser.company = g.name;
                        currentUser.company_group_id = g.id;
                        toast('✅ Компания «' + g.name + '» создана!', 'success');
                        location.reload();
                    });
                }
            });
        } else {
            toast('У вас нет групп для управления', 'error');
        }
    } catch(e) {
        console.error(e);
        toast('Ошибка получения групп', 'error');
    }
}

// ================= МОДАЛКИ =================
async function openPlayerModalById(vkId) {
    var r = await supabase.from('players').select('*').eq('vk_id', vkId).maybeSingle();
    if(r.data) openPlayerModal(r.data);
}

function openPlayerModal(player) {
    var modal = document.getElementById('player-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-player-header').innerHTML = '<img src="' + (player.photo_200 || 'https://vk.com/images/camera_200.png') + '" style="width:50px;height:50px;border-radius:50%;vertical-align:middle;margin-right:10px;cursor:pointer;" onclick="window.open(\'https://vk.com/id' + player.vk_id + '\',\'_blank\')"><span style="font-size:18px;font-weight:700;">' + player.first_name + ' ' + player.last_name + '</span>';
    
    var ownerDiv = document.getElementById('modal-player-owner');
    if(player.owner_id && player.owner_id !== player.vk_id) {
        supabase.from('players').select('first_name,last_name,vk_id').eq('vk_id', player.owner_id).maybeSingle().then(function(r) {
            if(r.data) ownerDiv.innerHTML = '🔒 Работает на: <b style="cursor:pointer;text-decoration:underline;color:#ff9800;" onclick="openPlayerModalById(' + r.data.vk_id + ')">' + r.data.first_name + ' ' + r.data.last_name + '</b>';
        });
    } else { ownerDiv.innerHTML = ''; }
    
    var hireBtn = document.getElementById('modal-hire-btn');
    var fireBtn = document.getElementById('modal-fire-btn');
    hireBtn.style.display = 'none';
    fireBtn.style.display = 'none';
    
    var isMyOwner = currentUser.owner_id && currentUser.owner_id === player.vk_id;
    var isMyEmployee = player.owner_id === currentUser.vk_id;
    var isInMyChain = currentUser.owner_id && player.vk_id === currentUser.owner_id;
    
    if((!player.owner_id || player.status === 'Биржа труда') && player.vk_id !== currentUser.vk_id && !isMyOwner && !isInMyChain) {
        var hireCost = player.hire_cost || 100;
        hireBtn.style.display = 'block';
        hireBtn.textContent = '💼 Нанять за ' + hireCost + ' опыта';
        hireBtn.onclick = async function() {
            if((currentUser.experience || 0) < hireCost) { toast('Недостаточно опыта!', 'error'); return; }
            await supabase.from('players').update({ experience: Math.max(0, (currentUser.experience || 0) - hireCost) }).eq('vk_id', currentUser.vk_id);
            await supabase.from('players').update({ owner_id: currentUser.vk_id, status: 'Работает', role: 'Учёный', income_per_hour: 1, level: 1, hire_cost: hireCost }).eq('vk_id', player.vk_id);
            currentUser.experience = Math.max(0, (currentUser.experience || 0) - hireCost);
            await supabase.from('players').update({ last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
            currentUser.last_collect = new Date().toISOString();
            toast('✅ Нанят!', 'success');
            closePlayerModal();
            await updateAllStats();
            loadMyTeam(true);
            renderAll();
        };
    }
    
    if(isMyEmployee) {
        var fireIncome = Math.floor((player.hire_cost || 100) * 0.8);
        var newCost = Math.floor((player.hire_cost || 100) * 1.5);
        fireBtn.style.display = 'block';
        fireBtn.textContent = '🔥 Уволить (+' + fireIncome + ' опыта)';
        fireBtn.onclick = async function() {
            await supabase.from('players').update({ experience: (currentUser.experience || 0) + fireIncome }).eq('vk_id', currentUser.vk_id);
            await supabase.from('players').update({ owner_id: null, status: 'Биржа труда', role: null, income_per_hour: 0, level: 1, hire_cost: newCost }).eq('vk_id', player.vk_id);
            currentUser.experience += fireIncome;
            toast('🔥 Уволен!', 'info');
            closePlayerModal();
            await updateAllStats();
            loadMyTeam(true);
            renderAll();
        };
    }
    
    supabase.from('players').select('*').eq('owner_id', player.vk_id).order('experience', { ascending: false }).then(function(r) {
        var list = document.getElementById('modal-player-employees');
        if(!r.data || !r.data.length) {
            document.getElementById('modal-player-stats').textContent = '⭐' + (player.experience || 0) + ' • Нет сотрудников';
            list.innerHTML = '<p style="color:#aaa;">Нет сотрудников</p>';
        } else {
            document.getElementById('modal-player-stats').textContent = '⭐' + (player.experience || 0) + ' • 👥 ' + r.data.length + ' сотр.';
            list.innerHTML = '';
            r.data.forEach(function(emp) {
                var stealCost = Math.floor((emp.hire_cost || 100) * 1.5);
                var div = document.createElement('div');
                div.className = 'player-item';
                div.innerHTML = '<img src="' + (emp.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="event.stopPropagation();openPlayerModalById(' + emp.vk_id + ')"><div class="info" onclick="openPlayerModalById(' + emp.vk_id + ')"><div class="name">' + emp.first_name + ' ' + emp.last_name + '<span class="lvl">' + (emp.level || 1) + ' ур</span></div><div class="detail">🔬 +' + (emp.income_per_hour || 0) + ' оп/час • 💰' + (emp.hire_cost || 100) + '</div></div>';
                if(emp.owner_id !== currentUser.vk_id && emp.vk_id !== currentUser.vk_id && emp.vk_id !== currentUser.owner_id) {
                    var btn = document.createElement('button');
                    btn.className = 'btn-steal';
                    btn.textContent = '💰 ' + stealCost;
                    btn.onclick = async function(e) {
                        e.stopPropagation();
                        if((currentUser.experience || 0) < stealCost) { toast('Недостаточно опыта!', 'error'); return; }
                        await supabase.from('players').update({ experience: Math.max(0, (currentUser.experience || 0) - stealCost) }).eq('vk_id', currentUser.vk_id);
                        await supabase.from('players').update({ owner_id: currentUser.vk_id, hire_cost: stealCost, level: 1, income_per_hour: 1 }).eq('vk_id', emp.vk_id);
                        currentUser.experience = Math.max(0, (currentUser.experience || 0) - stealCost);
                        await supabase.from('players').update({ last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
                        currentUser.last_collect = new Date().toISOString();
                        toast('✅ Перекуплен!', 'success');
                        closePlayerModal();
                        await updateAllStats();
                        loadMyTeam(true);
                        renderAll();
                    };
                    div.appendChild(btn);
                }
                list.appendChild(div);
            });
        }
    });
}

function closePlayerModal() { document.getElementById('player-modal').style.display = 'none'; }

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
            var div = document.createElement('div');
            div.className = 'player-item';
            div.innerHTML = '<img src="' + (p.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'"><div class="info" onclick="closeCompanyModal();openPlayerModalById(' + p.vk_id + ')"><div class="name">' + p.first_name + ' ' + p.last_name + '</div><div class="detail">⭐' + (p.experience || 0) + '</div></div>';
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
