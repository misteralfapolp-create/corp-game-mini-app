// ================= РАБОТА С БАЗОЙ ДАННЫХ =================

var lastCollectTime = 0;
var COLLECT_COOLDOWN = 60000; // 60 секунд

// Обновление статистики
async function updateAllStats() {
    var empResult = await supabase.from('players').select('*').eq('owner_id', currentUser.vk_id).order('level', { ascending: false });
    myTeam = empResult.data || [];
    myTeamTotal = myTeam.length;
    
    var totalIncome = 0;
    myTeam.forEach(function(e){ totalIncome += (e.level || 1); });
    if(currentUser.owner_id && currentUser.owner_id !== currentUser.vk_id) totalIncome = Math.floor(totalIncome / 2);
    
    document.getElementById('my-employees-count').textContent = myTeamTotal;
    document.getElementById('my-income').textContent = '+' + totalIncome;
    document.getElementById('my-team-total').textContent = myTeamTotal;
    
    var ava = document.getElementById('header-avatar');
    var quitBtn = document.getElementById('quit-job-btn');
    var ownerInfo = document.getElementById('owner-info');
    
    if(currentUser.owner_id && currentUser.owner_id !== currentUser.vk_id) {
        ava.classList.add('hired');
        quitBtn.style.display = 'block';
        var myCost = (currentUser.level || 1) * 50;
        quitBtn.textContent = '🚪 Уволиться (' + myCost + ' опыта)';
        quitBtn.onclick = async function() {
            if((currentUser.experience || 0) < myCost) { toast('Недостаточно опыта!', 'error'); return; }
            await supabase.from('players').update({
                experience: Math.max(0, (currentUser.experience || 0) - myCost),
                owner_id: null, status: 'Биржа труда', role: null
            }).eq('vk_id', currentUser.vk_id);
            toast('Вы уволились!', 'info');
            location.reload();
        };
        var owner = await supabase.from('players').select('first_name,last_name,vk_id').eq('vk_id', currentUser.owner_id).maybeSingle();
        if(owner.data) ownerInfo.innerHTML = '🔒 Нанят: <b onclick="openPlayerModalById(' + owner.data.vk_id + ')" style="cursor:pointer;text-decoration:underline;">' + owner.data.first_name + ' ' + owner.data.last_name + '</b>';
    } else {
        ava.classList.remove('hired');
        quitBtn.style.display = 'none';
        ownerInfo.textContent = '';
    }
    await calculatePendingExperience();
}

async function calculatePendingExperience() {
    if(!myTeam.length) return;
    var totalPerHour = 0;
    myTeam.forEach(function(e){ totalPerHour += (e.level || 1); });
    if(currentUser.owner_id && currentUser.owner_id !== currentUser.vk_id) totalPerHour = Math.floor(totalPerHour / 2);
    var hoursPassed = (new Date() - new Date(currentUser.last_collect || new Date())) / 3600000;
    var newPending = Math.floor((currentUser.pending_experience || 0) + totalPerHour * hoursPassed);
    await supabase.from('players').update({ pending_experience: newPending, last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.pending_experience = newPending;
}

// Сбор опыта с кулдауном
async function collectExperience() {
    var now = Date.now();
    if(now - lastCollectTime < COLLECT_COOLDOWN) {
        var wait = Math.ceil((COLLECT_COOLDOWN - (now - lastCollectTime)) / 1000);
        toast('⏳ Подождите ' + wait + ' сек.', 'info');
        return;
    }
    if(!currentUser.pending_experience) { toast('Нечего собирать', 'info'); return; }
    var collected = currentUser.pending_experience;
    lastCollectTime = now;
    await supabase.from('players').update({ experience: (currentUser.experience || 0) + collected, pending_experience: 0, last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.experience += collected;
    currentUser.pending_experience = 0;
    toast('✅ +' + collected + ' опыта!', 'success');
    renderAll();
}

async function giveReferralBonus(id) {
    var r = await supabase.from('players').select('experience').eq('vk_id', id).maybeSingle();
    if(r.data) await supabase.from('players').update({ experience: (r.data.experience || 0) + 500 }).eq('vk_id', id);
}

// Прокачка сотрудника
async function upgradeEmployee(vkId) {
    var empResult = await supabase.from('players').select('*').eq('vk_id', vkId).maybeSingle();
    if(!empResult.data) return;
    var emp = empResult.data;
    var cost = (emp.level || 1) * 50;
    if((currentUser.experience || 0) < cost) { toast('Недостаточно опыта! Нужно ' + cost, 'error'); return; }
    var newLevel = (emp.level || 1) + 1;
    if(newLevel > 100) { toast('Достигнут максимальный уровень!', 'info'); return; }
    
    await supabase.from('players').update({ experience: Math.max(0, (currentUser.experience || 0) - cost) }).eq('vk_id', currentUser.vk_id);
    await supabase.from('players').update({ level: newLevel }).eq('vk_id', vkId);
    currentUser.experience = Math.max(0, (currentUser.experience || 0) - cost);
    await supabase.from('players').update({ last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.last_collect = new Date().toISOString();
    toast('✅ Прокачано до ур.' + newLevel + '! ' + getJobTitle(newLevel), 'success');
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

// Увольнение сотрудника
async function fireEmployee(vkId) {
    var empResult = await supabase.from('players').select('*').eq('vk_id', vkId).maybeSingle();
    if(!empResult.data) return;
    var emp = empResult.data;
    var sellPrice = Math.floor((emp.level || 1) * 40);
    
    await supabase.from('players').update({ experience: (currentUser.experience || 0) + sellPrice }).eq('vk_id', currentUser.vk_id);
    // Уровень НЕ сбрасывается, стоимость НЕ меняется
    await supabase.from('players').update({ owner_id: null, status: 'Биржа труда', role: null }).eq('vk_id', vkId);
    currentUser.experience += sellPrice;
    toast('🔥 Уволен! +' + sellPrice + ' опыта. Уровень сохранён (' + (emp.level || 1) + ')', 'info');
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

// Нанять игрока — начисляет опыт владельцу
async function hirePlayer(player) {
    var cost = (player.level || 1) * 50;
    if((currentUser.experience || 0) < cost) { toast('Недостаточно опыта! Нужно ' + cost, 'error'); return; }
    
    // Списываем опыт у нанимателя
    await supabase.from('players').update({ experience: Math.max(0, (currentUser.experience || 0) - cost) }).eq('vk_id', currentUser.vk_id);
    
    // Начисляем опыт старому владельцу (если был)
    if(player.owner_id && player.owner_id !== currentUser.vk_id) {
        var oldOwnerResult = await supabase.from('players').select('experience').eq('vk_id', player.owner_id).maybeSingle();
        if(oldOwnerResult.data) {
            var bonus = Math.floor(cost * 0.5);
            await supabase.from('players').update({ experience: (oldOwnerResult.data.experience || 0) + bonus }).eq('vk_id', player.owner_id);
        }
    }
    
    // Меняем владельца (уровень и стоимость НЕ меняем)
    await supabase.from('players').update({ owner_id: currentUser.vk_id, status: 'Работает', role: 'Учёный' }).eq('vk_id', player.vk_id);
    currentUser.experience = Math.max(0, (currentUser.experience || 0) - cost);
    await supabase.from('players').update({ last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.last_collect = new Date().toISOString();
    toast('✅ Нанят! Старый владелец получил бонус', 'success');
    closePlayerModal();
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

// Уволить игрока (из модалки)
async function firePlayer(player) {
    var sellPrice = Math.floor((player.level || 1) * 40);
    await supabase.from('players').update({ experience: (currentUser.experience || 0) + sellPrice }).eq('vk_id', currentUser.vk_id);
    await supabase.from('players').update({ owner_id: null, status: 'Биржа труда', role: null }).eq('vk_id', player.vk_id);
    currentUser.experience += sellPrice;
    toast('🔥 Уволен! +' + sellPrice + ' опыта', 'info');
    closePlayerModal();
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

// Перекупить сотрудника
async function stealEmployee(emp, stealCost) {
    if((currentUser.experience || 0) < stealCost) { toast('Недостаточно опыта! Нужно ' + stealCost, 'error'); return; }
    
    // Начисляем опыт старому владельцу
    if(emp.owner_id && emp.owner_id !== currentUser.vk_id) {
        var oldOwnerResult = await supabase.from('players').select('experience').eq('vk_id', emp.owner_id).maybeSingle();
        if(oldOwnerResult.data) {
            var bonus = Math.floor(stealCost * 0.5);
            await supabase.from('players').update({ experience: (oldOwnerResult.data.experience || 0) + bonus }).eq('vk_id', emp.owner_id);
        }
    }
    
    await supabase.from('players').update({ experience: Math.max(0, (currentUser.experience || 0) - stealCost) }).eq('vk_id', currentUser.vk_id);
    await supabase.from('players').update({ owner_id: currentUser.vk_id }).eq('vk_id', emp.vk_id);
    currentUser.experience = Math.max(0, (currentUser.experience || 0) - stealCost);
    await supabase.from('players').update({ last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.last_collect = new Date().toISOString();
    toast('✅ Перекуплен! Старый владелец получил бонус', 'success');
    closePlayerModal();
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}
