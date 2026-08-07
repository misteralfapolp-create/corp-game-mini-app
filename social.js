// ================= СОЦИАЛЬНЫЕ ЗАДАНИЯ =================

function toggleTasks() {
    var panel = document.getElementById('tasks-panel');
    if(panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        renderTasks();
        document.getElementById('earn-btn').textContent = '🔼 Скрыть';
        checkAdReady();
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
        var tokenResult = await vkBridge.send('VKWebAppGetAuthToken', {
            app_id: parseInt(APP_ID),
            scope: 'groups'
        });
        
        if(!tokenResult || !tokenResult.access_token) {
            toast('Не удалось получить доступ', 'error');
            return;
        }
        
        var result = await vkBridge.send('VKWebAppCallAPIMethod', {
            method: 'groups.isMember',
            params: {
                group_id: GROUP_ID,
                user_id: currentUser.vk_id,
                access_token: tokenResult.access_token,
                v: '5.199'
            }
        });
        
        if(result.response === 1) {
            await supabase.from('players').update({
                experience: (currentUser.experience || 0) + 1000,
                task_group_done: true
            }).eq('vk_id', currentUser.vk_id);
            currentUser.experience += 1000;
            currentUser.task_group_done = true;
            toast('✅ +1000 опыта!', 'success');
            renderAll();
            renderTasks();
        } else {
            toast('❌ Вы не подписаны на группу', 'error');
        }
    } catch(e) {
        console.error('Ошибка проверки подписки:', e);
        toast('Ошибка проверки. Попробуйте позже.', 'error');
    }
}

function doPromoTask() {
    openSettings();
    toast('Введите промокод', 'info');
}

// ================= ПОКУПКА ПОДПИСКИ (ТЕСТОВЫЙ РЕЖИМ) =================
async function buySubscription() {
    try {
        if (typeof vkBridge === 'undefined') {
            toast('❌ VK Bridge не загружен', 'error');
            return;
        }

        console.log('🛒 Открываем окно покупки подписки...');

        var result = await vkBridge.send('VKWebAppShowSubscriptionBox', {
            action: 'create',
            item: 'sale_item_subscription_1'  // Идентификатор подписки
        });

        console.log('📡 Результат:', result);

        if (result && result.result) {
            toast('✅ Подписка оформлена!', 'success');
        } else {
            toast('❌ Подписка отменена', 'info');
        }
    } catch (e) {
        console.error('❌ Ошибка подписки:', e);
        toast('❌ Ошибка: ' + (e.message || 'неизвестная'), 'error');
    }
}

// ================= РЕНДЕР ЗАДАНИЙ =================
function renderTasks() {
    var listEl = document.getElementById('tasks-list');
    if(!listEl) return;
    var html = '';
    
    // ===== ЕЖЕДНЕВНЫЕ ЗАДАНИЯ =====
    var dailyTaskList = [
        { id: 'hire', label: '👥 Найми 5 сотрудников', progress: dailyTasks.hire.count, target: 5, done: dailyTasks.hire.done },
        { id: 'ad', label: '🎬 Просмотри 10 реклам', progress: dailyTasks.ad.count, target: 10, done: dailyTasks.ad.done },
        { id: 'upgrade', label: '⬆️ Прокачай 3 сотрудников', progress: dailyTasks.upgrade.count, target: 3, done: dailyTasks.upgrade.done },
        { id: 'collect', label: '💰 Собери доход 5 раз', progress: dailyTasks.collect.count, target: 5, done: dailyTasks.collect.done }
    ];
    
    html += '<div class="section-title" style="margin-top:8px;">📅 Ежедневные задания (обновляются каждый день)</div>';
    dailyTaskList.forEach(function(task) {
        var percent = Math.min(100, Math.round((task.progress / task.target) * 100));
        var status = task.done ? '✅ Выполнено!' : task.progress + '/' + task.target;
        var barColor = task.done ? '#4caf50' : '#ff9800';
        
        html += '<div class="task-item" style="flex-direction:column;align-items:stretch;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div class="task-info"><b>' + task.label + '</b><br><span style="font-size:11px;color:#ffd700;">🏆 Награда: 1000 опыта</span></div>';
        html += '<span style="font-size:13px;color:' + (task.done ? '#4caf50' : '#ff9800') + ';font-weight:600;">' + status + '</span>';
        html += '</div>';
        html += '<div style="width:100%;height:6px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;margin-top:4px;">';
        html += '<div style="width:' + percent + '%;height:100%;background:' + barColor + ';border-radius:4px;transition:width 0.3s;"></div>';
        html += '</div>';
        html += '</div>';
    });
    
    // ===== ЗАДАНИЕ: ПОСМОТРЕТЬ РЕКЛАМУ =====
    var remaining = getRemainingAds();
    var adText = '🎬 Посмотреть рекламу (+' + REWARDED_AD_BONUS + ' опыта)';
    if(remaining <= 0) {
        adText += ' ❌ (лимит)';
    } else {
        adText += ' (осталось ' + remaining + ' раз)';
    }
    
    var statusText = adReady ? '✅ готова' : '⏳ загрузка...';
    
    html += '<div class="section-title" style="margin-top:12px;">🎯 Задания</div>';
    html += '<div class="task-item"><div class="task-info"><b>' + adText + '</b><br><span style="font-size:11px;color:#aaa;">Максимум ' + REWARDED_AD_LIMIT + ' раз в день • 1 мин кулдаун</span><br><span style="font-size:10px;color:#8b949e;">📡 Статус: ' + statusText + '</span></div>';
    if(remaining > 0 && adReady) {
        html += '<button class="btn-task" onclick="doRewardedAd()" style="background:linear-gradient(135deg,#ff9800,#f57c00);color:#fff;">▶ Смотреть</button>';
    } else if(remaining > 0 && !adReady) {
        html += '<button class="btn-task" disabled style="background:#555;color:#888;cursor:not-allowed;">⏳ Загрузка...</button>';
    } else {
        html += '<span style="color:#f44336;">❌ Лимит</span>';
    }
    html += '</div>';
    
    // ЗАДАНИЕ: ПОДПИСКА НА ГРУППУ
    if(!currentUser || !currentUser.task_group_done) {
        html += '<div class="task-item"><div class="task-info"><b>📱 Подписаться на группу</b><br><span style="font-size:11px;color:#aaa;">Награда: 1000 опыта</span></div>';
        html += '<div style="display:flex;gap:4px;"><button class="btn-task" onclick="doGroupTask()">▶ Выполнить</button><button class="btn-task-check" onclick="checkGroupTask()">🔍 Проверить</button></div>';
        html += '</div>';
    }
    
    // ЗАДАНИЕ: ПРОМОКОД
    html += '<div class="task-item"><div class="task-info"><b>🎁 Ввести промокод</b><br><span style="font-size:11px;color:#aaa;">Награда: 1000 опыта</span></div>';
    html += '<button class="btn-task" onclick="doPromoTask()">▶ Выполнить</button>';
    html += '</div>';
    
    // ===== КУПИТЬ ПОДПИСКУ (ТЕСТОВЫЙ РЕЖИМ) =====
    html += '<div class="task-item">';
    html += '<div class="task-info"><b>📅 Оформить подписку</b><br><span style="font-size:11px;color:#aaa;">Тестовый режим (голоса не списываются)</span></div>';
    html += '<button class="btn-task" onclick="buySubscription()" style="background:linear-gradient(135deg,#8e44ad,#6c3483);color:#fff;">📅 Купить</button>';
    html += '</div>';
    
    if(html === '') html = '<p style="color:#4caf50;text-align:center;">✅ Все задания выполнены!</p>';
    listEl.innerHTML = html;
}

// ===== ЗАПУСК ПРИ СТАРТЕ =====
setTimeout(async function() {
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.vk_id) {
        await loadDailyTasksFromDB();
        try {
            var r = await supabase.from('players')
                .select('ad_watch_count, ad_watch_date, last_ad_time')
                .eq('vk_id', currentUser.vk_id)
                .maybeSingle();
            if (r.data) {
                var today = new Date().toDateString();
                var adDate = r.data.ad_watch_date ? new Date(r.data.ad_watch_date).toDateString() : null;
                if (adDate === today) {
                    adWatchCount = r.data.ad_watch_count || 0;
                    var key = getAdLimitKey();
                    localStorage.setItem(key, JSON.stringify({ count: adWatchCount }));
                }
                if (r.data.last_ad_time) {
                    localStorage.setItem('last_ad_time_' + currentUser.vk_id, String(new Date(r.data.last_ad_time).getTime()));
                }
            }
        } catch(e) {
            console.error('Ошибка загрузки счётчика рекламы:', e);
        }
        setTimeout(checkAdReady, 2000);
        renderTasks();
    }
}, 1000);

// ===== ЭКСПОРТ ГЛОБАЛЬНЫХ ФУНКЦИЙ =====
window.toggleTasks = toggleTasks;
window.doGroupTask = doGroupTask;
window.checkGroupTask = checkGroupTask;
window.doPromoTask = doPromoTask;
window.renderTasks = renderTasks;
window.buySubscription = buySubscription;
