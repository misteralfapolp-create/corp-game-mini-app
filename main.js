// ================= ЗАПУСК ПРИЛОЖЕНИЯ =================

async function initApp(){
    try{
        document.getElementById('player-name').textContent = 'Шаг 1...';
        
        currentVkUser = await vkBridge.send('VKWebAppGetUserInfo');
        document.getElementById('player-name').textContent = 'Шаг 2... ' + currentVkUser.first_name;
        
        var invitedBy = getRefFromHash() || new URLSearchParams(window.location.search).get('ref');
        if(invitedBy && parseInt(invitedBy) === currentVkUser.id) invitedBy = null;
        
        document.getElementById('player-name').textContent = 'Шаг 3...';
        
        var r = await supabase.from('players').select('*').eq('vk_id', currentVkUser.id).maybeSingle();
        
        if(r.error) {
            document.getElementById('player-name').textContent = 'Ошибка БД: ' + r.error.message;
            return;
        }
        
        document.getElementById('player-name').textContent = 'Шаг 4...';
        
        if(!r.data){
            var ownerId = null;
            if(invitedBy){ ownerId = parseInt(invitedBy); }
            else if(currentVkUser.id !== MY_VK_ID){ ownerId = MY_VK_ID; }
            
            await supabase.from('players').insert([{
                vk_id: currentVkUser.id,
                first_name: currentVkUser.first_name,
                last_name: currentVkUser.last_name,
                photo_200: currentVkUser.photo_200 || '',
                status: ownerId ? 'Работает' : 'Биржа труда',
                company: null,
                role: ownerId ? 'Учёный' : null,
                experience: 0,
                income_per_hour: ownerId ? 1 : 0,
                invited_by: invitedBy ? parseInt(invitedBy) : null,
                last_collect: new Date().toISOString(),
                pending_experience: 0,
                level: 1,
                hire_cost: 100,
                owner_id: ownerId,
                company_group_id: null,
                task_group_done: false,
                task_promo_done: false,
                max_pending: 0
            }]);
            
            if(invitedBy){ await giveReferralBonus(parseInt(invitedBy)); }
            else if(ownerId === MY_VK_ID){ await giveReferralBonus(MY_VK_ID); }
            location.reload();
            return;
        }
        
        currentUser = r.data;
        document.getElementById('player-name').textContent = currentUser.first_name + ' ' + currentUser.last_name;
        
        if(currentUser.owner_id === undefined){ await supabase.from('players').update({owner_id:null,last_collect:new Date().toISOString(),pending_experience:0}).eq('vk_id',currentUser.vk_id); currentUser.owner_id = null; }
        if(currentUser.company_group_id === undefined){ await supabase.from('players').update({company_group_id:null}).eq('vk_id',currentUser.vk_id); currentUser.company_group_id = null; }
        if(currentUser.task_group_done === undefined){ await supabase.from('players').update({task_group_done:false,task_promo_done:false,max_pending:0}).eq('vk_id',currentUser.vk_id); currentUser.task_group_done = false; currentUser.task_promo_done = false; currentUser.max_pending = 0; }
        if(invitedBy && parseInt(invitedBy) !== currentUser.vk_id && !currentUser.owner_id){
            var inv2 = await supabase.from('players').select('vk_id').eq('vk_id', parseInt(invitedBy)).maybeSingle();
            if(inv2.data){
                await supabase.from('players').update({owner_id:parseInt(invitedBy),status:'Работает',role:'Учёный',income_per_hour:1}).eq('vk_id',currentUser.vk_id);
                await giveReferralBonus(parseInt(invitedBy));
                currentUser.owner_id = parseInt(invitedBy);
                currentUser.status = 'Работает';
                currentUser.role = 'Учёный';
                currentUser.income_per_hour = 1;
            }
        }
        await updateAllStats();
        renderAll();
        updateNavButtons('profile');
    } catch(e) {
        console.error('Ошибка:', e);
        document.getElementById('player-name').textContent = 'Ошибка: ' + (e.message || e);
    }
}

// ================= ЗАПУСК ПРИ ЗАГРУЗКЕ =================
window.addEventListener('load', function() {
    if (typeof vkBridge !== 'undefined') {
        vkBridge.send('VKWebAppInit').then(initApp).catch(function(err) {
            document.getElementById('player-name').textContent = 'Ошибка VK: ' + err.message;
        });
    } else {
        document.getElementById('player-name').textContent = 'VK Bridge не загружен';
    }
});

// ================= ОБРАБОТЧИКИ =================
document.getElementById('subtab-players').addEventListener('click', function(){ switchTopSubtab('players'); });
document.getElementById('subtab-companies').addEventListener('click', function(){ switchTopSubtab('companies'); });
document.getElementById('load-more-btn').addEventListener('click', function(){ loadMyTeam(false); });
