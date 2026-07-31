// ================= ТОП =================

function switchTopSubtab(sub) {
    topSubtab = sub;
    document.querySelectorAll('.subtab').forEach(function(s){ s.classList.remove('active'); });
    document.getElementById('subtab-' + sub).classList.add('active');
    if(sub === 'players') loadTopPlayersScreen();
    else loadTopCompaniesScreen();
}

async function loadTopPlayersScreen() {
    var c = document.getElementById('top-content');
    c.innerHTML = 'Загрузка...';
    var allResult = await supabase.from('players').select('vk_id,first_name,last_name,photo_200,experience,level,company,company_group_id,owner_id,status,hire_cost').order('experience', { ascending: false }).limit(100);
    if(allResult.error) { c.innerHTML = 'Ошибка'; return; }
    c.innerHTML = '';
    if(!allResult.data.length) { c.innerHTML = '<p style="color:#aaa;">Нет данных</p>'; return; }
    allResult.data.forEach(function(p, i) {
        var rc = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
        var isMe = p.vk_id === currentUser.vk_id;
        var lvl = p.level || 1;
        var jobTitle = getJobTitle(lvl);
        var cost = p.hire_cost || 100;
        var canHire = p.vk_id !== currentUser.vk_id && !(currentUser.owner_id && currentUser.owner_id === p.vk_id);
        
        var div = document.createElement('div');
        div.className = 'player-item';
        div.style.background = isMe ? 'rgba(76,175,80,0.1)' : '';
        div.style.cursor = 'pointer';
        div.onclick = function(){ openPlayerModalById(p.vk_id); };
        
        div.innerHTML = '<div class="rank ' + rc + '">' + (i+1) + '</div>' +
            '<img src="' + (p.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="event.stopPropagation();window.open(\'https://vk.com/id' + p.vk_id + '\',\'_blank\')">' +
            '<div class="info"><div class="name">' + p.first_name + ' ' + p.last_name + (isMe ? ' ⭐' : '') + '</div>' +
            '<div class="detail">' + jobTitle + ' (ур.' + lvl + ')</div>' +
            '<div class="detail" style="color:#4caf50;">📈 +' + lvl + ' оп/час</div>' +
            '<div class="detail" style="color:#ffd700;">⭐ ' + (p.experience || 0) + ' опыта</div>';
        
        if(p.company) {
            div.querySelector('.info').innerHTML += '<div class="detail" style="color:#ff9800;cursor:pointer;" onclick="event.stopPropagation();openCompanyModal(\'' + p.company + '\')">🏢 ' + p.company + '</div>';
        }
        
        div.querySelector('.info').innerHTML += '</div>';
        
        if(canHire) {
            var hireBtn = document.createElement('button');
            hireBtn.className = 'btn-hire-small';
            hireBtn.textContent = '💼 ' + cost;
            hireBtn.onclick = function(e) { e.stopPropagation(); hirePlayer(p); };
            div.appendChild(hireBtn);
        }
        
        c.appendChild(div);
    });
}

async function loadTopCompaniesScreen() {
    var c = document.getElementById('top-content');
    c.innerHTML = 'Загрузка...';
    var r = await supabase.from('players').select('company,experience,company_group_id').not('company', 'is', null);
    if(r.error) { c.innerHTML = 'Ошибка'; return; }
    var comps = {};
    r.data.forEach(function(p) {
        if(!p.company) return;
        if(!comps[p.company]) comps[p.company] = { name: p.company, totalExp: 0, count: 0, groupId: p.company_group_id };
        comps[p.company].totalExp += (p.experience || 0);
        comps[p.company].count++;
    });
    var sorted = Object.values(comps).sort(function(a, b){ return b.totalExp - a.totalExp; });
    c.innerHTML = '';
    if(!sorted.length) { c.innerHTML = '<p style="color:#aaa;">Компаний пока нет</p>'; }
    sorted.forEach(function(co, i) {
        var isMine = co.name === currentUser.company;
        var div = document.createElement('div');
        div.className = 'player-item';
        div.style.background = isMine ? 'rgba(76,175,80,0.1)' : '';
        div.style.cursor = 'pointer';
        var groupIcon = co.groupId ? ' 📱' : '';
        var avatarHtml = co.groupId ? '<img src="https://vk.com/images/community_200.png?gid=' + co.groupId + '" style="width:36px;height:36px;border-radius:50%;margin-right:8px;flex-shrink:0;" onerror="this.style.display=\'none\'">' : '';
        div.innerHTML = '<div style="font-weight:700;width:25px;">' + (i+1) + '.</div>' + avatarHtml + '<div class="info"><div class="name">' + co.name + groupIcon + (isMine ? ' ⭐' : '') + '</div><div class="detail">👥 ' + co.count + ' уч. • ⭐' + co.totalExp + ' опыта</div></div>';
        div.onclick = function(){ if(co.groupId) window.open('https://vk.com/club' + co.groupId, '_blank'); openCompanyModal(co.name); };
        c.appendChild(div);
    });
    if(!currentUser.company) {
        var btn = document.createElement('button');
        btn.className = 'btn-create';
        btn.textContent = '🚀 Создать компанию';
        btn.onclick = createCompany;
        c.appendChild(btn);
    }
}

// ================= МОЯ КОМПАНИЯ =================
async function loadMyCompanyScreen() {
    if(!currentUser.company) {
        document.getElementById('my-company-name').textContent = 'У вас нет компании';
        document.getElementById('my-company-stats').textContent = '';
        
        // Проверяем, открыто ли приложение в мобильном VK
        var isMobile = false;
        try {
            // Проверяем через user-agent
            var ua = navigator.userAgent;
            if (/VKMobile/i.test(ua) || /Android.*VK/i.test(ua) || /iPhone.*VK/i.test(ua)) {
                isMobile = true;
            }
            
            // Дополнительная проверка через VK Bridge
            if (!isMobile && window.vkBridge) {
                var info = await vkBridge.send('VKWebAppGetClientVersion').catch(function() { return null; });
                if (info && info.client_version) {
                    isMobile = true;
                }
            }
        } catch(e) {
            isMobile = false;
        }
        
        var html = '<p style="color:#aaa;text-align:center;margin:20px 0 10px 0;">Создайте компанию из своей группы ВК!</p>';
        html += '<p style="font-size:12px; color:#8b949e; text-align:center; margin-bottom:15px;">ℹ️ Создать компанию можно, если у вас есть группа ВКонтакте, где вы администратор.</p>';
        
        if (isMobile) {
            html += '<button class="btn-create" onclick="createCompany()">🚀 Создать компанию</button>';
        } else {
            html += '<p style="color:#f44336;text-align:center;font-size:13px;padding:10px;background:rgba(244,67,54,0.1);border-radius:8px;">📱 Создание компании доступно только в мобильном приложении VK</p>';
        }
        
        document.getElementById('my-company-members').innerHTML = html;
        document.getElementById('my-company-leave-btn').style.display = 'none';
        return;
    }
    
    document.getElementById('my-company-name').textContent = currentUser.company;
    if(currentUser.company_group_id) {
        document.getElementById('my-company-name').innerHTML += ' <a href="https://vk.com/club' + currentUser.company_group_id + '" target="_blank" style="color:#4a76a8;font-size:12px;">📱 Группа</a>';
    }
    var r = await supabase.from('players').select('*').eq('company', currentUser.company).order('level', { ascending: false });
    if(r.data) {
        document.getElementById('my-company-stats').textContent = '👥 ' + r.data.length + ' сотрудников';
        var list = document.getElementById('my-company-members');
        list.innerHTML = '';
        r.data.forEach(function(p, i) {
            var lvl = p.level || 1;
            var div = document.createElement('div');
            div.className = 'player-item';
            div.style.cursor = 'pointer';
            div.onclick = function(){ openPlayerModalById(p.vk_id); };
            div.innerHTML = '<div style="font-weight:700;width:25px;">' + (i+1) + '.</div>' +
                '<img src="' + (p.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'">' +
                '<div class="info"><div class="name">' + p.first_name + ' ' + p.last_name + '</div>' +
                '<div class="detail">' + getJobTitle(lvl) + ' (ур.' + lvl + ')</div>' +
                '<div class="detail" style="color:#4caf50;">📈 +' + lvl + ' оп/час</div>' +
                '<div class="detail" style="color:#ffd700;">⭐ ' + (p.experience || 0) + ' опыта</div></div>';
            list.appendChild(div);
        });
    }
    document.getElementById('my-company-leave-btn').style.display = 'block';
    document.getElementById('my-company-leave-btn').onclick = async function() {
        await supabase.from('players').update({ 
            company: null, 
            company_group_id: null,
            status: 'Биржа труда'
        }).eq('vk_id', currentUser.vk_id);
        currentUser.company = null;
        currentUser.company_group_id = null;
        currentUser.status = 'Биржа труда';
        toast('Вышли из компании', 'info');
        goTo('profile');
        location.reload();
    };
}
