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
            if((currentUser.experience || 0) < myCost) { 
                toast('Недостаточно опыта!', 'error'); 
                return; 
            }
            var newExp = Math.max(0, (currentUser.experience || 0) - myCost);
            var newCost = Math.floor((currentUser.hire_cost || 100) * 1.5);
            
            await supabase.from('players').update({
                experience: newExp,
                owner_id: null,
                status: 'Биржа труда',
                role: null,
                hire_cost: newCost
            }).eq('vk_id', currentUser.vk_id);
            
            currentUser.experience = newExp;
            currentUser.owner_id = null;
            currentUser.status = 'Биржа труда';
            currentUser.role = null;
            currentUser.hire_cost = newCost;
            
            toast('✅ Вы уволились! Новая цена на бирже: ' + newCost, 'success');
            
            await updateAllStats();
            renderAll();
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
    showCollectChoice(collected);
}

function showCollectChoice(amount) {
    var modal = document.getElementById('input-modal');
    document.getElementById('input-modal-title').textContent = '💰 Собрать ' + amount + ' опыта';
    
    var input = document.getElementById('input-modal-input');
    input.style.display = 'none';
    
    var buttonsContainer = input.parentNode;
    var oldBtns = document.getElementById('collect-choice-btns');
    if(oldBtns) oldBtns.remove();
    
    var choiceDiv = document.createElement('div');
    choiceDiv.id = 'collect-choice-btns';
    choiceDiv.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin:10px 0;';
    
    var btnNormal = document.createElement('button');
    btnNormal.className = 'btn-collect';
    btnNormal.textContent = '✅ Собрать ' + amount + ' опыта';
    btnNormal.style.width = '100%';
    btnNormal.onclick = function() {
        modal.style.display = 'none';
        doCollect(amount, false);
    };
    choiceDiv.appendChild(btnNormal);
    
    var btnMultiplier = document.createElement('button');
    btnMultiplier.className = 'btn-collect';
    btnMultiplier.style.background = 'linear-gradient(135deg,#ff9800,#f57c00)';
    btnMultiplier.textContent = '🎬 x1.5 (' + Math.floor(amount * 1.5) + ' опыта) за рекламу';
    btnMultiplier.style.width = '100%';
    btnMultiplier.onclick = function() {
        modal.style.display = 'none';
        showRewardedAdForCollect(amount);
    };
    choiceDiv.appendChild(btnMultiplier);
    
    buttonsContainer.insertBefore(choiceDiv, document.getElementById('input-modal-ok').parentNode);
    
    document.getElementById('input-modal-ok').style.display = 'none';
    document.getElementById('input-modal-cancel').textContent = '❌ Отмена';
    document.getElementById('input-modal-cancel').onclick = function() {
        modal.style.display = 'none';
        var old = document.getElementById('collect-choice-btns');
        if(old) old.remove();
        input.style.display = 'block';
        document.getElementById('input-modal-ok').style.display = 'block';
        document.getElementById('input-modal-cancel').textContent = 'Отмена';
    };
    
    modal.style.display = 'flex';
}

async function doCollect(amount, isMultiplied) {
    var collected = isMultiplied ? Math.floor(amount * 1.5) : amount;
    lastCollectTime = Date.now();
    
    await supabase.from('players').update({ 
        experience: (currentUser.experience || 0) + collected, 
        pending_experience: 0, 
        last_collect: new Date().toISOString() 
    }).eq('vk_id', currentUser.vk_id);
    
    currentUser.experience += collected;
    currentUser.pending_experience = 0;
    
    if (typeof updateDailyTask === 'function') {
        updateDailyTask('collect', 1);
    }
    
    var msg = isMultiplied ? '🔥 x1.5! ' : '';
    toast('✅ ' + msg + '+' + collected + ' опыта!', 'success');
    renderAll();
}

async function showRewardedAdForCollect(amount) {
    try {
        console.log('Проверяем готовность рекламы для сбора...');
        var checkResult = await vkBridge.send('VKWebAppCheckNativeAds', {
            ad_format: 'reward'
        });
        console.log('Результат проверки:', checkResult);
        
        if (!checkResult || !checkResult.result) {
            toast('📡 Реклама ещё не загружена, попробуйте через несколько секунд', 'info');
            showCollectChoice(amount);
            return;
        }
        
        console.log('✅ Реклама готова, показываем...');
        
    } catch(e) {
        console.error('Ошибка проверки рекламы:', e);
        toast('📡 Ошибка проверки рекламы', 'error');
        showCollectChoice(amount);
        return;
    }
    
    try {
        var result = await vkBridge.send('VKWebAppShowNativeAds', {
            ad_format: 'rewarded'
        });
        
        console.log('Результат показа рекламы:', result);
        
        if(result && result.result === true) {
            doCollect(amount, true);
        } else {
            toast('Реклама не загружена', 'error');
            showCollectChoice(amount);
        }
    } catch(e) {
        console.error('Ошибка показа рекламы:', e);
        toast('Реклама не загружена', 'error');
        showCollectChoice(amount);
    }
}

async function giveReferralBonus(id) {
    var r = await supabase.from('players').select('experience').eq('vk_id', id).maybeSingle();
    if(r.data) await supabase.from('players').update({ experience: (r.data.experience || 0) + 500 }).eq('vk_id', id);
}

async function upgradeEmployee(vkId) {
    var empResult = await supabase.from('players').select('*').eq('vk_id', vkId).maybeSingle();
    if(!empResult.data) return;
    var emp = empResult.data;
    
    var cost = (emp.level || 1) * 50;
    if((currentUser.experience || 0) < cost) { 
        toast('Недостаточно опыта!', 'error'); 
        return; 
    }
    
    var newLevel = (emp.level || 1) + 1;
    if(newLevel > 100) { 
        toast('Достигнут максимальный уровень!', 'info'); 
        return; 
    }
    
    var newCost = newLevel * 50;
    
    await supabase.from('players').update({ 
        experience: Math.max(0, (currentUser.experience || 0) - cost) 
    }).eq('vk_id', currentUser.vk_id);
    currentUser.experience = Math.max(0, (currentUser.experience || 0) - cost);
    
    await supabase.from('players').update({ 
        level: newLevel,
        hire_cost: newCost
    }).eq('vk_id', vkId);
    
    if (typeof updateDailyTask === 'function') {
        updateDailyTask('upgrade', 1);
    }
    
    toast('✅ Прокачан до ур.' + newLevel + '! ' + getJobTitle(newLevel) + ' | Цена: ' + newCost + ' опыта', 'success');
    
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

async function fireEmployee(vkId) {
    var empResult = await supabase.from('players').select('*').eq('vk_id', vkId).maybeSingle();
    if(!empResult.data) return;
    var emp = empResult.data;
    var sellPrice = Math.floor((emp.hire_cost || 100) * 0.8);
    var newCost = Math.floor((emp.hire_cost || 100) * 1.5);
    
    await supabase.from('players').update({ 
        experience: (currentUser.experience || 0) + sellPrice 
    }).eq('vk_id', currentUser.vk_id);
    currentUser.experience += sellPrice;
    
    await supabase.from('players').update({ 
        owner_id: null, 
        status: 'Биржа труда', 
        role: null,
        hire_cost: newCost
    }).eq('vk_id', vkId);
    
    toast('🔥 Уволен! +' + sellPrice + ' опыта | Новая цена на бирже: ' + newCost, 'info');
    
    var empResult2 = await supabase.from('players').select('*').eq('owner_id', currentUser.vk_id).order('level', { ascending: false });
    myTeam = empResult2.data || [];
    myTeamTotal = myTeam.length;
    
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

async function hirePlayer(player) {
    var hireCost = player.hire_cost || 100;
    
    console.log('=== НАЙМ ===');
    console.log('Сотрудник:', player.first_name, player.vk_id);
    console.log('Старый владелец:', player.owner_id);
    console.log('Стоимость:', hireCost);
    
    if((currentUser.experience || 0) < hireCost) { 
        toast('Недостаточно опыта!', 'error'); 
        return; 
    }
    
    var myNewExp = Math.max(0, (currentUser.experience || 0) - hireCost);
    await supabase.from('players').update({ experience: myNewExp }).eq('vk_id', currentUser.vk_id);
    console.log('У нанимателя списано:', hireCost, 'стало:', myNewExp);
    
    if(player.owner_id && player.owner_id !== currentUser.vk_id) {
        var oldOwner = await supabase.from('players').select('experience').eq('vk_id', player.owner_id).maybeSingle();
        if(oldOwner.data) {
            var oldNewExp = (oldOwner.data.experience || 0) + hireCost;
            await supabase.from('players').update({ experience: oldNewExp }).eq('vk_id', player.owner_id);
            console.log('Старому владельцу начислено:', hireCost, 'стало:', oldNewExp);
        }
    }
    
    // ✅ Новая цена = старая цена × 1.5
    var newCost = Math.floor((player.hire_cost || 100) * 1.5);
    
    await supabase.from('players').update({ 
        owner_id: currentUser.vk_id, 
        status: 'Работает', 
        role: 'Учёный',
        hire_cost: newCost
    }).eq('vk_id', player.vk_id);
    
    currentUser.experience = myNewExp;
    await supabase.from('players').update({ last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    
    console.log('=== КОНЕЦ НАЙМА ===');
    
    if (typeof updateDailyTask === 'function') {
        updateDailyTask('hire', 1);
    }
    
    toast('✅ Нанят за ' + hireCost + ' опыта! Новая цена: ' + newCost, 'success');
    
    closePlayerModal();
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

async function firePlayer(player) {
    var sellPrice = Math.floor((player.hire_cost || 100) * 0.8);
    var newCost = Math.floor((player.hire_cost || 100) * 1.5);
    
    await supabase.from('players').update({ 
        experience: (currentUser.experience || 0) + sellPrice 
    }).eq('vk_id', currentUser.vk_id);
    currentUser.experience += sellPrice;
    
    await supabase.from('players').update({ 
        owner_id: null, 
        status: 'Биржа труда', 
        role: null,
        hire_cost: newCost
    }).eq('vk_id', player.vk_id);
    
    toast('🔥 Уволен! +' + sellPrice + ' опыта | Новая цена на бирже: ' + newCost, 'info');
    
    closePlayerModal();
    
    var empResult = await supabase.from('players').select('*').eq('owner_id', currentUser.vk_id).order('level', { ascending: false });
    myTeam = empResult.data || [];
    myTeamTotal = myTeam.length;
    
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}

async function stealEmployee(emp, stealCost) {
    if((currentUser.experience || 0) < stealCost) { 
        toast('Недостаточно опыта!', 'error'); 
        return; 
    }
    
    await supabase.from('players').update({ 
        experience: Math.max(0, (currentUser.experience || 0) - stealCost) 
    }).eq('vk_id', currentUser.vk_id);
    currentUser.experience = Math.max(0, (currentUser.experience || 0) - stealCost);
    
    await supabase.from('players').update({ 
        owner_id: currentUser.vk_id, 
        hire_cost: stealCost 
    }).eq('vk_id', emp.vk_id);
    
    await supabase.from('players').update({ 
        last_collect: new Date().toISOString() 
    }).eq('vk_id', currentUser.vk_id);
    currentUser.last_collect = new Date().toISOString();
    
    toast('✅ Перекуплен за ' + stealCost + ' опыта!', 'success');
    
    closePlayerModal();
    
    var empResult = await supabase.from('players').select('*').eq('owner_id', currentUser.vk_id).order('level', { ascending: false });
    myTeam = empResult.data || [];
    myTeamTotal = myTeam.length;
    
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}
