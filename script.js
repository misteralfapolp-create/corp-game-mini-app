// ================= НАСТРОЙКИ =================
var SUPABASE_URL = 'https://fcrjkfiodvfhzamayvoe.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjcmprZmlvZHZmaHphbWF5dm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTcwMTQsImV4cCI6MjA5OTY5MzAxNH0.C3Ls4QMoYWnFciuOURZ7-WLmGa4TWtBsedhURVNulKI';
var APP_ID = '54679388';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
var currentUser = null, currentVkUser = null, currentTab = 'market', topSubtab = 'players';
var myTeamOffset = 0, myTeamTotal = 0;
var TEAM_PAGE_SIZE = 20;

// ================= УВЕДОМЛЕНИЯ =================
function toast(msg, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(function() { el.remove(); }, 2800);
}

// ================= ОТКРЫТЬ ПРОФИЛЬ VK =================
function openVkProfile() {
    if (currentVkUser) {
        vkBridge.send('VKWebAppOpenCommunity', { userId: currentVkUser.id }).catch(function() {
            window.open('https://vk.com/id' + currentVkUser.id, '_blank');
        });
    }
}

function openVkProfileById(vkId) {
    vkBridge.send('VKWebAppOpenCommunity', { userId: vkId }).catch(function() {
        window.open('https://vk.com/id' + vkId, '_blank');
    });
}

// ================= ЗАПУСК =================
window.addEventListener('load', function() {
    if (typeof vkBridge !== 'undefined') vkBridge.send('VKWebAppInit').then(initApp);
});

function getRefFromHash() { 
    var m = window.location.hash.match(/ref_(\d+)/); 
    return m ? m[1] : null; 
}

async function initApp() {
    try {
        currentVkUser = await vkBridge.send('VKWebAppGetUserInfo');
        var invitedBy = getRefFromHash() || new URLSearchParams(window.location.search).get('ref');
        if (invitedBy && parseInt(invitedBy) === currentVkUser.id) invitedBy = null;

        var result = await supabase.from('players').select('*').eq('vk_id', currentVkUser.id).maybeSingle();
        if (result.error) throw result.error;

        if (!result.data) {
            var now = new Date().toISOString();
            await supabase.from('players').insert([{
                vk_id: currentVkUser.id, first_name: currentVkUser.first_name, last_name: currentVkUser.last_name,
                photo_200: currentVkUser.photo_200 || '', status: 'Биржа труда',
                company: null, role: null, experience: 0, income_per_hour: 0,
                invited_by: invitedBy ? parseInt(invitedBy) : null,
                last_collect: now, pending_experience: 0, level: 1, hire_cost: 100, owner_id: null
            }]);
            if (invitedBy) await giveReferralBonus(parseInt(invitedBy));
            location.reload(); return;
        }

        currentUser = result.data;
        if (currentUser.owner_id === undefined) {
            await supabase.from('players').update({ owner_id: null, last_collect: new Date().toISOString(), pending_experience: 0 }).eq('vk_id', currentUser.vk_id);
            currentUser.owner_id = null; currentUser.last_collect = new Date().toISOString(); currentUser.pending_experience = 0;
        }

        await calculatePendingExperience();
        await updateStats();
        renderAll();
    } catch (e) { console.error(e); }
}

// ================= ОПЫТ =================
async function calculatePendingExperience() {
    var empResult = await supabase.from('players').select('income_per_hour').eq('owner_id', currentUser.vk_id);
    if (empResult.error || !empResult.data.length) return;
    var totalPerHour = 0;
    empResult.data.forEach(function(e) { totalPerHour += (e.income_per_hour || 0); });
    var hoursPassed = (new Date() - new Date(currentUser.last_collect || new Date())) / 3600000;
    var newPending = Math.floor((currentUser.pending_experience || 0) + totalPerHour * hoursPassed);
    await supabase.from('players').update({ pending_experience: newPending, last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.pending_experience = newPending;
}

async function updateStats() {
    var countResult = await supabase.from('players').select('vk_id', { count: 'exact' }).eq('owner_id', currentUser.vk_id);
    myTeamTotal = countResult.count || 0;
    var incomeResult = await supabase.from('players').select('income_per_hour').eq('owner_id', currentUser.vk_id);
    var income = 0;
    if (incomeResult.data) incomeResult.data.forEach(function(e) { income += (e.income_per_hour || 0); });
    document.getElementById('my-employees-count').textContent = myTeamTotal;
    document.getElementById('my-income').textContent = '+' + income;
    document.getElementById('my-team-total').textContent = myTeamTotal;
}

async function collectExperience() {
    if (!currentUser.pending_experience) { toast('Нечего собирать', 'info'); return; }
    var collected = currentUser.pending_experience;
    await supabase.from('players').update({ experience: (currentUser.experience || 0) + collected, pending_experience: 0, last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.experience += collected; currentUser.pending_experience = 0;
    toast('✅ +' + collected + ' опыта!', 'success');
    renderAll();
}

async function giveReferralBonus(id) {
    var r = await supabase.from('players').select('experience').eq('vk_id', id).maybeSingle();
    if (r.data) await supabase.from('players').update({ experience: (r.data.experience || 0) + 500 }).eq('vk_id', id);
}

// ================= ВКЛАДКИ =================
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('top-subtabs').style.display = (tab === 'top') ? 'block' : 'none';
    if (tab === 'market') loadMarket();
    else if (tab === 'top') {
        if (topSubtab === 'players') loadTopPlayers();
        else loadClans();
    }
}

function switchTopSubtab(sub) {
    topSubtab = sub;
    document.querySelectorAll('.subtab').forEach(function(s) { s.classList.remove('active'); });
    document.getElementById('subtab-' + sub).classList.add('active');
    if (sub === 'players') loadTopPlayers();
    else loadClans();
}

// ================= МОЯ КОМАНДА =================
async function loadMyTeam(reset) {
    if (reset) {
        myTeamOffset = 0;
        document.getElementById('my-team-list').innerHTML = '';
    }
    
    var list = document.getElementById('my-team-list');
    
    // Получаем количество для проверки
    var countResult = await supabase.from('players').select('vk_id', { count: 'exact' }).eq('owner_id', currentUser.vk_id);
    myTeamTotal = countResult.count || 0;
    document.getElementById('my-team-total').textContent = myTeamTotal;
    
    if (myTeamTotal === 0) {
        list.innerHTML = '<p style="color:#888;text-align:center;">У вас пока нет сотрудников</p>';
        document.getElementById('load-more-btn').style.display = 'none';
        return;
    }
    
    var result = await supabase.from('players').select('*').eq('owner_id', currentUser.vk_id)
        .order('experience', { ascending: false }).range(myTeamOffset, myTeamOffset + TEAM_PAGE_SIZE - 1);
    if (result.error) return;
    var team = result.data || [];
    
    team.forEach(function(emp) {
        var cost = Math.floor(emp.hire_cost || 100);
        var upgradeCost = Math.floor(cost * 1.5);
        var fireIncome = Math.floor(cost * 0.8);
        var div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = 
            '<img src="' + (emp.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="openPlayerModalById(' + emp.vk_id + ')" title="Открыть">' +
            '<div class="info" onclick="openPlayerModalById(' + emp.vk_id + ')" style="cursor:pointer;"><div class="name">' + emp.first_name + ' ' + emp.last_name + '<span class="lvl">' + (emp.level || 1) + ' ур</span></div>' +
            '<div class="detail">🔬 +' + (emp.income_per_hour || 0) + ' оп/час • 💰' + cost + '</div></div>' +
            '<div class="btn-group">' +
                '<button class="btn-upgrade" data-id="' + emp.vk_id + '">⬆ ' + upgradeCost + '</button>' +
                '<button class="btn-fire" data-id="' + emp.vk_id + '">🔥 +' + fireIncome + '</button>' +
            '</div>';
        list.appendChild(div);
    });

    myTeamOffset += team.length;
    var loadMoreBtn = document.getElementById('load-more-btn');
    loadMoreBtn.style.display = (myTeamOffset < myTeamTotal) ? 'block' : 'none';

    // Прокачка
    list.querySelectorAll('.btn-upgrade').forEach(function(btn) {
        btn.onclick = async function(e) {
            e.stopPropagation();
            var empId = parseInt(this.getAttribute('data-id'));
            var empResult = await supabase.from('players').select('*').eq('vk_id', empId).maybeSingle();
            if (!empResult.data) return;
            var emp = empResult.data;
            var cost = Math.floor((emp.hire_cost || 100) * 1.5);
            if (currentUser.experience < cost) { toast('Недостаточно опыта! Нужно ' + cost, 'error'); return; }
            await supabase.from('players').update({ experience: currentUser.experience - cost }).eq('vk_id', currentUser.vk_id);
            var newCost = Math.floor((emp.hire_cost || 100) * 1.5);
            await supabase.from('players').update({ level: (emp.level || 1) + 1, income_per_hour: (emp.income_per_hour || 0) + 1, hire_cost: newCost }).eq('vk_id', empId);
            currentUser.experience -= cost;
            toast('✅ Прокачано до ур.' + ((emp.level || 1) + 1), 'success');
            await updateStats(); loadMyTeam(true); renderAll();
        };
    });

    // Увольнение
    list.querySelectorAll('.btn-fire').forEach(function(btn) {
        btn.onclick = async function(e) {
            e.stopPropagation();
            var empId = parseInt(this.getAttribute('data-id'));
            var empResult = await supabase.from('players').select('*').eq('vk_id', empId).maybeSingle();
            if (!empResult.data) return;
            var emp = empResult.data;
            var fireIncome = Math.floor((emp.hire_cost || 100) * 0.8);
            await supabase.from('players').update({ experience: (currentUser.experience || 0) + fireIncome }).eq('vk_id', currentUser.vk_id);
            await supabase.from('players').update({ owner_id: null, status: 'Биржа труда', role: null, income_per_hour: 0, level: 1, hire_cost: 100 }).eq('vk_id', empId);
            currentUser.experience += fireIncome;
            toast('🔥 Уволен! +' + fireIncome + ' опыта', 'info');
            await updateStats(); loadMyTeam(true); renderAll();
        };
    });
}

// ================= БИРЖА =================
async function loadMarket() {
    var content = document.getElementById('tab-content');
    content.innerHTML = 'Загрузка...';
    var result = await supabase.from('players').select('*').eq('status', 'Биржа труда').neq('vk_id', currentUser.vk_id).order('experience', { ascending: false });
    if (result.error) { content.innerHTML = 'Ошибка'; return; }
    var jobless = result.data;
    if (!jobless.length) { content.innerHTML = '<p style="color:#888;text-align:center;">Биржа пуста</p>'; return; }
    content.innerHTML = '';
    jobless.forEach(function(p) {
        var hireCost = 100;
        var div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = 
            '<img src="' + (p.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="openPlayerModalById(' + p.vk_id + ')">' +
            '<div class="info" onclick="openPlayerModalById(' + p.vk_id + ')" style="cursor:pointer;"><div class="name">' + p.first_name + ' ' + p.last_name + '</div>' +
            '<div class="detail">⭐' + (p.experience || 0) + '</div></div>' +
            '<button class="btn-hire" data-id="' + p.vk_id + '">💼 ' + hireCost + '</button>';
        content.appendChild(div);
    });
    content.querySelectorAll('.btn-hire').forEach(function(btn) {
        btn.onclick = async function(e) {
            e.stopPropagation();
            var empId = parseInt(this.getAttribute('data-id'));
            if (currentUser.experience < 100) { toast('Недостаточно опыта! Нужно 100', 'error'); return; }
            await supabase.from('players').update({ experience: currentUser.experience - 100 }).eq('vk_id', currentUser.vk_id);
            await supabase.from('players').update({ owner_id: currentUser.vk_id, status: 'Работает', role: 'Учёный', income_per_hour: 1, level: 1, hire_cost: 100 }).eq('vk_id', empId);
            currentUser.experience -= 100;
            toast('✅ Нанят! -100 опыта', 'success');
            await updateStats(); loadMyTeam(true); renderAll(); loadMarket();
        };
    });
}

// ================= ТОП ИГРОКОВ =================
async function loadTopPlayers() {
    var content = document.getElementById('tab-content');
    content.innerHTML = 'Загрузка...';
    var result = await supabase.from('players').select('*').order('experience', { ascending: false }).limit(100);
    if (result.error) { content.innerHTML = 'Ошибка'; return; }
    content.innerHTML = '';
    result.data.forEach(function(p, i) {
        var rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
        var isMe = (p.vk_id === currentUser.vk_id);
        var div = document.createElement('div');
        div.className = 'player-item clickable';
        div.style.background = isMe ? '#e8f5e9' : '';
        div.innerHTML = 
            '<div class="rank ' + rankClass + '">' + (i + 1) + '</div>' +
            '<img src="' + (p.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="event.stopPropagation(); openVkProfileById(' + p.vk_id + ')">' +
            '<div class="info"><div class="name">' + p.first_name + ' ' + p.last_name + (isMe ? ' ⭐' : '') + '</div>' +
            '<div class="detail">⭐' + (p.experience || 0) + '</div></div>';
        div.onclick = function() { openPlayerModalById(p.vk_id); };
        content.appendChild(div);
    });
}

// ================= МОДАЛКА ИГРОКА (любой игрок, даже без сотрудников) =================
async function openPlayerModalById(vkId) {
    var result = await supabase.from('players').select('*').eq('vk_id', vkId).maybeSingle();
    if (result.data) openPlayerModal(result.data);
}

function openPlayerModal(player) {
    document.getElementById('player-modal').style.display = 'flex';
    
    // Заголовок с аватаркой
    var header = document.getElementById('modal-player-header');
    header.innerHTML = 
        '<img src="' + (player.photo_200 || 'https://vk.com/images/camera_200.png') + '" style="width:50px;height:50px;border-radius:50%;vertical-align:middle;margin-right:10px;cursor:pointer;" onclick="openVkProfileById(' + player.vk_id + ')" title="Открыть профиль ВК">' +
        '<span style="font-size:18px;font-weight:700;">' + player.first_name + ' ' + player.last_name + '</span>';
    
    // Загружаем сотрудников
    supabase.from('players').select('*').eq('owner_id', player.vk_id).order('experience', { ascending: false }).then(function(result) {
        var list = document.getElementById('modal-player-employees');
        if (!result.data || !result.data.length) {
            document.getElementById('modal-player-stats').textContent = '⭐' + (player.experience || 0) + ' • Нет сотрудников';
            list.innerHTML = '<p style="color:#888;text-align:center;">У этого игрока нет сотрудников</p>';
        } else {
            document.getElementById('modal-player-stats').textContent = '⭐' + (player.experience || 0) + ' • 👥 ' + result.data.length + ' сотр.';
            list.innerHTML = '';
            result.data.forEach(function(emp) {
                var stealCost = Math.floor((emp.hire_cost || 100) * 1.5);
                var div = document.createElement('div');
                div.className = 'player-item';
                div.innerHTML = 
                    '<img src="' + (emp.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="event.stopPropagation(); openPlayerModalById(' + emp.vk_id + ')" title="Открыть сотрудника">' +
                    '<div class="info" onclick="openPlayerModalById(' + emp.vk_id + ')" style="cursor:pointer;"><div class="name">' + emp.first_name + ' ' + emp.last_name + '<span class="lvl">' + (emp.level || 1) + ' ур</span></div>' +
                    '<div class="detail">🔬 +' + (emp.income_per_hour || 0) + ' оп/час • 💰' + (emp.hire_cost || 100) + '</div></div>';
                if (emp.owner_id !== currentUser.vk_id && emp.vk_id !== currentUser.vk_id) {
                    var btn = document.createElement('button');
                    btn.className = 'btn-steal';
                    btn.textContent = '💰 ' + stealCost;
                    btn.onclick = async function(e) {
                        e.stopPropagation();
                        if (currentUser.experience < stealCost) { toast('Недостаточно опыта! Нужно ' + stealCost, 'error'); return; }
                        await supabase.from('players').update({ experience: currentUser.experience - stealCost }).eq('vk_id', currentUser.vk_id);
                        await supabase.from('players').update({ owner_id: currentUser.vk_id, hire_cost: stealCost }).eq('vk_id', emp.vk_id);
                        currentUser.experience -= stealCost;
                        toast('✅ Перекуплен! -' + stealCost + ' опыта', 'success');
                        closePlayerModal(); renderAll(); loadMyTeam(true);
                    };
                    div.appendChild(btn);
                }
                list.appendChild(div);
            });
        }
    });
}
function closePlayerModal() { document.getElementById('player-modal').style.display = 'none'; }

// ================= КЛАНЫ =================
async function loadClans() {
    var content = document.getElementById('tab-content');
    content.innerHTML = 'Загрузка...';
    var result = await supabase.from('players').select('company').neq('company', null);
    if (result.error) { content.innerHTML = 'Ошибка'; return; }
    var clans = {};
    result.data.forEach(function(p) {
        if (!p.company) return;
        if (!clans[p.company]) clans[p.company] = { name: p.company, count: 0 };
        clans[p.company].count++;
    });
    var sorted = Object.values(clans).sort(function(a, b) { return b.count - a.count; });
    content.innerHTML = '';
    if (!sorted.length) { content.innerHTML = '<p style="color:#888;text-align:center;">Кланов пока нет</p>'; }
    sorted.forEach(function(c, i) {
        var isMyClan = (c.name === currentUser.company);
        var div = document.createElement('div');
        div.className = 'player-item clickable';
        div.style.background = isMyClan ? '#e8f5e9' : '';
        div.innerHTML = 
            '<div style="font-weight:700;width:25px;">' + (i + 1) + '.</div>' +
            '<div class="info"><div class="name">' + c.name + (isMyClan ? ' ⭐' : '') + '</div>' +
            '<div class="detail">👥 ' + c.count + ' участников</div></div>';
        div.onclick = function() { openClanModal(c.name); };
        content.appendChild(div);
    });
    if (!currentUser.company) {
        var btn = document.createElement('button');
        btn.className = 'btn-create';
        btn.textContent = '🚀 Создать клан';
        btn.onclick = createClan;
        content.appendChild(btn);
    }
}

async function openClanModal(clanName) {
    document.getElementById('clan-modal').style.display = 'flex';
    document.getElementById('modal-clan-name').textContent = '🏢 ' + clanName;
    var result = await supabase.from('players').select('*').eq('company', clanName);
    if (result.data) {
        document.getElementById('modal-clan-stats').textContent = '👥 ' + result.data.length + ' участников';
        var list = document.getElementById('modal-clan-members');
        list.innerHTML = '';
        result.data.forEach(function(p) {
            var div = document.createElement('div');
            div.className = 'player-item clickable';
            div.innerHTML = 
                '<img src="' + (p.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'">' +
                '<div class="info"><div class="name">' + p.first_name + ' ' + p.last_name + '</div>' +
                '<div class="detail">⭐' + (p.experience || 0) + '</div></div>';
            div.onclick = function() { closeClanModal(); openPlayerModalById(p.vk_id); };
            list.appendChild(div);
        });
        var joinBtn = document.getElementById('modal-join-btn');
        var leaveBtn = document.getElementById('modal-leave-btn');
        joinBtn.style.display = 'none'; leaveBtn.style.display = 'none';
        if (currentUser.company === clanName) {
            leaveBtn.style.display = 'block';
            var cost = Math.floor((currentUser.hire_cost || 100) * 1.5);
            leaveBtn.textContent = '🚪 Выйти (' + cost + ' опыта)';
            leaveBtn.onclick = async function() {
                if (currentUser.experience < cost) { toast('Недостаточно опыта! Нужно ' + cost, 'error'); return; }
                await supabase.from('players').update({ experience: currentUser.experience - cost, company: null }).eq('vk_id', currentUser.vk_id);
                currentUser.experience -= cost; currentUser.company = null;
                toast('Вы вышли из клана', 'info');
                closeClanModal(); renderAll(); location.reload();
            };
        } else {
            joinBtn.style.display = 'block';
            joinBtn.textContent = '✅ Вступить (бесплатно)';
            joinBtn.onclick = async function() {
                await supabase.from('players').update({ company: clanName }).eq('vk_id', currentUser.vk_id);
                currentUser.company = clanName;
                toast('✅ Вы вступили в клан «' + clanName + '»', 'success');
                closeClanModal(); renderAll(); location.reload();
            };
        }
    }
}
function closeClanModal() { document.getElementById('clan-modal').style.display = 'none'; }

async function createClan() {
    var name = prompt('Название клана:', 'Клан ' + currentUser.first_name);
    if (!name) return;
    await supabase.from('players').update({ company: name }).eq('vk_id', currentUser.vk_id);
    currentUser.company = name;
    toast('✅ Клан «' + name + '» создан!', 'success');
    location.reload();
}

async function leaveClan() {
    var cost = Math.floor((currentUser.hire_cost || 100) * 1.5);
    if (currentUser.experience < cost) { toast('Недостаточно опыта! Нужно ' + cost, 'error'); return; }
    await supabase.from('players').update({ experience: currentUser.experience - cost, company: null }).eq('vk_id', currentUser.vk_id);
    currentUser.experience -= cost; currentUser.company = null;
    toast('Вы вышли из клана', 'info');
    location.reload();
}

// ================= РЕФЕРАЛЬНАЯ ССЫЛКА =================
function copyInviteLink() {
    var refLink = 'https://vk.com/app' + APP_ID + '#ref_' + currentUser.vk_id;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(refLink).then(function() {
            toast('🔗 Ссылка скопирована!', 'info');
        });
    } else {
        prompt('Скопируй ссылку:', refLink);
    }
}

// ================= ОТРИСОВКА =================
function renderAll() {
    document.getElementById('header-avatar').src = currentUser.photo_200 || currentVkUser.photo_200 || 'https://vk.com/images/camera_200.png';
    document.getElementById('player-name').textContent = currentUser.first_name + ' ' + currentUser.last_name;
    document.getElementById('exp-value').textContent = currentUser.experience || 0;

    var clanEl = document.getElementById('clan-display');
    if (currentUser.company) {
        clanEl.innerHTML = '🏢 <span style="cursor:pointer;" onclick="openClanModal(\'' + currentUser.company + '\')">' + currentUser.company + '</span>';
    } else { clanEl.textContent = ''; }

    var collectPanel = document.getElementById('collect-panel');
    collectPanel.style.display = (myTeamTotal > 0) ? 'flex' : 'none';
    if (myTeamTotal > 0) {
        document.getElementById('collect-amount').textContent = currentUser.pending_experience || 0;
        document.getElementById('collect-btn').onclick = collectExperience;
    }

    var clanCard = document.getElementById('clan-card');
    var statusText = document.getElementById('status-text');
    var leaveClanBtn = document.getElementById('leave-clan-btn');
    clanCard.style.display = 'block';
    if (currentUser.company) {
        statusText.textContent = '🏢 Вы в клане: ' + currentUser.company;
        leaveClanBtn.style.display = 'block';
        leaveClanBtn.onclick = leaveClan;
    } else {
        statusText.textContent = 'Вы не состоите в клане.';
        leaveClanBtn.style.display = 'none';
    }

    document.getElementById('invite-friend-btn').onclick = copyInviteLink;

    loadMyTeam(true);
    if (currentTab === 'market') loadMarket();
    else if (currentTab === 'top') {
        if (topSubtab === 'players') loadTopPlayers();
        else loadClans();
    }
}

document.getElementById('load-more-btn').addEventListener('click', function() { loadMyTeam(false); });
