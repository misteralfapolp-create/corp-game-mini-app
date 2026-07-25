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

// ================= ДЕЙСТВИЯ С СОТРУДНИКАМИ =================

// Прокачка — повышает ТОЛЬКО уровень
async function upgradeEmployee(vkId) {
    var empResult = await supabase.from('players').select('*').eq('vk_id', vkId).maybeSingle();
    if(!empResult.data) return;
    var emp = empResult.data;
    var cost = (emp.level || 1) * 50;
    if((currentUser.experience || 0) < cost) { toast('Недостаточно опыта! Нужно ' + cost, 'error'); return; }
    var newLevel = (emp.level || 1) + 1;
    if(newLevel > 100) { toast('Достигнут максимальный уровень!', 'info'); return; }
    
    await supabase.from('players').update({ experience: Math.max(0, (currentUser.experience || 0) - cost) }).eq('vk_id', currentUser.vk_id);
    // Меняется ТОЛЬКО уровень, стоимость НЕ меняется
    await supabase.from('players').update({ level: newLevel }).eq('vk_id', vkId);
    currentUser.experience = Math.max(0, (currentUser.experience || 0) - cost);
    await supabase.from('players').update({ last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.last_collect = new Date().toISOString();
    toast('✅ Прокачано до ур.' + newLevel + '! ' + getJobTitle(newLevel), 'success');
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

// Увольнение — повышает стоимость (×1.5), уровень не трогает
async function fireEmployee(vkId) {
    var empResult = await supabase.from('players').select('*').eq('vk_id', vkId).maybeSingle();
    if(!empResult.data) return;
    var emp = empResult.data;
    var currentCost = emp.hire_cost || 100;
    var sellPrice = Math.floor(currentCost * 0.8); // 80% от стоимости
    var newCost = Math.floor(currentCost * 1.5); // Стоимость растёт
    
    await supabase.from('players').update({ experience: (currentUser.experience || 0) + sellPrice }).eq('vk_id', currentUser.vk_id);
    // Уровень НЕ сбрасывается, стоимость повышается
    await supabase.from('players').update({ owner_id: null, status: 'Биржа труда', role: null, hire_cost: newCost }).eq('vk_id', vkId);
    currentUser.experience += sellPrice;
    toast('🔥 Уволен! +' + sellPrice + ' опыта. Стоимость выросла до ' + newCost, 'info');
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

// Нанять — стоимость растёт (×1.5), уровень не меняется, старый владелец получает бонус
async function hirePlayer(player) {
    var currentCost = player.hire_cost || 100;
    var hirePrice = currentCost; // Цена найма = текущая стоимость
    
    if((currentUser.experience || 0) < hirePrice) { toast('Недостаточно опыта! Нужно ' + hirePrice, 'error'); return; }
    
    // Списываем опыт у нанимателя
    await supabase.from('players').update({ experience: Math.max(0, (currentUser.experience || 0) - hirePrice) }).eq('vk_id', currentUser.vk_id);
    
    // Начисляем бонус старому владельцу (50% от стоимости)
    if(player.owner_id && player.owner_id !== currentUser.vk_id) {
        var bonus = Math.floor(currentCost * 0.5);
        var oldOwnerResult = await supabase.from('players').select('experience').eq('vk_id', player.owner_id).maybeSingle();
        if(oldOwnerResult.data) {
            await supabase.from('players').update({ experience: (oldOwnerResult.data.experience || 0) + bonus }).eq('vk_id', player.owner_id);
        }
    }
    
    // Стоимость растёт, уровень не меняется
    var newCost = Math.floor(currentCost * 1.5);
    await supabase.from('players').update({ owner_id: currentUser.vk_id, status: 'Работает', role: 'Учёный', hire_cost: newCost }).eq('vk_id', player.vk_id);
    
    currentUser.experience = Math.max(0, (currentUser.experience || 0) - hirePrice);
    await supabase.from('players').update({ last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.last_collect = new Date().toISOString();
    toast('✅ Нанят! Стоимость выросла до ' + newCost, 'success');
    closePlayerModal();
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

// Уволить из модалки — стоимость растёт
async function firePlayer(player) {
    var currentCost = player.hire_cost || 100;
    var sellPrice = Math.floor(currentCost * 0.8);
    var newCost = Math.floor(currentCost * 1.5);
    
    await supabase.from('players').update({ experience: (currentUser.experience || 0) + sellPrice }).eq('vk_id', currentUser.vk_id);
    await supabase.from('players').update({ owner_id: null, status: 'Биржа труда', role: null, hire_cost: newCost }).eq('vk_id', player.vk_id);
    currentUser.experience += sellPrice;
    toast('🔥 Уволен! +' + sellPrice + ' опыта', 'info');
    closePlayerModal();
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

// Перекупка — стоимость растёт (×1.5), старый владелец получает бонус
async function stealEmployee(emp, stealCost) {
    if((currentUser.experience || 0) < stealCost) { toast('Недостаточно опыта! Нужно ' + stealCost, 'error'); return; }
    
    // Начисляем бонус старому владельцу
    if(emp.owner_id && emp.owner_id !== currentUser.vk_id) {
        var bonus = Math.floor(stealCost * 0.5);
        var oldOwnerResult = await supabase.from('players').select('experience').eq('vk_id', emp.owner_id).maybeSingle();
        if(oldOwnerResult.data) {
            await supabase.from('players').update({ experience: (oldOwnerResult.data.experience || 0) + bonus }).eq('vk_id', emp.owner_id);
        }
    }
    
    var newCost = Math.floor((emp.hire_cost || 100) * 1.5);
    await supabase.from('players').update({ experience: Math.max(0, (currentUser.experience || 0) - stealCost) }).eq('vk_id', currentUser.vk_id);
    await supabase.from('players').update({ owner_id: currentUser.vk_id, hire_cost: newCost }).eq('vk_id', emp.vk_id);
    currentUser.experience = Math.max(0, (currentUser.experience || 0) - stealCost);
    await supabase.from('players').update({ last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.last_collect = new Date().toISOString();
    toast('✅ Перекуплен! Стоимость выросла до ' + newCost, 'success');
    closePlayerModal();
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}
