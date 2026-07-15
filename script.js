// ================= НАСТРОЙКИ =================
var SUPABASE_URL = 'https://fcrjkfiodvfhzamayvoe.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjcmprZmlvZHZmaHphbWF5dm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTcwMTQsImV4cCI6MjA5OTY5MzAxNH0.C3Ls4QMoYWnFciuOURZ7-WLmGa4TWtBsedhURVNulKI';
var APP_ID = '54679388';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
var currentUser = null, currentVkUser = null, currentTab = 'market', topSubtab = 'players';
var myTeam = [], myTeamTotal = 0, myTeamOffset = 0, TEAM_PAGE_SIZE = 20;

function toast(m,t){t=t||'info';var c=document.getElementById('toast-container'),e=document.createElement('div');e.className='toast '+t;e.textContent=m;c.appendChild(e);setTimeout(function(){e.remove()},2800)}
function openVkProfile(){if(currentVkUser)window.open('https://vk.com/id'+currentVkUser.id,'_blank')}
function getRefFromHash(){var m=window.location.hash.match(/ref_(\d+)/);return m?m[1]:null}

// ================= ЗАПУСК =================
window.addEventListener('load',function(){if(typeof vkBridge!=='undefined')vkBridge.send('VKWebAppInit').then(initApp)});

async function initApp(){
    try{
        currentVkUser=await vkBridge.send('VKWebAppGetUserInfo');
        var invitedBy=getRefFromHash()||new URLSearchParams(window.location.search).get('ref');
        if(invitedBy&&parseInt(invitedBy)===currentVkUser.id)invitedBy=null;
        var r=await supabase.from('players').select('*').eq('vk_id',currentVkUser.id).maybeSingle();
        if(r.error)throw r.error;
        if(!r.data){
            await supabase.from('players').insert([{vk_id:currentVkUser.id,first_name:currentVkUser.first_name,last_name:currentVkUser.last_name,photo_200:currentVkUser.photo_200||'',status:'Биржа труда',company:null,role:null,experience:0,income_per_hour:0,invited_by:invitedBy?parseInt(invitedBy):null,last_collect:new Date().toISOString(),pending_experience:0,level:1,hire_cost:100,owner_id:null}]);
            if(invitedBy)await giveReferralBonus(parseInt(invitedBy));
            location.reload();return;
        }
        currentUser=r.data;
        if(currentUser.owner_id===undefined){await supabase.from('players').update({owner_id:null,last_collect:new Date().toISOString(),pending_experience:0}).eq('vk_id',currentUser.vk_id);currentUser.owner_id=null}
        await loadOwnerInfo();
        await updateAllStats();
        renderAll();
    }catch(e){console.error(e)}
}

// ================= ИНФО О ВЛАДЕЛЬЦЕ =================
async function loadOwnerInfo(){
    if(currentUser.owner_id&&currentUser.owner_id!==currentUser.vk_id){
        var r=await supabase.from('players').select('first_name,last_name,vk_id').eq('vk_id',currentUser.owner_id).maybeSingle();
        if(r.data){
            document.getElementById('owner-info').innerHTML='🔒 Нанят: <b onclick="openPlayerModalById('+r.data.vk_id+')" style="cursor:pointer;text-decoration:underline;">'+r.data.first_name+' '+r.data.last_name+'</b>';
        }
    }else{
        document.getElementById('owner-info').textContent='';
    }
}

// ================= СТАТИСТИКА (один запрос вместо трёх) =================
async function updateAllStats(){
    var empResult=await supabase.from('players').select('vk_id,income_per_hour,hire_cost,level,first_name,last_name,photo_200,experience,owner_id').eq('owner_id',currentUser.vk_id).order('experience',{ascending:false});
    myTeam=empResult.data||[];
    myTeamTotal=myTeam.length;
    var totalIncome=0;
    myTeam.forEach(function(e){totalIncome+=(e.income_per_hour||0)});
    // Если нанят — доход в 2 раза меньше
    if(currentUser.owner_id&&currentUser.owner_id!==currentUser.vk_id)totalIncome=Math.floor(totalIncome/2);
    document.getElementById('my-employees-count').textContent=myTeamTotal;
    document.getElementById('my-income').textContent='+'+totalIncome;
    document.getElementById('my-team-total').textContent=myTeamTotal;
    // Кнопка «Уволиться»
    var quitBtn=document.getElementById('quit-job-btn');
    if(currentUser.owner_id&&currentUser.owner_id!==currentUser.vk_id){
        var myCost=currentUser.hire_cost||100;
        quitBtn.style.display='block';
        quitBtn.textContent='🚪 Уволиться (цена: '+myCost+' опыта)';
        quitBtn.onclick=async function(){
            if(currentUser.experience<myCost){toast('Недостаточно опыта! Нужно '+myCost,'error');return}
            await supabase.from('players').update({experience:currentUser.experience-myCost,owner_id:null,status:'Биржа труда',role:null}).eq('vk_id',currentUser.vk_id);
            currentUser.experience-=myCost;currentUser.owner_id=null;currentUser.status='Биржа труда';currentUser.role=null;
            toast('Вы уволились! -'+myCost+' опыта','info');
            location.reload();
        };
    }else{quitBtn.style.display='none'}
    // Опыт
    await calculatePendingExperience();
}

async function calculatePendingExperience(){
    if(!myTeam.length)return;
    var totalPerHour=0;
    myTeam.forEach(function(e){totalPerHour+=(e.income_per_hour||0)});
    if(currentUser.owner_id&&currentUser.owner_id!==currentUser.vk_id)totalPerHour=Math.floor(totalPerHour/2);
    var hoursPassed=(new Date()-new Date(currentUser.last_collect||new Date()))/3600000;
    var newPending=Math.floor((currentUser.pending_experience||0)+totalPerHour*hoursPassed);
    await supabase.from('players').update({pending_experience:newPending,last_collect:new Date().toISOString()}).eq('vk_id',currentUser.vk_id);
    currentUser.pending_experience=newPending;
}

async function collectExperience(){
    if(!currentUser.pending_experience){toast('Нечего собирать','info');return}
    var collected=currentUser.pending_experience;
    await supabase.from('players').update({experience:(currentUser.experience||0)+collected,pending_experience:0,last_collect:new Date().toISOString()}).eq('vk_id',currentUser.vk_id);
    currentUser.experience+=collected;currentUser.pending_experience=0;
    toast('✅ +'+collected+' опыта!','success');renderAll();
}

async function giveReferralBonus(id){
    var r=await supabase.from('players').select('experience').eq('vk_id',id).maybeSingle();
    if(r.data)await supabase.from('players').update({experience:(r.data.experience||0)+500}).eq('vk_id',id);
}

// ================= ВКЛАДКИ =================
function switchTab(tab){
    currentTab=tab;
    document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active')});
    document.getElementById('tab-'+tab).classList.add('active');
    document.getElementById('top-subtabs').style.display=(tab==='top')?'block':'none';
    if(tab==='market')loadMarket();else if(tab==='top'){if(topSubtab==='players')loadTopPlayers();else loadClans()}
}
function switchTopSubtab(sub){
    topSubtab=sub;
    document.querySelectorAll('.subtab').forEach(function(s){s.classList.remove('active')});
    document.getElementById('subtab-'+sub).classList.add('active');
    if(sub==='players')loadTopPlayers();else loadClans();
}

// ================= МОЯ КОМАНДА (из кеша) =================
function loadMyTeam(reset){
    if(reset){myTeamOffset=0;document.getElementById('my-team-list').innerHTML=''}
    var list=document.getElementById('my-team-list');
    if(!myTeam.length){list.innerHTML='<p style="color:#888;text-align:center;">У вас пока нет сотрудников</p>';document.getElementById('load-more-btn').style.display='none';return}
    var page=myTeam.slice(myTeamOffset,myTeamOffset+TEAM_PAGE_SIZE);
    page.forEach(function(emp){renderEmployeeItem(emp,list,true)});
    myTeamOffset+=page.length;
    document.getElementById('load-more-btn').style.display=(myTeamOffset<myTeamTotal)?'block':'none';
}

function renderEmployeeItem(emp,container,isMine){
    var cost=Math.floor(emp.hire_cost||100),upgradeCost=Math.floor(cost*1.5),fireIncome=Math.floor(cost*0.8);
    var div=document.createElement('div');div.className='player-item';
    div.innerHTML='<img src="'+(emp.photo_200||'https://vk.com/images/camera_200.png')+'" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="openPlayerModalById('+emp.vk_id+')">'+
        '<div class="info" onclick="openPlayerModalById('+emp.vk_id+')"><div class="name">'+emp.first_name+' '+emp.last_name+'<span class="lvl">'+(emp.level||1)+' ур</span></div>'+
        '<div class="detail">🔬 +'+(emp.income_per_hour||0)+' оп/час • 💰'+cost+'</div></div>';
    if(isMine){
        div.innerHTML+='<div class="btn-group"><button class="btn-upgrade">⬆ '+upgradeCost+'</button><button class="btn-fire">🔥 +'+fireIncome+'</button></div>';
    }
    container.appendChild(div);
    if(isMine){
        div.querySelector('.btn-upgrade').onclick=async function(e){e.stopPropagation();await upgradeEmployee(emp)};
        div.querySelector('.btn-fire').onclick=async function(e){e.stopPropagation();await fireEmployee(emp)};
    }
}

async function upgradeEmployee(emp){
    var cost=Math.floor((emp.hire_cost||100)*1.5);
    if(currentUser.experience<cost){toast('Недостаточно опыта! Нужно '+cost,'error');return}
    await supabase.from('players').update({experience:currentUser.experience-cost}).eq('vk_id',currentUser.vk_id);
    var newCost=Math.floor((emp.hire_cost||100)*1.5);
    await supabase.from('players').update({level:(emp.level||1)+1,income_per_hour:(emp.income_per_hour||0)+1,hire_cost:newCost}).eq('vk_id',emp.vk_id);
    currentUser.experience-=cost;
    toast('✅ Прокачано!','success');await updateAllStats();loadMyTeam(true);renderAll();
}

async function fireEmployee(emp){
    var fireIncome=Math.floor((emp.hire_cost||100)*0.8);
    await supabase.from('players').update({experience:(currentUser.experience||0)+fireIncome}).eq('vk_id',currentUser.vk_id);
    await supabase.from('players').update({owner_id:null,status:'Биржа труда',role:null,income_per_hour:0,level:1,hire_cost:100}).eq('vk_id',emp.vk_id);
    currentUser.experience+=fireIncome;
    toast('🔥 Уволен! +'+fireIncome+' опыта','info');await updateAllStats();loadMyTeam(true);renderAll();
}

// ================= БИРЖА =================
async function loadMarket(){
    var c=document.getElementById('tab-content');c.innerHTML='Загрузка...';
    var r=await supabase.from('players').select('*').eq('status','Биржа труда').neq('vk_id',currentUser.vk_id).order('experience',{ascending:false}).limit(50);
    if(r.error){c.innerHTML='Ошибка';return}
    if(!r.data.length){c.innerHTML='<p style="color:#888;text-align:center;">Биржа пуста</p>';return}
    c.innerHTML='';
    r.data.forEach(function(p){
        var div=document.createElement('div');div.className='player-item';
        div.innerHTML='<img src="'+(p.photo_200||'https://vk.com/images/camera_200.png')+'" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="openPlayerModalById('+p.vk_id+')">'+
            '<div class="info" onclick="openPlayerModalById('+p.vk_id+')"><div class="name">'+p.first_name+' '+p.last_name+'</div><div class="detail">⭐'+(p.experience||0)+'</div></div>'+
            '<button class="btn-hire" data-id="'+p.vk_id+'">💼 100</button>';
        c.appendChild(div);
    });
    c.querySelectorAll('.btn-hire').forEach(function(b){b.onclick=async function(e){e.stopPropagation();await hirePlayer(parseInt(this.getAttribute('data-id')))}});
}

async function hirePlayer(empId){
    if(currentUser.experience<100){toast('Недостаточно опыта!','error');return}
    await supabase.from('players').update({experience:currentUser.experience-100}).eq('vk_id',currentUser.vk_id);
    await supabase.from('players').update({owner_id:currentUser.vk_id,status:'Работает',role:'Учёный',income_per_hour:1,level:1,hire_cost:100}).eq('vk_id',empId);
    currentUser.experience-=100;
    toast('✅ Нанят!','success');await updateAllStats();loadMyTeam(true);renderAll();loadMarket();
}

// ================= ТОП =================
async function loadTopPlayers(){
    var c=document.getElementById('tab-content');c.innerHTML='Загрузка...';
    var r=await supabase.from('players').select('*').order('experience',{ascending:false}).limit(100);
    if(r.error){c.innerHTML='Ошибка';return}
    c.innerHTML='';
    r.data.forEach(function(p,i){
        var rc=i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'',isMe=p.vk_id===currentUser.vk_id;
        var div=document.createElement('div');div.className='player-item';div.style.background=isMe?'#e8f5e9':'';
        div.innerHTML='<div class="rank '+rc+'">'+(i+1)+'</div><img src="'+(p.photo_200||'https://vk.com/images/camera_200.png')+'" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="event.stopPropagation();window.open(\'https://vk.com/id'+p.vk_id+'\',\'_blank\')">'+
            '<div class="info"><div class="name">'+p.first_name+' '+p.last_name+(isMe?' ⭐':'')+'</div><div class="detail">⭐'+(p.experience||0)+'</div></div>';
        div.onclick=function(){openPlayerModalById(p.vk_id)};c.appendChild(div);
    });
}

// ================= МОДАЛКА ИГРОКА (с кнопкой Нанять) =================
async function openPlayerModalById(vkId){
    var r=await supabase.from('players').select('*').eq('vk_id',vkId).maybeSingle();
    if(r.data)openPlayerModal(r.data);
}

function openPlayerModal(player){
    var modal=document.getElementById('player-modal');modal.style.display='flex';
    document.getElementById('modal-player-header').innerHTML='<img src="'+(player.photo_200||'https://vk.com/images/camera_200.png')+'" style="width:50px;height:50px;border-radius:50%;vertical-align:middle;margin-right:10px;cursor:pointer;" onclick="window.open(\'https://vk.com/id'+player.vk_id+'\',\'_blank\')"><span style="font-size:18px;font-weight:700;">'+player.first_name+' '+player.last_name+'</span>';
    
    var hireBtn=document.getElementById('modal-hire-btn');
    // Кнопка Нанять (если игрок на бирже И не я сам)
    if(player.status==='Биржа труда'&&player.vk_id!==currentUser.vk_id){
        hireBtn.style.display='block';hireBtn.textContent='💼 Нанять за 100 опыта';
        hireBtn.onclick=async function(){await hirePlayer(player.vk_id);closePlayerModal()};
    }else{hireBtn.style.display='none'}
    
    // Загружаем сотрудников
    supabase.from('players').select('*').eq('owner_id',player.vk_id).order('experience',{ascending:false}).then(function(r){
        var list=document.getElementById('modal-player-employees');
        if(!r.data||!r.data.length){
            document.getElementById('modal-player-stats').textContent='⭐'+(player.experience||0)+' • Нет сотрудников';
            list.innerHTML='<p style="color:#888;text-align:center;">Нет сотрудников</p>';
        }else{
            document.getElementById('modal-player-stats').textContent='⭐'+(player.experience||0)+' • 👥 '+r.data.length+' сотр.';
            list.innerHTML='';
            r.data.forEach(function(emp){
                var stealCost=Math.floor((emp.hire_cost||100)*1.5);
                var div=document.createElement('div');div.className='player-item';
                div.innerHTML='<img src="'+(emp.photo_200||'https://vk.com/images/camera_200.png')+'" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="event.stopPropagation();openPlayerModalById('+emp.vk_id+')">'+
                    '<div class="info" onclick="openPlayerModalById('+emp.vk_id+')"><div class="name">'+emp.first_name+' '+emp.last_name+'<span class="lvl">'+(emp.level||1)+' ур</span></div>'+
                    '<div class="detail">🔬 +'+(emp.income_per_hour||0)+' оп/час • 💰'+(emp.hire_cost||100)+'</div></div>';
                if(emp.owner_id!==currentUser.vk_id&&emp.vk_id!==currentUser.vk_id){
                    var btn=document.createElement('button');btn.className='btn-steal';btn.textContent='💰 '+stealCost;
                    btn.onclick=async function(e){e.stopPropagation();
                        if(currentUser.experience<stealCost){toast('Недостаточно опыта!','error');return}
                        await supabase.from('players').update({experience:currentUser.experience-stealCost}).eq('vk_id',currentUser.vk_id);
                        await supabase.from('players').update({owner_id:currentUser.vk_id,hire_cost:stealCost}).eq('vk_id',emp.vk_id);
                        currentUser.experience-=stealCost;toast('✅ Перекуплен!','success');
                        closePlayerModal();renderAll();updateAllStats();loadMyTeam(true);
                    };div.appendChild(btn);
                }
                list.appendChild(div);
            });
        }
    });
}
function closePlayerModal(){document.getElementById('player-modal').style.display='none'}

// ================= КЛАНЫ =================
async function loadClans(){
    var c=document.getElementById('tab-content');c.innerHTML='Загрузка...';
    var r=await supabase.from('players').select('company').neq('company',null);
    if(r.error){c.innerHTML='Ошибка';return}
    var clans={};r.data.forEach(function(p){if(!p.company)return;if(!clans[p.company])clans[p.company]={name:p.company,count:0};clans[p.company].count++});
    var sorted=Object.values(clans).sort(function(a,b){return b.count-a.count});
    c.innerHTML='';if(!sorted.length){c.innerHTML='<p style="color:#888;text-align:center;">Кланов нет</p>'}
    sorted.forEach(function(cl,i){
        var isMine=cl.name===currentUser.company;
        var div=document.createElement('div');div.className='player-item';div.style.background=isMine?'#e8f5e9':'';
        div.innerHTML='<div style="font-weight:700;width:25px;">'+(i+1)+'.</div><div class="info"><div class="name">'+cl.name+(isMine?' ⭐':'')+'</div><div class="detail">👥 '+cl.count+' участников</div></div>';
        div.onclick=function(){openClanModal(cl.name)};c.appendChild(div);
    });
    if(!currentUser.company){var btn=document.createElement('button');btn.className='btn-create';btn.textContent='🚀 Создать клан';btn.onclick=createClan;c.appendChild(btn)}
}

async function openClanModal(name){
    document.getElementById('clan-modal').style.display='flex';
    document.getElementById('modal-clan-name').textContent='🏢 '+name;
    var r=await supabase.from('players').select('*').eq('company',name);
    if(r.data){
        document.getElementById('modal-clan-stats').textContent='👥 '+r.data.length+' участников';
        var list=document.getElementById('modal-clan-members');list.innerHTML='';
        r.data.forEach(function(p){
            var div=document.createElement('div');div.className='player-item';
            div.innerHTML='<img src="'+(p.photo_200||'https://vk.com/images/camera_200.png')+'" onerror="this.src=\'https://vk.com/images/camera_200.png\'"><div class="info"><div class="name">'+p.first_name+' '+p.last_name+'</div><div class="detail">⭐'+(p.experience||0)+'</div></div>';
            div.onclick=function(){closeClanModal();openPlayerModalById(p.vk_id)};list.appendChild(div);
        });
        var jb=document.getElementById('modal-join-btn'),lb=document.getElementById('modal-leave-btn');
        jb.style.display='none';lb.style.display='none';
        if(currentUser.company===name){
            lb.style.display='block';var cost=Math.floor((currentUser.hire_cost||100)*1.5);
            lb.textContent='🚪 Выйти ('+cost+' опыта)';
            lb.onclick=async function(){if(currentUser.experience<cost){toast('Недостаточно опыта!','error');return}
                await supabase.from('players').update({experience:currentUser.experience-cost,company:null}).eq('vk_id',currentUser.vk_id);
                currentUser.experience-=cost;currentUser.company=null;closeClanModal();location.reload()};
        }else{jb.style.display='block';jb.onclick=async function(){await supabase.from('players').update({company:name}).eq('vk_id',currentUser.vk_id);currentUser.company=name;toast('✅ Вступили в клан!','success');closeClanModal();location.reload()}}
    }
}
function closeClanModal(){document.getElementById('clan-modal').style.display='none'}
async function createClan(){var n=prompt('Название:','Клан '+currentUser.first_name);if(!n)return;await supabase.from('players').update({company:n}).eq('vk_id',currentUser.vk_id);currentUser.company=n;toast('✅ Создан!','success');location.reload()}

// ================= РЕФЕРАЛКА =================
function copyInviteLink(){
    var link='https://vk.com/app'+APP_ID+'#ref_'+currentUser.vk_id;
    navigator.clipboard?navigator.clipboard.writeText(link).then(function(){toast('🔗 Скопировано!','info')}):prompt('Скопируй:',link);
}

// ================= ОТРИСОВКА =================
function renderAll(){
    document.getElementById('header-avatar').src=currentUser.photo_200||currentVkUser.photo_200||'https://vk.com/images/camera_200.png';
    document.getElementById('player-name').textContent=currentUser.first_name+' '+currentUser.last_name;
    document.getElementById('exp-value').textContent=currentUser.experience||0;
    var clanEl=document.getElementById('clan-display');
    if(currentUser.company)clanEl.innerHTML='🏢 <span style="cursor:pointer;" onclick="openClanModal(\''+currentUser.company+'\')">'+currentUser.company+'</span>';
    else clanEl.textContent='';
    
    document.getElementById('collect-panel').style.display=myTeamTotal?'flex':'none';
    if(myTeamTotal){document.getElementById('collect-amount').textContent=currentUser.pending_experience||0;document.getElementById('collect-btn').onclick=collectExperience}
    
    var cc=document.getElementById('clan-card'),st=document.getElementById('status-text'),lb=document.getElementById('leave-clan-btn');
    cc.style.display='block';
    if(currentUser.company){st.textContent='🏢 Клан: '+currentUser.company;lb.style.display='block';lb.onclick=async function(){var cost=Math.floor((currentUser.hire_cost||100)*1.5);if(currentUser.experience<cost){toast('Недостаточно опыта!','error');return}await supabase.from('players').update({experience:currentUser.experience-cost,company:null}).eq('vk_id',currentUser.vk_id);currentUser.experience-=cost;currentUser.company=null;location.reload()}}
    else{st.textContent='Не в клане.';lb.style.display='none'}
    
    document.getElementById('invite-friend-btn').onclick=copyInviteLink;
    loadMyTeam(true);
    if(currentTab==='market')loadMarket();else if(currentTab==='top'){if(topSubtab==='players')loadTopPlayers();else loadClans()}
}
document.getElementById('load-more-btn').addEventListener('click',function(){loadMyTeam(false)});
