// ================= РАБОТА С БАЗОЙ ДАННЫХ =================

var lastCollectTime = 0;
var COLLECT_COOLDOWN = 60000;

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
                owner_id: null,
                status: 'Биржа труда',
                role: null
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

// Прокачка
async function upgradeEmployee(vkId) {
    var empResult = await supabase.from('players').select('*').eq('vk_id', vkId).maybeSingle();
    if(!empResult.data) return;
    var emp = empResult.data;
    var cost = (emp.level || 1) * 50;
    if((currentUser.experience || 0) < cost) { toast('Недостаточно опыта!', 'error'); return; }
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

// Увольнение
async function fireEmployee(vkId) {
    var empResult = await supabase.from('players').select('*').eq('vk_id', vkId).maybeSingle();
    if(!empResult.data) return;
    var emp = empResult.data;
    var sellPrice = Math.floor((emp.hire_cost || 100) * 0.8);
    
    await supabase.from('players').update({ experience: (currentUser.experience || 0) + sellPrice }).eq('vk_id', currentUser.vk_id);
    await supabase.from('players').update({ owner_id: null, status: 'Биржа труда', role: null }).eq('vk_id', vkId);
    currentUser.experience += sellPrice;
    toast('🔥 Уволен! +' + sellPrice + ' опыта', 'info');
    
    var empResult2 = await supabase.from('players').select('*').eq('owner_id', currentUser.vk_id).order('level', { ascending: false });
    myTeam = empResult2.data || [];
    myTeamTotal = myTeam.length;
    
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

// Нанять
async function hirePlayer(player) {
    var hireCost = player.hire_cost || 100;
    
    if((currentUser.experience || 0) < hireCost) { 
        toast('Недостаточно опыта! Нужно ' + hireCost, 'error'); 
        return; 
    }
    
    // Списываем у нанимателя
    await supabase.from('players').update({ 
        experience: Math.max(0, (currentUser.experience || 0) - hireCost) 
    }).eq('vk_id', currentUser.vk_id);
    
    // Начисляем старому владельцу
    if(player.owner_id && player.owner_id !== currentUser.vk_id) {
        var oldOwner = await supabase.from('players').select('experience').eq('vk_id', player.owner_id).maybeSingle();
        console.log('Старый владелец ДО:', oldOwner.data);
        if(oldOwner.data) {
            var newExp = (oldOwner.data.experience || 0) + hireCost;
            await supabase.from('players').update({ 
                experience: newExp 
            }).eq('vk_id', player.owner_id);
            console.log('Старый владелец ПОСЛЕ: +' + hireCost + ', стало: ' + newExp);
        }
    }
    
    // Меняем владельца
    await supabase.from('players').update({ 
        owner_id: currentUser.vk_id, 
        status: 'Работает', 
        role: 'Учёный',
        hire_cost: hireCost 
    }).eq('vk_id', player.vk_id);
    
    currentUser.experience = Math.max(0, (currentUser.experience || 0) - hireCost);
    await supabase.from('players').update({ 
        last_collect: new Date().toISOString() 
    }).eq('vk_id', currentUser.vk_id);
    currentUser.last_collect = new Date().toISOString();
    
    toast('✅ Нанят!', 'success');
    
    closePlayerModal();
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

// Уволить из модалки
async function firePlayer(player) {
    var sellPrice = Math.floor((player.hire_cost || 100) * 0.8);
    
    await supabase.from('players').update({ experience: (currentUser.experience || 0) + sellPrice }).eq('vk_id', currentUser.vk_id);
    await supabase.from('players').update({ owner_id: null, status: 'Биржа труда', role: null }).eq('vk_id', player.vk_id);
    currentUser.experience += sellPrice;
    toast('🔥 Уволен! +' + sellPrice + ' опыта', 'info');
    
    closePlayerModal();
    
    var empResult = await supabase.from('players').select('*').eq('owner_id', currentUser.vk_id).order('level', { ascending: false });
    myTeam = empResult.data || [];
    myTeamTotal = myTeam.length;
    
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

// Перекупка
async function stealEmployee(emp, stealCost) {
    if((currentUser.experience || 0) < stealCost) { 
        toast('Недостаточно опыта!', 'error'); 
        return; 
    }
    
    await supabase.from('players').update({ experience: Math.max(0, (currentUser.experience || 0) - stealCost) }).eq('vk_id', currentUser.vk_id);
    await supabase.from('players').update({ owner_id: currentUser.vk_id, hire_cost: stealCost }).eq('vk_id', emp.vk_id);
    currentUser.experience = Math.max(0, (currentUser.experience || 0) - stealCost);
    await supabase.from('players').update({ last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.last_collect = new Date().toISOString();
    
    toast('✅ Перекуплен!', 'success');
    
    closePlayerModal();
    
    var empResult = await supabase.from('players').select('*').eq('owner_id', currentUser.vk_id).order('level', { ascending: false });
    myTeam = empResult.data || [];
    myTeamTotal = myTeam.length;
    
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}
