// ================= СОЗДАНИЕ КОМПАНИИ =================

async function createCompany() {
    try {
        console.log('1. Запрашиваем токен...');
        var tokenResult = await vkBridge.send('VKWebAppGetAuthToken', {
            app_id: String(APP_ID),
            scope: 'groups'
        });
        console.log('2. Токен получен:', tokenResult);
        
        if(!tokenResult || !tokenResult.access_token) {
            toast('Не удалось получить доступ к группам', 'error');
            return;
        }
        
        console.log('3. Запрашиваем группы...');
        var groupsResult = await vkBridge.send('VKWebAppCallAPIMethod', {
            method: 'groups.get',
            params: {
                filter: 'admin',
                extended: 1,
                access_token: tokenResult.access_token,
                v: '5.199'
            }
        });
        console.log('4. Группы получены:', groupsResult);
        
        // Проверяем, есть ли группы
        if(!groupsResult || !groupsResult.response || !groupsResult.response.items || groupsResult.response.items.length === 0) {
            toast('❌ У вас нет групп в управлении', 'info');
            return;
        }
        
        var groups = groupsResult.response.items;
        
        var modal = document.getElementById('input-modal');
        document.getElementById('input-modal-title').textContent = 'Выберите группу';
        var input = document.getElementById('input-modal-input');
        input.style.display = 'none';
        
        // Удаляем старый список, если есть
        var oldList = document.getElementById('groups-list');
        if(oldList) oldList.remove();
        
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
                var oldList2 = document.getElementById('groups-list');
                if(oldList2) oldList2.remove();
                input.style.display = 'block';
                
                // Проверяем, не существует ли уже компания с таким названием
                supabase.from('players')
                    .select('company')
                    .eq('company', g.name)
                    .limit(1)
                    .then(function(existing) {
                        if(existing.data && existing.data.length > 0) {
                            toast('Компания с таким названием уже существует', 'error');
                            return;
                        }
                        
                        supabase.from('players').update({
                            company: g.name,
                            company_group_id: g.id
                        }).eq('vk_id', currentUser.vk_id).then(function() {
                            currentUser.company = g.name;
                            currentUser.company_group_id = g.id;
                            toast('✅ Компания «' + g.name + '» создана!', 'success');
                            location.reload();
                        });
                    });
            };
            listContainer.appendChild(item);
        });
        
        var buttonsContainer = input.parentNode;
        buttonsContainer.insertBefore(listContainer, document.getElementById('input-modal-ok').parentNode);
        
        modal.style.display = 'flex';
        
        document.getElementById('input-modal-cancel').onclick = function() {
            modal.style.display = 'none';
            var oldList3 = document.getElementById('groups-list');
            if(oldList3) oldList3.remove();
            input.style.display = 'block';
        };
        
        document.getElementById('input-modal-ok').style.display = 'none';
        
    } catch(e) {
        console.error('Ошибка создания компании:', e);
        toast('Ошибка: ' + (e.message || 'неизвестная'), 'error');
    }
}
