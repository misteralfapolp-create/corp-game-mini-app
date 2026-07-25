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
    toast('Проверяем...', 'info');
    var sent = sendPersonalMessageSync(currentUser.vk_id, '✅ Уведомления подключены!');
    if(sent) {
        await completeNotifyTask();
    } else {
        toast('❌ Не отправлено. Напишите любое слово в ЛС группы и попробуйте снова!', 'error');
    }
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

function sendPersonalMessageSync(vkId, message) {
    if(!GROUP_TOKEN) return false;
    try {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.vk.com/method/messages.send', false);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.send('user_id=' + vkId + '&message=' + encodeURIComponent(message) + '&access_token=' + GROUP_TOKEN + '&v=5.199&random_id=' + Math.floor(Math.random() * 999999));
        var response = JSON.parse(xhr.responseText);
        return response && response.response;
    } catch(e) { return false; }
}

function sendPersonalMessage(vkId, message) {
    if(!GROUP_TOKEN) return;
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.vk.com/method/messages.send', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.send('user_id=' + vkId + '&message=' + encodeURIComponent(message) + '&access_token=' + GROUP_TOKEN + '&v=5.199&random_id=' + Math.floor(Math.random() * 999999));
}
