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
        console.error('Ошибка проверки подписки:', e);
        toast('Ошибка проверки. Попробуйте позже.', 'error');
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
    
    toast('Проверяем...', 'info');
    
    var sent = await sendPersonalMessageAsync(currentUser.vk_id, '✅ Уведомления подключены!');
    
    if(sent) {
        await completeNotifyTask();
    } else {
        toast('❌ Не удалось отправить. Проверьте настройки бота.', 'error');
    }
}

async function completeNotifyTask() {
    if(currentUser.task_notify_done) return;
    await supabase.from('players').update({ 
        experience: (currentUser.experience || 0) + 1000, 
        task_notify_done: true 
    }).eq('vk_id', currentUser.vk_id);
    currentUser.experience += 1000;
    currentUser.task_notify_done = true;
    toast('✅ +1000 опыта за уведомления!', 'success');
    renderAll();
    renderTasks();
}

// ✅ ИСПРАВЛЕНО: используем VK Bridge вместо fetch
async function sendPersonalMessageAsync(vkId, message) {
    try {
        var result = await vkBridge.send('VKWebAppCallAPIMethod', {
            method: 'messages.send',
            params: {
                user_id: vkId,
                message: message,
                random_id: Math.floor(Math.random() * 999999),
                v: '5.199'
            }
        });
        console.log('Messages.send result:', result);
        return result && result.response;
    } catch(e) {
        console.error('Ошибка отправки сообщения:', e);
        return false;
    }
}
