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
    saveDailyTasksToDB();
}

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
            dailyTasks = {
                hire: { count: r.data.daily_hire_count || 0, target: 5, done: (r.data.daily_hire_count || 0) >= 5 },
                ad: { count: r.data.daily_ad_count || 0, target: 10, done: (r.data.daily_ad_count || 0) >= 10 },
                upgrade: { count: r.data.daily_upgrade_count || 0, target: 3, done: (r.data.daily_upgrade_count || 0) >= 3 },
                collect: { count: r.data.daily_collect_count || 0, target: 5, done: (r.data.daily_collect_count || 0) >= 5 }
            };
            saveDailyTasks();
        }
        
        var adDate = r.data.ad_watch_date ? new Date(r.data.ad_watch_date).toDateString() : null;
        if (adDate === today) {
            adWatchCount = r.data.ad_watch_count || 0;
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

// ===== ЭКСПОРТ ГЛОБАЛЬНЫХ ФУНКЦИЙ =====
window.dailyTasks = dailyTasks;
window.getDailyTasksKey = getDailyTasksKey;
window.loadDailyTasks = loadDailyTasks;
window.saveDailyTasks = saveDailyTasks;
window.saveDailyTasksToDB = saveDailyTasksToDB;
window.loadDailyTasksFromDB = loadDailyTasksFromDB;
window.getDailyTaskProgress = getDailyTaskProgress;
window.updateDailyTask = updateDailyTask;
window.giveDailyTaskReward = giveDailyTaskReward;
