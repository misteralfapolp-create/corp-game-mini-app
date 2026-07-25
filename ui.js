function renderTasks() {
    var listEl = document.getElementById('tasks-list');
    if(!listEl) return;
    var html = '';
    
    // Задание 1: Подписка на группу (скрываем если выполнено)
    if(!currentUser || !currentUser.task_group_done) {
        html += '<div class="task-item"><div class="task-info"><b>📱 Подписаться на группу</b><br><span style="font-size:11px;color:#aaa;">Награда: 1000 опыта</span></div>';
        html += '<div style="display:flex;gap:4px;"><button class="btn-task" onclick="doGroupTask()">▶ Выполнить</button><button class="btn-task-check" onclick="checkGroupTask()">🔍 Проверить</button></div>';
        html += '</div>';
    }
    
    // Задание 2: Уведомления (скрываем если выполнено)
    if(!currentUser || !currentUser.task_notify_done) {
        html += '<div class="task-item"><div class="task-info"><b>🔔 Подключить уведомления</b><br><span style="font-size:11px;color:#aaa;">Награда: 1000 опыта • Напишите любое слово в ЛС группы</span></div>';
        html += '<div style="display:flex;gap:4px;"><button class="btn-task" onclick="doNotifyTask()">▶ Выполнить</button><button class="btn-task-check" onclick="checkNotifyTask()">🔍 Проверить</button></div>';
        html += '</div>';
    }
    
    // Задание 3: Промокод (всегда показываем)
    html += '<div class="task-item"><div class="task-info"><b>🎁 Ввести промокод</b><br><span style="font-size:11px;color:#aaa;">Награда: 1000 опыта</span></div>';
    html += '<button class="btn-task" onclick="doPromoTask()">▶ Выполнить</button>';
    html += '</div>';
    
    // Если все задания выполнены
    if(html === '') {
        html = '<p style="color:#4caf50;text-align:center;">✅ Все задания выполнены!</p>';
    }
    
    listEl.innerHTML = html;
}
