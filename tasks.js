// ================= ЗАДАНИЯ =================

var adWatchCount = 0;
var adWatchDate = '';

// ================= ПРОВЕРКА ГОТОВНОСТИ РЕКЛАМЫ =================
var adReady = false;

async function checkAdReady() {
    try {
        var result = await vkBridge.send('VKWebAppCheckNativeAds', {
            ad_format: 'rewarded'
        });
        adReady = result && result.result === true;
        console.log('Реклама готова:', adReady);
        return adReady;
    } catch(e) {
        console.error('Ошибка проверки рекламы:', e);
        adReady = false;
        return false;
    }
}

// Проверяем готовность рекламы при загрузке и каждые 30 секунд
setInterval(function() {
    if (typeof currentUser !== 'undefined' && currentUser) {
        checkAdReady();
    }
}, 30000);

// ================= ТОГГЛ ЗАДАНИЙ =================
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

// ================= ЗАДАНИЕ: ПОДПИСКА НА ГРУППУ =================
function doGroupTask() {
    window.open(GROUP_URL, '_blank');
    toast('📱 Откройте группу и подпишитесь', 'info');
}

async function checkGroupTask() {
    if(currentUser.task_group_done) { toast('Уже выполнено!', 'info'); return; }
    try {
        // Запрашиваем токен для groups.isMember
        var tokenResult = await vkBridge.send('VKWebAppGetAuthToken', {
            app_id: String(APP_ID),
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

// ================= РЕКЛАМНОЕ ЗАДАНИЕ (ТЕСТОВЫЙ РЕЖИМ) =================

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

// ================= ПОКАЗ РЕКЛАМЫ С ПРОВЕРКОЙ =================
async function doRewardedAd() {
    var remaining = getRemainingAds();
    if(remaining <= 0) {
        toast('⚠️ Вы посмотрели максимум рекламы на сегодня (' + REWARDED_AD_LIMIT + ')', 'error');
        return;
    }
    
    // Проверяем кулдаун между показами (1 минута)
    var lastAdTime = localStorage.getItem('last_ad_time_' + currentUser.vk_id);
    if(lastAdTime) {
        var timeDiff = (Date.now() - parseInt(lastAdTime)) / 1000;
        if(timeDiff < AD_COOLDOWN_SECONDS) {
            var wait = Math.ceil(AD_COOLDOWN_SECONDS - timeDiff);
            toast('⏳ Подождите ' + wait + ' сек. до следующей рекламы', 'info');
            return;
        }
    }
    
    // Проверяем, готова ли реклама
    var ready = await checkAdReady();
    if (!ready) {
        toast('📡 Реклама загружается, попробуйте через несколько секунд', 'info');
        // Пытаемся показать всё равно
    }
    
    try {
        console.log('Показываем рекламу (тестовый режим)...');
        var result = await vkBridge.send('VKWebAppShowNativeAds', {
            ad_format: 'rewarded',
            is_test: true  // Тестовый режим для модерации
        });
        
        console.log('Результат рекламы:', result);
        
        if(result && result.result === true) {
            await giveAdBonus();
        } else {
            // В тестовом режиме начисляем бонус даже при "ошибке"
            toast('🎬 [ТЕСТ] Реклама показана! Начисляем бонус...', 'info');
            await giveAdBonus();
        }
    } catch(e) {
        console.error('Ошибка показа рекламы:', e);
        // В тестовом режиме начисляем бонус даже при ошибке
        toast('🎬 [ТЕСТ] Начисляем бонус за рекламу', 'info');
        await giveAdBonus();
    }
}

// ================= НАЧИСЛЕНИЕ БОНУСА =================
async function giveAdBonus() {
    var bonus = REWARDED_AD_BONUS;
    await supabase.from('players').update({
        experience: (currentUser.experience || 0) + bonus
    }).eq('vk_id', currentUser.vk_id);
    currentUser.experience += bonus;
    
    var newCount = getAdWatchCount() + 1;
    setAdWatchCount(newCount);
    localStorage.setItem('last_ad_time_' + currentUser.vk_id, String(Date.now()));
    
    var remainingAfter = getRemainingAds();
    toast('✅ +' + bonus + ' опыта! (тест) Осталось ' + remainingAfter + ' просмотров', 'success');
    renderAll();
    renderTasks();
}

// ================= РЕНДЕР ЗАДАНИЙ =================
function renderTasks() {
    var listEl = document.getElementById('tasks-list');
    if(!listEl) return;
    var html = '';
    
    // ЗАДАНИЕ: ПОСМОТРЕТЬ РЕКЛАМУ
    var remaining = getRemainingAds();
    var adText = '🎬 Посмотреть рекламу (+' + REWARDED_AD_BONUS + ' опыта)';
    if(remaining <= 0) {
        adText += ' ❌ (лимит)';
    } else {
        adText += ' (осталось ' + remaining + ' раз)';
    }
    
    // Показываем статус готовности рекламы
    var adStatus = adReady ? '✅ готова' : '⏳ загрузка...';
    
    html += '<div class="task-item"><div class="task-info"><b>' + adText + '</b><br><span style="font-size:11px;color:#aaa;">Максимум ' + REWARDED_AD_LIMIT + ' раз в день • 1 мин кулдаун</span><br><span style="font-size:10px;color:#8b949e;">Статус: ' + adStatus + '</span></div>';
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

// Проверяем готовность рекламы при загрузке страницы
if (typeof vkBridge !== 'undefined') {
    setTimeout(function() {
        checkAdReady();
    }, 2000);
}

// Экспортируем функции глобально
window.doRewardedAd = doRewardedAd;
window.getRemainingAds = getRemainingAds;
window.renderTasks = renderTasks;
window.toggleTasks = toggleTasks;
window.doGroupTask = doGroupTask;
window.checkGroupTask = checkGroupTask;
window.doPromoTask = doPromoTask;
