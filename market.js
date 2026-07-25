// ================= БИРЖА ТРУДА =================

async function loadMarketScreen() {
    var c = document.getElementById('market-content');
    c.innerHTML = 'Загрузка...';
    var result = await supabase.from('players').select('*').eq('status', 'Биржа труда').neq('vk_id', currentUser.vk_id).order('level', { ascending: false }).limit(100);
    if(!result.data || !result.data.length) { c.innerHTML = '<p style="color:#aaa;text-align:center;">На бирже никого нет</p>'; return; }
    c.innerHTML = '<p style="font-size:11px;color:#aaa;margin-bottom:10px;">Найдено ' + result.data.length + ' безработных</p>';
    result.data.forEach(function(player) {
        // ✅ СОХРАНЯЕМ ССЫЛКУ НА КАРТОЧКУ
        var card = renderEmployeeCard(player, c, false, true);
        var cost = player.hire_cost || 100;
        var btn = document.createElement('button');
        btn.className = 'btn-hire-small';
        btn.textContent = '💼 ' + cost;
        btn.onclick = function(e) { e.stopPropagation(); hirePlayer(player); };
        card.appendChild(btn);  // ✅ ПРИКРЕПЛЯЕМ К КАРТОЧКЕ
    });
}
