// Нанять — стоимость растёт + уведомления
async function hirePlayer(player) {
    var currentCost = player.hire_cost || 100;
    var hirePrice = currentCost;
    
    if((currentUser.experience || 0) < hirePrice) { toast('Недостаточно опыта! Нужно ' + hirePrice, 'error'); return; }
    
    // Списываем опыт у нанимателя
    await supabase.from('players').update({ experience: Math.max(0, (currentUser.experience || 0) - hirePrice) }).eq('vk_id', currentUser.vk_id);
    
    // Начисляем бонус старому владельцу
    if(player.owner_id && player.owner_id !== currentUser.vk_id) {
        var bonus = Math.floor(currentCost * 0.5);
        var oldOwnerResult = await supabase.from('players').select('experience').eq('vk_id', player.owner_id).maybeSingle();
        if(oldOwnerResult.data) {
            await supabase.from('players').update({ experience: (oldOwnerResult.data.experience || 0) + bonus }).eq('vk_id', player.owner_id);
        }
        sendPersonalMessage(player.owner_id, '💰 Вашего сотрудника ' + player.first_name + ' перекупили! Вы получили +' + bonus + ' опыта.');
    }
    
    // Стоимость растёт
    var newCost = Math.floor(currentCost * 1.5);
    
    // ПЕРЕДАЁМ СОТРУДНИКА НОВОМУ ВЛАДЕЛЬЦУ
    await supabase.from('players').update({ 
        owner_id: currentUser.vk_id, 
        status: 'Работает', 
        role: 'Учёный', 
        hire_cost: newCost 
    }).eq('vk_id', player.vk_id);
    
    // Обновляем опыт нанимателя
    currentUser.experience = Math.max(0, (currentUser.experience || 0) - hirePrice);
    await supabase.from('players').update({ last_collect: new Date().toISOString() }).eq('vk_id', currentUser.vk_id);
    currentUser.last_collect = new Date().toISOString();
    
    toast('✅ Нанят! Стоимость выросла до ' + newCost, 'success');
    sendPersonalMessage(player.vk_id, '💼 ' + currentUser.first_name + ' нанял вас! Стоимость: ' + newCost + ' опыта.');
    
    closePlayerModal();
    await updateAllStats();
    loadMyTeam(true);
    renderAll();
}
