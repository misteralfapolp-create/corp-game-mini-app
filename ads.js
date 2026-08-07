// ================= РЕКЛАМА =================

var adWatchCount = 0;
var adWatchDate = '';
var adReady = false;

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
    saveAdCountToDB(count);
}

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

async function checkAdReady() {
    try {
        console.log('🔍 Проверяем готовность рекламы...');
        var data = await vkBridge.send('VKWebAppCheckNativeAds', {
            ad_format: 'reward'
        });
        console.log('📡 Результат проверки:', data);
        
        if (data && data.result === true) {
            adReady = true;
            console.log('✅ Реклама готова к показу');
        } else {
            adReady = false;
            console.log('❌ Рекламные материалы не найдены');
        }
        
        renderTasks();
        return adReady;
    } catch(error) {
        console.error('❌ Ошибка проверки рекламы:', error);
        adReady = false;
        renderTasks();
        return false;
    }
}

async function doRewardedAd() {
    var remaining = getRemainingAds();
    if(remaining <= 0) {
        toast('⚠️ Вы посмотрели максимум рекламы на сегодня (' + REWARDED_AD_LIMIT + ')', 'error');
        return;
    }
    
    var lastAdTime = localStorage.getItem('last_ad_time_' + (currentUser ? currentUser.vk_id : 'temp'));
    if(lastAdTime) {
        var timeDiff = (Date.now() - parseInt(lastAdTime)) / 1000;
        if(timeDiff < AD_COOLDOWN_SECONDS) {
            var wait = Math.ceil(AD_COOLDOWN_SECONDS - timeDiff);
            toast('⏳ Подождите ' + wait + ' сек. до следующей рекламы', 'info');
            return;
        }
    }
    
    var ready = await checkAdReady();
    if (!ready) {
        toast('📡 Реклама ещё не загружена, попробуйте через несколько секунд', 'info');
        return;
    }
    
    try {
        console.log('🎬 Показываем рекламу...');
        var data = await vkBridge.send('VKWebAppShowNativeAds', {
            ad_format: 'reward'
        });
        console.log('📡 Результат показа:', data);
        
        if (data && data.result === true) {
            await giveAdBonus();
        } else {
            toast('❌ Ошибка при показе рекламы', 'error');
        }
    } catch(error) {
        console.error('❌ Ошибка показа рекламы:', error);
        toast('❌ Ошибка при показе рекламы', 'error');
    }
}

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
        saveLastAdTimeToDB();
    }
    
    updateDailyTask('ad', 1);
    
    var remainingAfter = getRemainingAds();
    toast('✅ +' + bonus + ' опыта! Осталось ' + remainingAfter + ' просмотров', 'success');
    renderAll();
    renderTasks();
}

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

// ===== ЭКСПОРТ ГЛОБАЛЬНЫХ ФУНКЦИЙ =====
window.adWatchCount = adWatchCount;
window.adWatchDate = adWatchDate;
window.adReady = adReady;
window.getAdLimitKey = getAdLimitKey;
window.getAdWatchCount = getAdWatchCount;
window.setAdWatchCount = setAdWatchCount;
window.saveAdCountToDB = saveAdCountToDB;
window.getRemainingAds = getRemainingAds;
window.checkAdReady = checkAdReady;
window.doRewardedAd = doRewardedAd;
window.giveAdBonus = giveAdBonus;
window.saveLastAdTimeToDB = saveLastAdTimeToDB;
