// ================= РАБОТА С БАЗОЙ ДАННЫХ =================

async function updateAllStats() {
    var empResult = await supabase.from('players').select('*').eq('owner_id', currentUser.vk_id).order('experience', { ascending: false });
    myTeam = empResult.data || [];
    myTeamTotal = myTeam.length;
    
    var totalIncome = 0;
    myTeam.forEach(function(e){ totalIncome += (e.income_per_hour || 0); });
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
        var myCost = currentUser.hire_cost || 100;
        quitBtn.textContent = '🚪 Уволиться (' + myCost + ' опыта)';
        quitBtn.onclick = async function() {
            if((currentUser.experience || 0) < myCost) { toast('Недостаточно опыта!', 'error'); return; }
            var newSelfCost = Math.floor((currentUser.hire_cost || 100) * 1.5);
            await supabase.from('players').update({
                experience: Math.max(0, (currentUser.experience || 0) - myCost),
                owner_id: null, status: 'Биржа труда', role: null, income_per_hour: 0, level: 1, hire_cost: newSelfCost
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
    myTeam.forEach(function(e){ totalPerHour += (e.income_per_hour || 0); });
    if(currentUser.owner_id && currentUser.owner_id !== currentUser.vk_id) totalPerHour = Math.floor(totalPerHour / 2);
    var hoursPassed = (new Date() - new Date(currentUser.last_collect || new Date())) / 3600000;
    var newPending = Math.floor((currentUser.pending_experience || 0) + totalPerHour * hoursPassed);
    await supabase.from('players').update({ pending_experience: newPending, last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.pending_experience = newPending;
}

async function collectExperience() {
    if(!currentUser.pending_experience) { toast('Нечего собирать', 'info'); return; }
    var collected = currentUser.pending_experience;
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

// Загрузка моей команды
function loadMyTeam(reset) {
    if(reset) { myTeamOffset = 0; document.getElementById('my-team-list').innerHTML = ''; }
    var list = document.getElementById('my-team-list');
    if(!myTeam.length) {
        list.innerHTML = '<p style="color:#aaa;text-align:center;">Нет сотрудников</p>';
        document.getElementById('load-more-btn').style.display = 'none';
        return;
    }
    var page = myTeam.slice(myTeamOffset, myTeamOffset + TEAM_PAGE_SIZE);
    page.forEach(function(emp){ renderEmployeeItem(emp, list, true); });
    myTeamOffset += page.length;
    document.getElementById('load-more-btn').style.display = (myTeamOffset < myTeamTotal) ? 'block' : 'none';
}
