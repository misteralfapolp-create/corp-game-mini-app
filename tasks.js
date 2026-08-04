// ================= ЗАДАНИЯ =================

var adWatchCount = 0;
var adWatchDate = '';

// ================= ЕЖЕДНЕВНЫЕ ЗАДАНИЯ =================
var dailyTasks = {
    hire: { count: 0, target: 5, done: false },
    ad: { count: 0, target: 10, done: false },
    upgrade: { count: 0, target: 3, done: false },
    collect: { count: 0, target: 5, done: false }
};

function getDailyTasksKey() {
    if (!currentUser || !currentUser.vk_id) {
        return 'daily_tasks_temp';
    }
    return 'daily_tasks_' + currentUser.vk_id + '_' + new Date().toDateString();
}

function loadDailyTasks() {
    var key = getDailyTasksKey();
    var data = localStorage.getItem(key);
    if (data) {
        try {
            var parsed = JSON.parse(data);
            if (parsed.hire && parsed.ad && parsed.upgrade && parsed.collect) {
                dailyTasks = parsed;
                return;
            }
        } catch(e) {}
    }
    dailyTasks = {
        hire: { count: 0, target: 5, done: false },
        ad: { count: 0, target: 10, done: false },
        upgrade: { count: 0, target: 3, done: false },
        collect: { count: 0, target: 5, done: false }
    };
    saveDailyTasks();
}

function saveDailyTasks() {
    var key = getDailyTasksKey();
    localStorage.setItem(key, JSON.stringify(dailyTasks));
    // ✅ ДОБАВЛЕНО: сохраняем в Supabase
    saveDailyTasksToDB();
}

// ✅ НОВАЯ ФУНКЦИЯ: сохранение в Supabase
async function saveDailyTasksToDB() {
    if (!currentUser || !currentUser.vk_id) return;
    try {
        await supabase.from('players').update({
            daily_hire_count: dailyTasks.hire.count,
            daily_ad_count: dailyTasks.ad.count,
            daily_upgrade_count: dailyTasks.upgrade.count,
            daily_collect_count: dailyTasks.collect.count,
            daily_tasks_date: new Date().toISOString().split('T')[0]
        }).eq('vk_id', currentUser.vk_id);
    } catch(e) {
        console.error('Ошибка сохранения заданий в БД:', e);
    }
}

// ✅ НОВАЯ ФУНКЦИЯ: загрузка из Supabase при старте
async function loadDailyTasksFromDB() {
    if (!currentUser || !currentUser.vk_id) return;
    try {
        var r = await supabase.from('players')
            .select('daily_hire_count, daily_ad_count, daily_upgrade_count, daily_collect_count, daily_tasks_date, ad_watch_count, ad_watch_date, last_ad_time')
            .eq('vk_id', currentUser.vk_id)
            .maybeSingle();
        
        if (r.error || !r.data) return;
        
        var today = new Date().toDateString();
        var savedDate = r.data.daily_tasks_date ? new Date(r.data.daily_tasks_date).toDateString() : null;
        
        if (savedDate === today) {
            // Загружаем из БД
            dailyTasks = {
                hire: { count: r.data.daily_hire_count || 0, target: 5, done: (r.data.daily_hire_count || 0) >= 5 },
                ad: { count: r.data.daily_ad_count || 0, target: 10, done: (r.data.daily_ad_count || 0) >= 10 },
                upgrade: { count: r.data.daily_upgrade_count || 0, target: 3, done: (r.data.daily_upgrade_count || 0) >= 3 },
                collect: { count: r.data.daily_collect_count || 0, target: 5, done: (r.data.daily_collect_count || 0) >= 5 }
            };
            // Сохраняем в localStorage для синхронизации
            saveDailyTasks();
        }
        
        // Синхронизируем счётчик рекламы
        var adDate = r.data.ad_watch_date ? new Date(r.data.ad_watch_date).toDateString() : null;
        if (adDate === today) {
            adWatchCount = r.data.ad_watch_count || 0;
            // Обновляем localStorage
            var key = getAdLimitKey();
            localStorage.setItem(key, JSON.stringify({ count: adWatchCount }));
        }
        
        renderTasks();
    } catch(e) {
        console.error('Ошибка загрузки заданий из БД:', e);
    }
}

function getDailyTaskProgress(taskId) {
    var task = dailyTasks[taskId];
    if (!task) return { progress: 0, target: 0, done: false };
    return { progress: task.count, target: task.target, done: task.done };
}

function updateDailyTask(taskId, increment) {
    var task = dailyTasks[taskId];
    if (!task || task.done) return;
    task.count += increment;
    if (task.count >= task.target) {
        task.done = true;
        giveDailyTaskReward(taskId);
    }
    saveDailyTasks();
    renderTasks();
}

async function giveDailyTaskReward(taskId) {
    var reward = 1000;
    await supabase.from('players').update({
        experience: (currentUser.experience || 0) + reward
    }).eq('vk_id', currentUser.vk_id);
    currentUser.experience += reward;
    
    var taskNames = {
        hire: 'найми 5 сотрудников',
        ad: 'просмотри 10 реклам',
        upgrade: 'прокачай 3 сотрудников',
        collect: 'собери доход 5 раз'
    };
    toast('🎉 Ежедневное задание выполнено: ' + taskNames[taskId] + '! +' + reward + ' опыта!', 'success');
    renderAll();
}

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

// ================= РЕКЛАМНОЕ ЗАДАНИЕ =================
function getAdLimitKey() {
    if (!currentUser || !currentUser.vk_id) {
        return 'ad_watch_temp';
    }
    var today = new Date().toDateString();
    return 'ad_watch_' + currentUser.vk_id + '_' + today;
}

function getAdWatchCount() {
    var key = getAdLimitKey();
    var data = localStorage.getItem(key);
    if(data) {
        try {
            var parsed = JSON.parse(data);
            return parsed.count || 0;
        } catch(e) { return 0; }
    }
    return 0;
}

function setAdWatchCount(count) {
    var key = getAdLimitKey();
    localStorage.setItem(key, JSON.stringify({ count: count }));
    // ✅ ДОБАВЛЕНО: сохраняем в Supabase
    saveAdCountToDB(count);
}

// ✅ НОВАЯ ФУНКЦИЯ: сохранение счётчика рекламы в Supabase
async function saveAdCountToDB(count) {
    if (!currentUser || !currentUser.vk_id) return;
    try {
        await supabase.from('players').update({
            ad_watch_count: count || 0,
            ad_watch_date: new Date().toISOString().split('T')[0]
        }).eq('vk_id', currentUser.vk_id);
    } catch(e) {
        console.error('Ошибка сохранения счётчика рекламы:', e);
    }
}

function getRemainingAds() {
    var watched = getAdWatchCount();
    return Math.max(0, REWARDED_AD_LIMIT - watched);
}

// ================= ПОКАЗ РЕКЛАМЫ (ВСЁ РАБОТАЕТ КАК РАНЬШЕ) =================
async function doRewardedAd() {
    var remaining = getRemainingAds();
    if(remaining <= 0) {
        toast('⚠️ Вы посмотрели максимум рекламы на сегодня (' + REWARDED_AD_LIMIT + ')', 'error');
        return;
    }
    
    // ✅ КУЛДАУН 1 МИНУТА (работает)
    var lastAdTime = localStorage.getItem('last_ad_time_' + (currentUser ? currentUser.vk_id : 'temp'));
    if(lastAdTime) {
        var timeDiff = (Date.now() - parseInt(lastAdTime)) / 1000;
        if(timeDiff < AD_COOLDOWN_SECONDS) {
            var wait = Math.ceil(AD_COOLDOWN_SECONDS - timeDiff);
            toast('⏳ Подождите ' + wait + ' сек. до следующей рекламы', 'info');
            return;
        }
    }
    
    try {
        console.log('Показываем рекламу...');
        var result = await vkBridge.send('VKWebAppShowNativeAds', {
            ad_format: 'rewarded'
        });
        
        console.log('Результат рекламы:', result);
        
        if(result && result.result === true) {
            await giveAdBonus();
        } else {
            toast('🎬 Реклама активирована!', 'info');
            await giveAdBonus();
        }
    } catch(e) {
        console.error('Ошибка показа рекламы:', e);
        toast('🎬 Бонус за рекламу начислен!', 'info');
        await giveAdBonus();
    }
}

// ================= НАЧИСЛЕНИЕ БОНУСА (ВСЁ РАБОТАЕТ КАК РАНЬШЕ) =================
async function giveAdBonus() {
    var bonus = REWARDED_AD_BONUS;
    await supabase.from('players').update({
        experience: (currentUser.experience || 0) + bonus
    }).eq('vk_id', currentUser.vk_id);
    currentUser.experience += bonus;
    
    var newCount = getAdWatchCount() + 1;
    setAdWatchCount(newCount);
    if (currentUser && currentUser.vk_id) {
        localStorage.setItem('last_ad_time_' + currentUser.vk_id, String(Date.now()));
        // ✅ ДОБАВЛЕНО: сохраняем время последнего просмотра в Supabase
        saveLastAdTimeToDB();
    }
    
    updateDailyTask('ad', 1);
    
    var remainingAfter = getRemainingAds();
    toast('✅ +' + bonus + ' опыта! Осталось ' + remainingAfter + ' просмотров', 'success');
    renderAll();
    renderTasks();
}

// ✅ НОВАЯ ФУНКЦИЯ: сохранение времени последнего просмотра в Supabase
async function saveLastAdTimeToDB() {
    if (!currentUser || !currentUser.vk_id) return;
    try {
        await supabase.from('players').update({
            last_ad_time: new Date().toISOString()
        }).eq('vk_id', currentUser.vk_id);
    } catch(e) {
        console.error('Ошибка сохранения времени рекламы:', e);
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
    
    html += '<div class="section-title" style="margin-top:12px;">🎯 Задания</div>';
    html += '<div class="task-item"><div class="task-info"><b>' + adText + '</b><br><span style="font-size:11px;color:#aaa;">Максимум ' + REWARDED_AD_LIMIT + ' раз в день • 1 мин кулдаун</span></div>';
    if(remaining > 0) {
        html += '<button class="btn-task" onclick="doRewardedAd()" style="background:linear-gradient(135deg,#ff9800,#f57c00);color:#fff;">▶ Смотреть</button>';
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
    
    if(html === '') html = '<p style="color:#4caf50;text-align:center;">✅ Все задания выполнены!</p>';
    listEl.innerHTML = html;
}

// ===== ЗАГРУЗКА ПРИ СТАРТЕ =====
setTimeout(async function() {
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.vk_id) {
        await loadDailyTasksFromDB();
        // Загружаем счётчик рекламы из БД
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
        renderTasks();
    }
}, 1000);

// ===== ЭКСПОРТ =====
window.doRewardedAd = doRewardedAd;
window.getRemainingAds = getRemainingAds;
window.renderTasks = renderTasks;
window.toggleTasks = toggleTasks;
window.doGroupTask = doGroupTask;
window.checkGroupTask = checkGroupTask;
window.doPromoTask = doPromoTask;
window.updateDailyTask = updateDailyTask;
window.loadDailyTasksFromDB = loadDailyTasksFromDB;
