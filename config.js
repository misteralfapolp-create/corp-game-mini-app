// ================= НАСТРОЙКИ =================
var SUPABASE_URL = 'https://fcrjkfiodvfhzamayvoe.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjcmprZmlvZHZmaHphbWF5dm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTcwMTQsImV4cCI6MjA5OTY5MzAxNH0.C3Ls4QMoYWnFciuOURZ7-WLmGa4TWtBsedhURVNulKI';
var APP_ID = '54679388';
var MY_VK_ID = 588689950;
var GROUP_ID = 240295160;
var GROUP_TOKEN = 'vk1.a._X1e4fN42aOmjRD8TqAfrd-r8MrNBwt1fA1s8klGu05Nkgk1A_hkfOeK3ymr1onB2vSZGv0dA6-8O3ax_eHcbf6m31i0UJIJWtm3lmvmRgm8K8nZ80a7xYnJZEIUqpAjddtV5GzbNDaxmmVK1qOZ94uBWxXpftV6zinOF9Rs-V-Vds4hp0mSFIGnKxKEI15rhOd-CLLznlmRthmA6dBZWw';
var GROUP_URL = 'https://vk.ru/club' + GROUP_ID;
var TEAM_PAGE_SIZE = 20;

// Глобальные переменные
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
var currentUser = null;
var currentVkUser = null;
var topSubtab = 'players';
var myTeam = [];
var myTeamTotal = 0;
var myTeamOffset = 0;

// ================= НАЗВАНИЯ ДОЛЖНОСТЕЙ (100 уровней) =================
var JOB_TITLES = [
    '🧪 Лаборант', '📋 Мл. специалист', '🔬 Исследователь', '📊 Аналитик', '💡 Инженер-стажёр',
    '⚙️ Инженер', '🔧 Ст. инженер', '🏭 Ведущий инженер', '🧬 Технолог', '🔍 Ст. технолог',
    '📐 Научный сотрудник', '📏 Ст. научный сотрудник', '👨‍🔬 Руководитель группы', '🏗️ Зав. лабораторией', '📋 Проектный менеджер',
    '🎯 Ст. проектный менеджер', '💼 Мл. консультант', '📈 Консультант', '📊 Ст. консультант', '🏢 Ведущий консультант',
    '🔬 Мл. научный руководитель', '🧪 Научный руководитель', '👨‍💻 Разработчик', '💻 Ст. разработчик', '🖥️ Ведущий разработчик',
    '📱 Архитектор', '🏛️ Ст. архитектор', '🎨 Дизайнер систем', '🔮 Системный аналитик', '📡 Ст. системный аналитик',
    '🛡️ Специалист по безопасности', '🔒 Ст. специалист по безопасности', '📊 Финансовый аналитик', '💰 Ст. финансовый аналитик', '💹 Директор по развитию',
    '📈 Коммерческий директор', '🤝 Директор по персоналу', '👥 HR-директор', '📣 PR-директор', '🌐 Директор по маркетингу',
    '📊 Директор по продажам', '🔧 Технический директор', '💡 Директор по инновациям', '🎯 Операционный директор', '🏢 Исполнительный директор',
    '👔 Вице-президент', '💼 Ст. вице-президент', '👑 Управляющий партнёр', '🏛️ Член совета директоров', '📋 Председатель совета',
    '🌟 Региональный директор', '🌍 Международный директор', '🏆 Директор по стратегии', '🔮 Директор по прогнозированию', '💎 Кризис-менеджер',
    '🎪 Менеджер проектов', '🎯 Программный менеджер', '🏗️ Менеджер продукта', '📦 Менеджер поставок', '🚚 Логистический менеджер',
    '📊 Менеджер по качеству', '✅ Аудитор', '🔍 Ст. аудитор', '📈 Риск-менеджер', '💹 Финансовый контролёр',
    '💰 Казначей', '🏦 Инвестиционный аналитик', '📈 Портфельный менеджер', '🎯 Трейдер', '💹 Ст. трейдер',
    '🌐 Менеджер ВЭД', '🏢 Директор филиала', '🗺️ Региональный управляющий', '🏆 Директор по эффективности', '⚡ Антикризисный управляющий',
    '🎪 Ивент-менеджер', '📢 Медиа-директор', '📱 Digital-директор', '🤖 AI-стратег', '🔗 Блокчейн-архитектор',
    '🧬 Биотех-директор', '🚀 Директор по инновациям', '🛸 Футуролог', '🔭 Главный научный сотрудник', '👨‍🚀 Космический экономист',
    '🦾 Робототехник', '🧠 Нейросетевой аналитик', '📡 Квантовый инженер', '💎 Алмазный управляющий', '👑 Корпоративный магнат'
];

// Функция получения названия должности по уровню
function getJobTitle(level) {
    var lvl = Math.max(1, Math.min(100, level || 1));
    return JOB_TITLES[lvl - 1];
}

// Извлечь ref из хеша
function getRefFromHash() {
    var m = window.location.hash.match(/ref_(\d+)/);
    return m ? m[1] : null;
}

// Запрет кэширования
(function(){
    var meta = document.createElement('meta');
    meta.httpEquiv = 'Cache-Control';
    meta.content = 'no-cache, no-store, must-revalidate';
    document.head.appendChild(meta);
    var m2 = document.createElement('meta');
    m2.httpEquiv = 'Pragma';
    m2.content = 'no-cache';
    document.head.appendChild(m2);
    var m3 = document.createElement('meta');
    m3.httpEquiv = 'Expires';
    m3.content = '0';
    document.head.appendChild(m3);
})();

// Звёзды
(function(){
    var c = document.getElementById('stars-canvas');
    for(var i = 0; i < 40; i++){
        var s = document.createElement('div');
        s.className = 'star';
        s.style.cssText = 'left:' + Math.random()*100 + '%;top:' + Math.random()*100 + '%;width:' + Math.random()*2 + 'px;height:' + Math.random()*2 + 'px;--dur:' + (2+Math.random()*4) + 's;animation-delay:' + Math.random()*4 + 's';
        c.appendChild(s);
    }
})();
