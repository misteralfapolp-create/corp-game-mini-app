// ================= РАБОТА С БАЗОЙ ДАННЫХ =================

var lastCollectTime = 0;
var COLLECT_COOLDOWN = 60000;

// ================= ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ЦЕНЫ =================

// Новая цена после повышения (+20%)
function getNewPrice(oldPrice) {
    return Math.floor(oldPrice * 1.2);
}

// Цена продажи (80% от текущей цены)
function getSellPrice(price) {
    return Math.floor(price * 0.8);
}

// ================= ОБНОВЛЕНИЕ СТАТИСТИКИ =================

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
        var myCost = getNewPrice(currentUser.hire_cost || 100);
        quitBtn.textContent = '🚪 Уволиться (' + myCost + ' опыта)';
        quitBtn.onclick = async function() {
            if((currentUser.experience || 0) < myCost) { toast('Недостаточно опыта!', 'error'); return; }
            var newPrice = getNewPrice(currentUser.hire_cost || 100);
            await supabase.from('players').update({
                experience: Math.max(0, (currentUser.experience || 0) - myCost),
                owner_id: null,
                status: 'Биржа труда',
                role: null,
                hire_cost: newPrice
            }).eq('vk_id', currentUser.vk_id);
            toast('Вы уволились! Цена выкупа: ' + newPrice, 'info');
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

// ПРОКАЧКА: уровень +1, цена +20%
async function upgradeEmployee(vkId) {
    var empResult = await supabase.from('players').select('*').eq('vk_id', vkId).maybeSingle();
    if(!empResult.data) return;
    var emp = empResult.data;
    var cost = (emp.level || 1) * 50;
    if((currentUser.experience || 0) < cost) { toast('Недостаточно опыта!', 'error'); return; }
    var newLevel = (emp.level || 1) + 1;
    if(newLevel > 100) { toast('Достигнут максимальный уровень!', 'info'); return; }
    
    // Новая цена (+20%)
    var newPrice = getNewPrice(emp.hire_cost || 100);
    
    await supabase.from('players').update({ experience: Math.max(0, (currentUser.experience || 0) - cost) }).eq('vk_id', currentUser.vk_id);
    await supabase.from('players').update({ 
        level: newLevel,
        hire_cost: newPrice
    }).eq('vk_id', vkId);
    
    currentUser.experience = Math.max(0, (currentUser.experience || 0) - cost);
    await supabase.from('players').update({ last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.last_collect = new Date().toISOString();
    
    var sellPrice = getSellPrice(newPrice);
    toast('✅ Прокачано до ур.' + newLevel + '! ' + getJobTitle(newLevel) + ' | Цена: ' + newPrice + ' (продажа: ' + sellPrice + ')', 'success');
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

// УВОЛЬНЕНИЕ (из списка своих сотрудников): цена +20%, уровень остаётся
async function fireEmployee(vkId) {
    var empResult = await supabase.from('players').select('*').eq('vk_id', vkId).maybeSingle();
    if(!empResult.data) return;
    var emp = empResult.data;
    var currentPrice = emp.hire_cost || 100;
    var sellPrice = getSellPrice(currentPrice);
    var newPrice = getNewPrice(currentPrice);
    
    await supabase.from('players').update({ experience: (currentUser.experience || 0) + sellPrice }).eq('vk_id', currentUser.vk_id);
    await supabase.from('players').update({ 
        owner_id: null, 
        status: 'Биржа труда', 
        role: null,
        hire_cost: newPrice  // Цена увеличивается на 20%
    }).eq('vk_id', vkId);
    
    currentUser.experience += sellPrice;
    toast('🔥 Уволен! +' + sellPrice + ' опыта | Новая цена выкупа: ' + newPrice, 'info');
    
    var empResult2 = await supabase.from('players').select('*').eq('owner_id', currentUser.vk_id).order('level', { ascending: false });
    myTeam = empResult2.data || [];
    myTeamTotal = myTeam.length;
    
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

// ================= НАНЯТЬ: цена +20%, уровень остаётся =================

async function hirePlayer(player) {
    var currentPrice = player.hire_cost || 100;
    var hireCost = currentPrice;
    var oldOwnerId = player.owner_id;
    var newPrice = getNewPrice(currentPrice);  // Новая цена для сотрудника (+20%)
    
    console.log('=== НАЙМ ===');
    console.log('Сотрудник:', player.first_name, player.vk_id);
    console.log('Старый владелец:', oldOwnerId);
    console.log('Цена найма:', hireCost);
    console.log('Новая цена сотрудника:', newPrice);
    
    // Проверка: хватает ли опыта у нанимателя
    if((currentUser.experience || 0) < hireCost) { 
        toast('Недостаточно опыта!', 'error'); 
        return; 
    }
    
    // --- 1. СПИСЫВАЕМ ОПЫТ У НАНИМАТЕЛЯ ---
    var myNewExp = Math.max(0, (currentUser.experience || 0) - hireCost);
    await supabase.from('players').update({ experience: myNewExp }).eq('vk_id', currentUser.vk_id);
    console.log('У нанимателя списано:', hireCost, 'стало:', myNewExp);
    
    // --- 2. НАЧИСЛЯЕМ ОПЫТ СТАРОМУ ВЛАДЕЛЬЦУ (ЕСЛИ ОН ЕСТЬ) ---
    if(oldOwnerId && oldOwnerId !== currentUser.vk_id) {
        var oldOwner = await supabase.from('players').select('experience').eq('vk_id', oldOwnerId).maybeSingle();
        if(oldOwner.data) {
            var oldNewExp = (oldOwner.data.experience || 0) + hireCost;
            await supabase.from('players').update({ experience: oldNewExp }).eq('vk_id', oldOwnerId);
            console.log('✅ Старому владельцу начислено:', hireCost, 'стало:', oldNewExp);
            toast('👤 Старому владельцу начислено ' + hireCost + ' опыта', 'info');
        }
    } else {
        console.log('ℹ️ У сотрудника не было владельца (безработный)');
    }
    
    // --- 3. МЕНЯЕМ ВЛАДЕЛЬЦА, ЦЕНА УВЕЛИЧИВАЕТСЯ (+20%), УРОВЕНЬ ОСТАЁТСЯ ---
    await supabase.from('players').update({ 
        owner_id: currentUser.vk_id, 
        status: 'Работает', 
        role: 'Учёный',
        hire_cost: newPrice  // Цена увеличивается на 20%
    }).eq('vk_id', player.vk_id);
    
    // Обновляем текущего пользователя
    currentUser.experience = myNewExp;
    await supabase.from('players').update({ last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    
    console.log('=== КОНЕЦ НАЙМА ===');
    
    toast('✅ ' + player.first_name + ' нанят! Новая цена: ' + newPrice, 'success');
    closePlayerModal();
    
    // Обновляем списки
    var empResult = await supabase.from('players').select('*').eq('owner_id', currentUser.vk_id).order('level', { ascending: false });
    myTeam = empResult.data || [];
    myTeamTotal = myTeam.length;
    
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
    
    // Если мы на странице биржи — обновляем её
    var marketScreen = document.getElementById('screen-market');
    if(marketScreen && marketScreen.classList.contains('active')) {
        loadMarketScreen();
    }
}

// ================= УВОЛИТЬ ИЗ МОДАЛКИ: цена +20%, уровень остаётся =================

async function firePlayer(player) {
    var currentPrice = player.hire_cost || 100;
    var sellPrice = getSellPrice(currentPrice);
    var newPrice = getNewPrice(currentPrice);
    
    await supabase.from('players').update({ experience: (currentUser.experience || 0) + sellPrice }).eq('vk_id', currentUser.vk_id);
    await supabase.from('players').update({ 
        owner_id: null, 
        status: 'Биржа труда', 
        role: null,
        hire_cost: newPrice  // Цена увеличивается на 20%
    }).eq('vk_id', player.vk_id);
    
    currentUser.experience += sellPrice;
    toast('🔥 Уволен! +' + sellPrice + ' опыта | Новая цена выкупа: ' + newPrice, 'info');
    
    closePlayerModal();
    
    var empResult = await supabase.from('players').select('*').eq('owner_id', currentUser.vk_id).order('level', { ascending: false });
    myTeam = empResult.data || [];
    myTeamTotal = myTeam.length;
    
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

// ================= ПЕРЕКУПКА: цена +20%, уровень остаётся =================

async function stealEmployee(emp, stealCost) {
    var currentPrice = emp.hire_cost || 100;
    var newPrice = getNewPrice(currentPrice);  // Новая цена после перекупки
    
    if((currentUser.experience || 0) < stealCost) { 
        toast('Недостаточно опыта!', 'error'); 
        return; 
    }
    
    // Списываем у нанимателя
    await supabase.from('players').update({ experience: Math.max(0, (currentUser.experience || 0) - stealCost) }).eq('vk_id', currentUser.vk_id);
    
    // Начисляем старому владельцу
    if(emp.owner_id && emp.owner_id !== currentUser.vk_id) {
        var oldOwner = await supabase.from('players').select('experience').eq('vk_id', emp.owner_id).maybeSingle();
        if(oldOwner.data) {
            var oldNewExp = (oldOwner.data.experience || 0) + stealCost;
            await supabase.from('players').update({ experience: oldNewExp }).eq('vk_id', emp.owner_id);
            toast('👤 Старому владельцу начислено ' + stealCost + ' опыта', 'info');
        }
    }
    
    // Меняем владельца, цена увеличивается на 20%
    await supabase.from('players').update({ 
        owner_id: currentUser.vk_id, 
        hire_cost: newPrice
    }).eq('vk_id', emp.vk_id);
    
    currentUser.experience = Math.max(0, (currentUser.experience || 0) - stealCost);
    await supabase.from('players').update({ last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.last_collect = new Date().toISOString();
    
    toast('✅ Перекуплен! Новая цена: ' + newPrice, 'success');
    
    closePlayerModal();
    
    var empResult = await supabase.from('players').select('*').eq('owner_id', currentUser.vk_id).order('level', { ascending: false });
    myTeam = empResult.data || [];
    myTeamTotal = myTeam.length;
    
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}
