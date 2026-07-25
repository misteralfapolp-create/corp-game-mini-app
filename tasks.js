// ================= ЗАДАНИЯ =================

function toggleTasks() {
    var panel = document.getElementById('tasks-panel');
    if(panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        renderTasks();
        document.getElementById('earn-btn').textContent = '🔼 Скрыть';
    } else {
        panel.style.display = 'none';
        document.getElementById('earn-btn').textContent = '💰 Заработать';
    }
}

function doGroupTask() {
    window.open(GROUP_URL, '_blank');
    toast('📱 Откройте группу и подпишитесь', 'info');
}

async function checkGroupTask() {
    if(currentUser.task_group_done) { toast('Уже выполнено!', 'info'); return; }
    try {
        var result = await vkBridge.send('VKWebAppCallAPIMethod', { method: 'groups.isMember', params: { group_id: GROUP_ID, user_id: currentUser.vk_id, v: '5.199' } });
        if(result.response === 1) {
            await supabase.from('players').update({ experience: (currentUser.experience || 0) + 1000, task_group_done: true }).eq('vk_id', currentUser.vk_id);
            currentUser.experience += 1000;
            currentUser.task_group_done = true;
            toast('✅ +1000 опыта!', 'success');
            renderAll();
        } else { toast('Не подписаны', 'error'); }
    } catch(e) {
        await supabase.from('players').update({ experience: (currentUser.experience || 0) + 1000, task_group_done: true }).eq('vk_id', currentUser.vk_id);
        currentUser.experience += 1000;
        currentUser.task_group_done = true;
        toast('✅ +1000 опыта!', 'success');
        renderAll();
    }
}

function doPromoTask() {
    openSettings();
    toast('Введите промокод', 'info');
}

// ================= УВЕДОМЛЕНИЯ =================

function doNotifyTask() {
    window.open('https://vk.com/write-' + GROUP_ID, '_blank');
    toast('📝 Напишите любое слово в чат группы, затем нажмите «Проверить»', 'info');
}

async function checkNotifyTask() {
    if(currentUser.task_notify_done) { toast('Уже выполнено!', 'info'); return; }
    
    // Начисляем награду (без реальной отправки до модерации)
    await completeNotifyTask();
}

async function completeNotifyTask() {
    if(currentUser.task_notify_done) return;
    await supabase.from('players').update({ experience: (currentUser.experience || 0) + 1000, task_notify_done: true }).eq('vk_id', currentUser.vk_id);
    currentUser.experience += 1000;
    currentUser.task_notify_done = true;
    toast('✅ +1000 опыта за уведомления!', 'success');
    renderAll();
    renderTasks();
}
