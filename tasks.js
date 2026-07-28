// ================= ЗАДАНИЯ =================

// 🧪 ТЕСТОВЫЙ РЕЖИМ — убрать после модерации рекламы
var IS_TEST_MODE = true;

var adWatchCount = 0;
var adWatchDate = '';

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

// ================= РЕКЛАМНОЕ ЗАДАНИЕ =================

function getAdLimitKey() {
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
}

function getRemainingAds() {
    var watched = getAdWatchCount();
    return Math.max(0, REWARDED_AD_LIMIT - watched);
}

async function doRewardedAd() {
    var remaining = getRemainingAds();
    if(remaining <= 0) {
        toast('⚠️ Вы посмотрели максимум рекламы на сегодня (' + REWARDED_AD_LIMIT + ')', 'error');
        return;
    }
    
    var lastAdTime = localStorage.getItem('last_ad_time_' + currentUser.vk_id);
    if(lastAdTime) {
        var timeDiff = (Date.now() - parseInt(lastAdTime)) / 1000;
        if(timeDiff < AD_COOLDOWN_SECONDS) {
            var wait = Math.ceil(AD_COOLDOWN_SECONDS - timeDiff);
            toast('⏳ Подождите ' + wait + ' сек. до следующей рекламы', 'info');
            return;
        }
    }
    
    // ========== ТЕСТОВЫЙ РЕЖИМ ==========
    if(IS_TEST_MODE) {
        var bonus = REWARDED_AD_BONUS;
        await supabase.from('players').update({ 
            experience: (currentUser.experience || 0) + bonus 
        }).eq('vk_id', currentUser.vk_id);
        currentUser.experience += bonus;
        
        var newCount = getAdWatchCount() + 1;
        setAdWatchCount(newCount);
        localStorage.setItem('last_ad_time_' + currentUser.vk_id, String(Date.now()));
        
        var remainingAfter = getRemainingAds();
        toast('🧪 [ТЕСТ] +' + bonus + ' опыта! Осталось ' + remainingAfter + ' просмотров на сегодня', 'success');
        renderAll();
        renderTasks();
        return;
    }
    // ====================================
    
    // РЕАЛЬНЫЙ ПОКАЗ РЕКЛАМЫ (после модерации)
    try {
        var result = await vkBridge.send('VKWebAppShowNativeAds', {
            ad_format: 'rewarded'
        });
        
        if(result && result.result) {
            var bonus = REWARDED_AD_BONUS;
            await supabase.from('players').update({ 
                experience: (currentUser.experience || 0) + bonus 
            }).eq('vk_id', currentUser.vk_id);
            currentUser.experience += bonus;
            
            var newCount = getAdWatchCount() + 1;
            setAdWatchCount(newCount);
            localStorage.setItem('last_ad_time_' + currentUser.vk_id, String(Date.now()));
            
            var remainingAfter = getRemainingAds();
            toast('✅ +' + bonus + ' опыта! Осталось ' + remainingAfter + ' просмотров на сегодня', 'success');
            renderAll();
            renderTasks();
        } else {
            toast('Реклама не загружена', 'error');
        }
    } catch(e) {
        console.error('Ошибка показа рекламы:', e);
        toast('Реклама не загружена', 'error');
    }
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
