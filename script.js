// ================= НАСТРОЙКИ =================
var SUPABASE_URL = 'https://fcrjkfiodvfhzamayvoe.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjcmprZmlvZHZmaHphbWF5dm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTcwMTQsImV4cCI6MjA5OTY5MzAxNH0.C3Ls4QMoYWnFciuOURZ7-WLmGa4TWtBsedhURVNulKI';
var APP_ID = '54679388';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
var currentUser = null, currentVkUser = null, currentTab = 'my-team';

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
        
        // Не нанимаем себя
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
    var empResult = await supabase.from('players').select('income_per_hour').eq('owner_id', currentUser.vk_id);
    var count = empResult.data ? empResult.data.length : 0;
    var income = 0;
    if (empResult.data) empResult.data.forEach(function(e) { income += (e.income_per_hour || 0); });
    document.getElementById('my-employees-count').textContent = count;
    document.getElementById('my-income').textContent = '+' + income;
}

async function collectExperience() {
    if (!currentUser.pending_experience) { alert('Нечего собирать!'); return; }
    var collected = currentUser.pending_experience;
    await supabase.from('players').update({ experience: (currentUser.experience || 0) + collected, pending_experience: 0, last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.experience += collected; currentUser.pending_experience = 0;
    alert('✅ +' + collected + ' опыта!'); renderAll();
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
    if (tab === 'my-team') loadMyTeam();
    else if (tab === 'market') loadMarket();
    else if (tab === 'players') loadTopPlayers();
    else if (tab === 'clans') loadClans();
}

// ================= МОЯ КОМАНДА (с увольнением) =================
async function loadMyTeam() {
    var content = document.getElementById('tab-content');
    content.innerHTML = 'Загрузка...';
    var result = await supabase.from('players').select('*').eq('owner_id', currentUser.vk_id).order('experience', { ascending: false });
    if (result.error) { content.innerHTML = 'Ошибка'; return; }
    var team = result.data;
    if (!team.length) { content.innerHTML = '<p style="color:#888;">У вас нет сотрудников. Наймите на бирже!</p>'; return; }
    content.innerHTML = '<div class="section-title">👥 Моя команда</div>';
    team.forEach(function(emp) {
        var cost = Math.floor(emp.hire_cost || 100);
        var upgradeCost = Math.floor(cost * 1.5);
        var fireIncome = Math.floor(cost * 0.8); // увольнение даёт 80% стоимости

        var div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = 
            '<img src="' + (emp.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'">' +
            '<div class="info"><div style="font-weight:bold;">' + emp.first_name + ' ' + emp.last_name + '<span class="lvl">Ур.' + (emp.level || 1) + '</span></div>' +
            '<div style="font-size:12px;color:#888;">🔬 +' + (emp.income_per_hour || 0) + ' оп/час • 💰' + cost + '</div></div>' +
            '<div class="btn-group">' +
                '<button class="btn-upgrade" data-id="' + emp.vk_id + '">⬆<br><span class="cost">' + upgradeCost + '</span></button>' +
                '<button class="btn-fire" data-id="' + emp.vk_id + '">🔥<br><span class="cost">+' + fireIncome + '</span></button>' +
            '</div>';
        content.appendChild(div);
    });

    // Прокачка
    document.querySelectorAll('.btn-upgrade').forEach(function(btn) {
        btn.onclick = async function() {
            var empId = parseInt(this.getAttribute('data-id'));
            var emp = team.find(function(e) { return e.vk_id === empId; });
            var cost = Math.floor((emp.hire_cost || 100) * 1.5);
            if (currentUser.experience < cost) { alert('Недостаточно опыта! Нужно ' + cost); return; }
            if (!confirm('Прокачать до ур.' + ((emp.level || 1) + 1) + ' за ' + cost + ' опыта?')) return;
            await supabase.from('players').update({ experience: currentUser.experience - cost }).eq('vk_id', currentUser.vk_id);
            var newCost = Math.floor((emp.hire_cost || 100) * 1.5);
            await supabase.from('players').update({ level: (emp.level || 1) + 1, income_per_hour: (emp.income_per_hour || 0) + 1, hire_cost: newCost }).eq('vk_id', empId);
            currentUser.experience -= cost;
            alert('✅ Прокачано!'); loadMyTeam(); renderAll();
        };
    });

    // Увольнение
    document.querySelectorAll('.btn-fire').forEach(function(btn) {
        btn.onclick = async function() {
            var empId = parseInt(this.getAttribute('data-id'));
            var emp = team.find(function(e) { return e.vk_id === empId; });
            var fireIncome = Math.floor((emp.hire_cost || 100) * 0.8);
            if (!confirm('Уволить ' + emp.first_name + '?\nВы получите +' + fireIncome + ' опыта.')) return;
            await supabase.from('players').update({ experience: (currentUser.experience || 0) + fireIncome }).eq('vk_id', currentUser.vk_id);
            await supabase.from('players').update({ owner_id: null, status: 'Биржа труда', role: null, income_per_hour: 0, level: 1, hire_cost: 100 }).eq('vk_id', empId);
            currentUser.experience += fireIncome;
            alert('✅ Уволен! Получено +' + fireIncome + ' опыта.');
            loadMyTeam(); renderAll();
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
    if (!jobless.length) { content.innerHTML = '<p style="color:#888;">Биржа пуста.</p>'; return; }
    content.innerHTML = '<div class="section-title">🏪 Биржа труда</div>';
    jobless.forEach(function(p) {
        var hireCost = 100;
        var div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = 
            '<img src="' + (p.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'">' +
            '<div class="info"><div style="font-weight:bold;">' + p.first_name + ' ' + p.last_name + '</div>' +
            '<div style="font-size:12px;color:#888;">⭐' + (p.experience || 0) + '</div></div>' +
            '<button class="btn-hire" data-id="' + p.vk_id + '">Нанять<br><span class="cost">' + hireCost + ' оп</span></button>';
        content.appendChild(div);
    });
    document.querySelectorAll('.btn-hire').forEach(function(btn) {
        btn.onclick = async function() {
            var empId = parseInt(this.getAttribute('data-id'));
            if (currentUser.experience < 100) { alert('Недостаточно опыта!'); return; }
            if (!confirm('Нанять за 100 опыта?')) return;
            await supabase.from('players').update({ experience: currentUser.experience - 100 }).eq('vk_id', currentUser.vk_id);
            await supabase.from('players').update({ owner_id: currentUser.vk_id, status: 'Работает', role: 'Учёный', income_per_hour: 1, level: 1, hire_cost: 100 }).eq('vk_id', empId);
            currentUser.experience -= 100;
            alert('✅ Нанят!'); loadMarket(); renderAll();
        };
    });
}

// ================= ТОП-100 =================
async function loadTopPlayers() {
    var content = document.getElementById('tab-content');
    content.innerHTML = 'Загрузка...';
    var result = await supabase.from('players').select('*').order('experience', { ascending: false }).limit(100);
    if (result.error) { content.innerHTML = 'Ошибка'; return; }
    content.innerHTML = '<div class="section-title">🏆 Топ-100 игроков (нажми для просмотра команды)</div>';
    result.data.forEach(function(p, i) {
        var rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
        var isMe = (p.vk_id === currentUser.vk_id);
        var div = document.createElement('div');
        div.className = 'player-item clickable';
        div.style.background = isMe ? '#e8f5e9' : '';
        div.innerHTML = 
            '<div class="rank ' + rankClass + '">' + (i + 1) + '</div>' +
            '<img src="' + (p.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'">' +
            '<div class="info"><div style="font-weight:bold;">' + p.first_name + ' ' + p.last_name + (isMe ? ' ⭐' : '') + '</div>' +
            '<div style="font-size:12px;color:#888;">⭐' + (p.experience || 0) + ' • 👥' + (p.owner_id ? 'Команда' : 'Одиночка') + '</div></div>';
        div.onclick = function() { openPlayerModal(p); };
        content.appendChild(div);
    });
}

// ================= МОДАЛКА ИГРОКА =================
function openPlayerModal(player) {
    document.getElementById('player-modal').style.display = 'flex';
    document.getElementById('modal-player-name').textContent = player.first_name + ' ' + player.last_name;
    supabase.from('players').select('*').eq('owner_id', player.vk_id).order('experience', { ascending: false }).then(function(result) {
        var list = document.getElementById('modal-player-employees');
        if (!result.data || !result.data.length) {
            document.getElementById('modal-player-stats').textContent = '⭐' + (player.experience || 0) + ' • Нет сотрудников';
            list.innerHTML = '<p style="color:#888;">Нет сотрудников.</p>';
        } else {
            document.getElementById('modal-player-stats').textContent = '⭐' + (player.experience || 0) + ' • 👥 ' + result.data.length + ' сотрудников';
            list.innerHTML = '';
            result.data.forEach(function(emp) {
                var stealCost = Math.floor((emp.hire_cost || 100) * 1.5);
                var div = document.createElement('div');
                div.className = 'player-item';
                div.innerHTML = 
                    '<img src="' + (emp.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'">' +
                    '<div class="info"><div style="font-weight:bold;">' + emp.first_name + ' ' + emp.last_name + '<span class="lvl">Ур.' + (emp.level || 1) + '</span></div>' +
                    '<div style="font-size:12px;color:#888;">🔬 +' + (emp.income_per_hour || 0) + ' оп/час • 💰' + (emp.hire_cost || 100) + '</div></div>';
                if (emp.owner_id !== currentUser.vk_id && emp.vk_id !== currentUser.vk_id) {
                    var btn = document.createElement('button');
                    btn.className = 'btn-steal';
                    btn.innerHTML = 'Перекупить<br><span class="cost">' + stealCost + ' оп</span>';
                    btn.onclick = async function(e) {
                        e.stopPropagation();
                        if (currentUser.experience < stealCost) { alert('Недостаточно опыта!'); return; }
                        if (!confirm('Перекупить ' + emp.first_name + ' за ' + stealCost + '?')) return;
                        await supabase.from('players').update({ experience: currentUser.experience - stealCost }).eq('vk_id', currentUser.vk_id);
                        await supabase.from('players').update({ owner_id: currentUser.vk_id, hire_cost: stealCost }).eq('vk_id', emp.vk_id);
                        currentUser.experience -= stealCost;
                        alert('✅ Перекуплен!'); closePlayerModal(); renderAll();
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
    content.innerHTML = '<div class="section-title">🏢 Кланы</div>';
    if (!sorted.length) { content.innerHTML += '<p style="color:#888;">Кланов нет.</p>'; }
    sorted.forEach(function(c, i) {
        var isMyClan = (c.name === currentUser.company);
        var div = document.createElement('div');
        div.className = 'player-item clickable';
        div.style.background = isMyClan ? '#e8f5e9' : '';
        div.innerHTML = 
            '<div style="font-weight:bold;width:25px;">' + (i + 1) + '.</div>' +
            '<div class="info"><div style="font-weight:bold;">' + c.name + (isMyClan ? ' ⭐' : '') + '</div>' +
            '<div style="font-size:12px;color:#888;">👥 ' + c.count + ' участников</div></div>';
        div.onclick = function() { openClanModal(c.name); };
        content.appendChild(div);
    });
    if (!currentUser.company) {
        var btn = document.createElement('button');
        btn.className = 'btn-create';
        btn.textContent = '🚀 Создать свой клан';
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
            div.className = 'player-item';
            div.innerHTML = 
                '<img src="' + (p.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'">' +
                '<div class="info"><div style="font-weight:bold;">' + p.first_name + ' ' + p.last_name + '</div>' +
                '<div style="font-size:12px;color:#888;">⭐' + (p.experience || 0) + '</div></div>';
            list.appendChild(div);
        });
        var joinBtn = document.getElementById('modal-join-btn');
        var leaveBtn = document.getElementById('modal-leave-btn');
        joinBtn.style.display = 'none'; leaveBtn.style.display = 'none';
        if (currentUser.company === clanName) {
            leaveBtn.style.display = 'block';
            var cost = Math.floor((currentUser.hire_cost || 100) * 1.5);
            leaveBtn.textContent = '🚪 Выйти из клана (' + cost + ' опыта)';
            leaveBtn.onclick = async function() {
                if (currentUser.experience < cost) { alert('Недостаточно опыта!'); return; }
                if (!confirm('Выйти из клана за ' + cost + ' опыта?')) return;
                await supabase.from('players').update({ experience: currentUser.experience - cost, company: null }).eq('vk_id', currentUser.vk_id);
                currentUser.experience -= cost; currentUser.company = null;
                closeClanModal(); renderAll(); location.reload();
            };
        } else {
            joinBtn.style.display = 'block';
            joinBtn.textContent = '✅ Вступить в клан (бесплатно)';
            joinBtn.onclick = async function() {
                if (!confirm('Вступить в клан «' + clanName + '»?')) return;
                await supabase.from('players').update({ company: clanName }).eq('vk_id', currentUser.vk_id);
                currentUser.company = clanName;
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
    alert('✅ Клан «' + name + '» создан!'); location.reload();
}

async function leaveClan() {
    var cost = Math.floor((currentUser.hire_cost || 100) * 1.5);
    if (currentUser.experience < cost) { alert('Недостаточно опыта!'); return; }
    if (!confirm('Выйти из клана за ' + cost + ' опыта?')) return;
    await supabase.from('players').update({ experience: currentUser.experience - cost, company: null }).eq('vk_id', currentUser.vk_id);
    currentUser.experience -= cost; currentUser.company = null;
    location.reload();
}

// =================
