// ================= СОЗДАНИЕ КОМПАНИИ =================

async function createCompany() {
    try {
        var tokenResult = await vkBridge.send('VKWebAppGetAuthToken', {
            app_id: String(APP_ID),  // ✅ ИСПРАВЛЕНО: теперь строка
            scope: 'groups'
        });
        
        if(!tokenResult || !tokenResult.access_token) {
            toast('Не удалось получить доступ к группам', 'error');
            return;
        }
        
        var groupsResult = await vkBridge.send('VKWebAppCallAPIMethod', {
            method: 'groups.get',
            params: {
                filter: 'admin',
                extended: 1,
                access_token: tokenResult.access_token,
                v: '5.199'
            }
        });
        
        if(groupsResult && groupsResult.response && groupsResult.response.items && groupsResult.response.items.length > 0) {
            var groups = groupsResult.response.items;
            
            var modal = document.getElementById('input-modal');
            document.getElementById('input-modal-title').textContent = 'Выберите группу';
            var input = document.getElementById('input-modal-input');
            input.style.display = 'none';
            
            var listContainer = document.createElement('div');
            listContainer.id = 'groups-list';
            listContainer.style.cssText = 'max-height:300px;overflow-y:auto;margin:10px 0;';
            
            groups.forEach(function(g) {
                var item = document.createElement('div');
                item.style.cssText = 'padding:12px;margin:4px 0;background:rgba(255,255,255,0.08);border-radius:8px;cursor:pointer;font-size:14px;transition:0.2s;';
                item.textContent = g.name;
                item.onmouseover = function() { this.style.background = 'rgba(74,118,168,0.4)'; };
                item.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.08)'; };
                item.onclick = function() {
                    modal.style.display = 'none';
                    var oldList = document.getElementById('groups-list');
                    if(oldList) oldList.remove();
                    input.style.display = 'block';
                    
                    supabase.from('players').update({
                        company: g.name,
                        company_group_id: g.id
                    }).eq('vk_id', currentUser.vk_id).then(function() {
                        currentUser.company = g.name;
                        currentUser.company_group_id = g.id;
                        toast('✅ Компания «' + g.name + '» создана!', 'success');
                        location.reload();
                    });
                };
                listContainer.appendChild(item);
            });
            
            var buttonsContainer = input.parentNode;
            buttonsContainer.insertBefore(listContainer, document.getElementById('input-modal-ok').parentNode);
            
            modal.style.display = 'flex';
            
            document.getElementById('input-modal-cancel').onclick = function() {
                modal.style.display = 'none';
                var oldList = document.getElementById('groups-list');
                if(oldList) oldList.remove();
                input.style.display = 'block';
            };
            
            document.getElementById('input-modal-ok').style.display = 'none';
            
        } else {
            toast('У вас нет групп для управления', 'error');
        }
    } catch(e) {
        console.error(e);
        toast('Ошибка получения групп. Попробуйте позже.', 'error');
    }
}

// ================= МОДАЛКА ИГРОКА =================
async function openPlayerModalById(vkId) {
    var r = await supabase.from('players').select('*').eq('vk_id', vkId).maybeSingle();
    if(r.data) {
        var modal = document.getElementById('player-modal');
        modal.style.display = 'flex';
        renderPlayerModalContent(r.data);
    }
}

function closePlayerModal() { document.getElementById('player-modal').style.display = 'none'; }

// ================= МОДАЛКА КОМПАНИИ =================
async function openCompanyModal(name) {
    var r0 = await supabase.from('players').select('company,company_group_id').eq('company', name).limit(1);
    var groupId = (r0.data && r0.data.length > 0) ? r0.data[0].company_group_id : null;
    document.getElementById('company-modal').style.display = 'flex';
    
    var avatarHtml = groupId ? '<img src="https://vk.com/images/community_200.png?gid=' + groupId + '" style="width:40px;height:40px;border-radius:50%;vertical-align:middle;margin-right:10px;" onerror="this.style.display=\'none\'">' : '';
    document.getElementById('modal-company-name').innerHTML = avatarHtml + '🏢 ' + name;
    
    if(groupId) document.getElementById('modal-company-name').innerHTML += ' <a href="https://vk.com/club' + groupId + '" target="_blank" style="color:#4a76a8;font-size:13px;">📱</a>';
    var r = await supabase.from('players').select('*').eq('company', name);
    if(r.data) {
        document.getElementById('modal-company-stats').textContent = '👥 ' + r.data.length + ' сотрудников';
        var list = document.getElementById('modal-company-members');
        list.innerHTML = '';
        r.data.forEach(function(p) {
            var lvl = p.level || 1;
            var div = document.createElement('div');
            div.className = 'player-item';
            div.style.cursor = 'pointer';
            div.onclick = function(){ closeCompanyModal(); openPlayerModalById(p.vk_id); };
            div.innerHTML = '<img src="' + (p.photo_200 || 'https://vk.com/images/camera_200.png') + '" onerror="this.src=\'https://vk.com/images/camera_200.png\'">' +
                '<div class="info"><div class="name">' + p.first_name + ' ' + p.last_name + '</div>' +
                '<div class="detail">' + getJobTitle(lvl) + ' (ур.' + lvl + ')</div>' +
                '<div class="detail" style="color:#4caf50;">📈 +' + lvl + ' оп/час</div>' +
                '<div class="detail" style="color:#ffd700;">⭐ ' + (p.experience || 0) + ' опыта</div></div>';
            list.appendChild(div);
        });
        var jb = document.getElementById('modal-join-btn');
        var lb = document.getElementById('modal-leave-btn');
        jb.style.display = 'none';
        lb.style.display = 'none';
        if(currentUser.company === name) {
            lb.style.display = 'block';
            lb.textContent = '🚪 Выйти из компании (бесплатно)';
            lb.onclick = async function() {
                await supabase.from('players').update({ company: null, company_group_id: null }).eq('vk_id', currentUser.vk_id);
                currentUser.company = null;
                currentUser.company_group_id = null;
                toast('Вышли из компании', 'info');
                closeCompanyModal();
                location.reload();
            };
        } else {
            jb.style.display = 'block';
            jb.onclick = async function() {
                await supabase.from('players').update({ company: name }).eq('vk_id', currentUser.vk_id);
                currentUser.company = name;
                toast('✅ Вступили!', 'success');
                closeCompanyModal();
                location.reload();
            };
        }
    }
}

function closeCompanyModal() { document.getElementById('company-modal').style.display = 'none'; }

// ================= НАСТРОЙКИ =================
function openSettings() {
    document.getElementById('settings-modal').style.display = 'flex';
    document.getElementById('promo-input').value = '';
    document.getElementById('promo-go-btn').onclick = applyPromo;
}

function closeSettings() { document.getElementById('settings-modal').style.display = 'none'; }

async function applyPromo() {
    var code = document.getElementById('promo-input').value.trim().toUpperCase();
    if(!code) { toast('Введите промокод!', 'error'); return; }
    var r = await supabase.from('promocodes').select('*').eq('code', code).maybeSingle();
    if(!r.data) { toast('Промокод не найден!', 'error'); return; }
    var promo = r.data;
    if(promo.used_by && promo.used_by.includes(currentUser.vk_id)) { toast('Вы уже использовали!', 'error'); return; }
    if(promo.used_by && promo.used_by.length >= promo.max_uses) { toast('Промокод не действует!', 'error'); return; }
    var newExp = (currentUser.experience || 0) + promo.reward_exp + 1000;
    await supabase.from('players').update({ experience: newExp }).eq('vk_id', currentUser.vk_id);
    currentUser.experience = newExp;
    var usedBy = promo.used_by || [];
    usedBy.push(currentUser.vk_id);
    await supabase.from('promocodes').update({ used_by: usedBy }).eq('code', code);
    await supabase.from('players').update({ task_promo_done: true }).eq('vk_id', currentUser.vk_id);
    currentUser.task_promo_done = true;
    toast('🎁 +' + (promo.reward_exp + 1000) + ' опыта!', 'success');
    closeSettings();
    renderAll();
    renderTasks();
}

// ================= ПРИГЛАШЕНИЕ =================
function inviteFriend() {
    var refLink = 'https://vk.com/app' + APP_ID + '#ref_' + currentUser.vk_id;
    vkBridge.send('VKWebAppShare', { link: refLink, text: '🎮 Присоединяйся к Корпоративным Играм! Стань моим сотрудником!' })
        .then(function(){ toast('✅ Отправлено!', 'success'); })
        .catch(function() {
            navigator.clipboard.writeText(refLink)
                .then(function(){ toast('🔗 Скопировано!', 'info'); })
                .catch(function(){ toast('Не удалось отправить', 'error'); });
        });
}
