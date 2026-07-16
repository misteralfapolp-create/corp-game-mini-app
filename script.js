// ================= НАСТРОЙКИ =================
var SUPABASE_URL = 'https://fcrjkfiodvfhzamayvoe.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjcmprZmlvZHZmaHphbWF5dm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTcwMTQsImV4cCI6MjA5OTY5MzAxNH0.C3Ls4QMoYWnFciuOURZ7-WLmGa4TWtBsedhURVNulKI';
var APP_ID = '54679388';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
var currentUser = null, currentVkUser = null, topSubtab = 'players';
var myTeam = [], myTeamTotal = 0, myTeamOffset = 0, TEAM_PAGE_SIZE = 20;

// Звёзды
(function(){var c=document.getElementById('stars-canvas');for(var i=0;i<120;i++){var s=document.createElement('div');s.className='star';s.style.cssText='left:'+Math.random()*100+'%;top:'+Math.random()*100+'%;width:'+Math.random()*3+'px;height:'+Math.random()*3+'px;--dur:'+(2+Math.random()*4)+'s;animation-delay:'+Math.random()*4+'s';c.appendChild(s)}})();

function toast(m,t){t=t||'info';var c=document.getElementById('toast-container'),e=document.createElement('div');e.className='toast '+t;e.textContent=m;c.appendChild(e);setTimeout(function(){e.remove()},2800)}
function openVkProfile(){if(currentVkUser)window.open('https://vk.com/id'+currentVkUser.id,'_blank')}
function getRefFromHash(){var m=window.location.hash.match(/ref_(\d+)/);return m?m[1]:null}

// ================= НАВИГАЦИЯ =================
function goTo(screen){
    document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active')});
    document.getElementById('screen-'+screen).classList.add('active');
    updateNavButtons(screen);
    if(screen==='top')switchTopSubtab(topSubtab);
    if(screen==='clans')loadClansScreen();
}

function updateNavButtons(currentScreen){
    var bar=document.getElementById('nav-bar');
    // Убираем все кнопки
    bar.innerHTML='';
    
    if(currentScreen==='profile'){
        // На главной: Топ и Кланы
        addNavBtn('top','🏆<br>Топ');addNavBtn('clans','🏢<br>Кланы');
    }else if(currentScreen==='top'){
        // В топе: Кланы и Профиль
        addNavBtn('clans','🏢<br>Кланы');addNavBtn('profile','🏠<br>Профиль');
    }else if(currentScreen==='clans'){
        // В кланах: Топ и Профиль
        addNavBtn('top','🏆<br>Топ');addNavBtn('profile','🏠<br>Профиль');
    }
}

function addNavBtn(screen,label){
    var bar=document.getElementById('nav-bar');
    var btn=document.createElement('div');btn.className='nav-btn';
    btn.id='nav-'+screen;btn.innerHTML=label;btn.onclick=function(){goTo(screen)};
    bar.appendChild(btn);
}

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
        await updateAllStats();
        renderAll();
    }catch(e){console.error(e)}
}

// ================= СТАТИСТИКА =================
async function updateAllStats(){
    var empResult=await supabase.from('players').select('*').eq('owner_id',currentUser.vk_id).order('experience',{ascending:false});
    myTeam=empResult.data||[];myTeamTotal=myTeam.length;
    var totalIncome=0;myTeam.forEach(function(e){totalIncome+=(e.income_per_hour||0)});
    if(currentUser.owner_id&&currentUser.owner_id!==currentUser.vk_id)totalIncome=Math.floor(totalIncome/2);
    document.getElementById('my-employees-count').textContent=myTeamTotal;
    document.getElementById('my-income').textContent='+'+totalIncome;
    document.getElementById('my-team-total').textContent=myTeamTotal;
    
    var ava=document.getElementById('header-avatar');
    var quitBtn=document.getElementById('quit-job-btn');
    var ownerInfo=document.getElementById('owner-info');
    if(currentUser.owner_id&&currentUser.owner_id!==currentUser.vk_id){
        ava.classList.add('hired');quitBtn.style.display='block';
        var myCost=currentUser.hire_cost||100;
        quitBtn.textContent='🚪 Уволиться ('+myCost+' опыта)';
        quitBtn.onclick=async function(){
            if((currentUser.experience||0)<myCost){toast('Недостаточно опыта!','error');return}
            await supabase.from('players').update({experience:Math.max(0,(currentUser.experience||0)-myCost),owner_id:null,status:'Биржа труда',role:null}).eq('vk_id',currentUser.vk_id);
            currentUser.experience=Math.max(0,(currentUser.experience||0)-myCost);currentUser.owner_id=null;currentUser.status='Биржа труда';
            toast('Вы уволились!','info');location.reload();
        };
        var owner=await supabase.from('players').select('first_name,last_name,vk_id').eq('vk_id',currentUser.owner_id).maybeSingle();
        if(owner.data)ownerInfo.innerHTML='🔒 Работает на <b onclick="openPlayerModalById('+owner.data.vk_id+')" style="cursor:pointer;">'+owner.data.first_name+' '+owner.data.last_name+'</b>';
    }else{ava.classList.remove('hired');quitBtn.style.display='none';ownerInfo.textContent=''}
    await calculatePendingExperience();
}

async function calculatePendingExperience(){
    if(!myTeam.length)return;
    var totalPerHour=0;myTeam.forEach(function(e){totalPerHour+=(e.income_per_hour||0)});
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

// ================= МОЯ КОМАНДА =================
function loadMyTeam(reset){
    if(reset){myTeamOffset=0;document.getElementById('my-team-list').innerHTML=''}
    var list=document.getElementById('my-team-list');
    if(!myTeam.length){list.innerHTML='<p style="color:#aaa;text-align:center;">У вас пока нет сотрудников</p>';document.getElementById('load-more-btn').style.display='none';return}
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
    if(isMine)div.innerHTML+='<div class="btn-group"><button class="btn-upgrade">⬆ '+upgradeCost+'</button><button class="btn-fire">🔥 +'+fireIncome+'</button></div>';
    container.appendChild(div);
    if(isMine){div.querySelector('.btn-upgrade').onclick=async function(e){e.stopPropagation();await upgradeEmployee(emp)};div.querySelector('.btn-fire').onclick=async function(e){e.stopPropagation();await fireEmployee(emp)}}
}

async function upgradeEmployee(emp){
    var cost=Math.floor((emp.hire_cost||100)*1.5);
    if((currentUser.experience||0)<cost){toast('Недостаточно опыта! Нужно '+cost,'error');return}
    await supabase.from('players').update({experience:Math.max(0,(currentUser.experience||0)-cost)}).eq('vk_id',currentUser.vk_id);
    var newCost=Math.floor((emp.hire_cost||100)*1.5);
    await supabase.from('players').update({level:(emp.level||1)+1,income_per_hour:(emp.income_per_hour||0)+1,hire_cost:newCost}).eq('vk_id',emp.vk_id);
    currentUser.experience=Math.max(0,(currentUser.experience||0)-cost);
    toast('✅ Прокачано!','success');await updateAllStats();loadMyTeam(true);renderAll();
}

async function fireEmployee(emp){
    var fireIncome=Math.floor((emp.hire_cost||100)*0.8);
    await supabase.from('players').update({experience:(currentUser.experience||0)+fireIncome}).eq('vk_id',currentUser.vk_id);
    await supabase.from('players').update({owner_id:null,status:'Биржа труда',role:null,income_per_hour:0,level:1,hire_cost:100}).eq('vk_id',emp.vk_id);
    currentUser.experience+=fireIncome;
    toast('🔥 Уволен! +'+fireIncome+' опыта','info');await updateAllStats();loadMyTeam(true);renderAll();
}

// ================= ТОП =================
function switchTopSubtab(sub){
    topSubtab=sub;
    document.querySelectorAll('.subtab').forEach(function(s){s.classList.remove('active')});
    document.getElementById('subtab-'+sub).classList.add('active');
    if(sub==='players')loadTopPlayersScreen();else loadClansInTopScreen();
}

async function loadTopPlayersScreen(){
    var c=document.getElementById('top-content');c.innerHTML='Загрузка...';
    var r=await supabase.from('players').select('*').order('experience',{ascending:false}).limit(100);
    if(r.error){c.innerHTML='Ошибка';return}
    c.innerHTML='';
    r.data.forEach(function(p,i){
        var rc=i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'',isMe=p.vk_id===currentUser.vk_id;
        var div=document.createElement('div');div.className='player-item';div.style.background=isMe?'rgba(76,175,80,0.1)':'';
        div.innerHTML='<div class="rank '+rc+'">'+(i+1)+'</div><img src="'+(p.photo_200||'https://vk.com/images/camera_200.png')+'" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="event.stopPropagation();window.open(\'https://vk.com/id'+p.vk_id+'\',\'_blank\')">'+
            '<div class="info"><div class="name">'+p.first_name+' '+p.last_name+(isMe?' ⭐':'')+'</div><div class="detail">⭐'+(p.experience||0)+'</div></div>';
        div.onclick=function(){openPlayerModalById(p.vk_id)};c.appendChild(div);
    });
}

async function loadClansInTopScreen(){loadClansList(document.getElementById('top-content'),true)}
async function loadClansScreen(){loadClansList(document.getElementById('clans-content'),false)}

async function loadClansList(container,showCreateBtn){
    container.innerHTML='Загрузка...';
    var r=await supabase.from('players').select('company').neq('company',null);
    if(r.error){container.innerHTML='Ошибка';return}
    var clans={};r.data.forEach(function(p){if(!p.company)return;if(!clans[p.company])clans[p.company]={name:p.company,count:0};clans[p.company].count++});
    var sorted=Object.values(clans).sort(function(a,b){return b.count-a.count});
    container.innerHTML='';if(!sorted.length){container.innerHTML='<p style="color:#aaa;">Кланов пока нет</p>'}
    sorted.forEach(function(cl,i){
        var isMine=cl.name===currentUser.company;
        var div=document.createElement('div');div.className='player-item';div.style.background=isMine?'rgba(76,175,80,0.1)':'';
        div.innerHTML='<div style="font-weight:700;width:25px;">'+(i+1)+'.</div><div class="info"><div class="name">'+cl.name+(isMine?' ⭐':'')+'</div><div class="detail">👥 '+cl.count+' участников</div></div>';
        div.onclick=function(){openClanModal(cl.name)};container.appendChild(div);
    });
    if(showCreateBtn&&!currentUser.company){var btn=document.createElement('button');btn.className='btn-create';btn.textContent='🚀 Создать клан';btn.onclick=createClan;container.appendChild(btn)}
}

// ================= МОДАЛКА ИГРОКА =================
async function openPlayerModalById(vkId){
    var r=await supabase.from('players').select('*').eq('vk_id',vkId).maybeSingle();
    if(r.data)openPlayerModal(r.data);
}

function openPlayerModal(player){
    var modal=document.getElementById('player-modal');modal.style.display='flex';
    document.getElementById('modal-player-header').innerHTML='<img src="'+(player.photo_200||'https://vk.com/images/camera_200.png')+'" style="width:50px;height:50px;border-radius:50%;vertical-align:middle;margin-right:10px;cursor:pointer;" onclick="window.open(\'https://vk.com/id'+player.vk_id+'\',\'_blank\')"><span style="font-size:18px;font-weight:700;">'+player.first_name+' '+player.last_name+'</span>';
    
    var hireBtn=document.getElementById('modal-hire-btn');
    var fireBtn=document.getElementById('modal-fire-btn');
    hireBtn.style.display='none';fireBtn.style.display='none';
    
    var isMyOwner=currentUser.owner_id&&currentUser.owner_id===player.vk_id;
    var isMyEmployee=player.owner_id===currentUser.vk_id;
    
    // Кнопка Нанять: если игрок на бирже (или вообще не нанят) И не мой владелец
    if((!player.owner_id||player.status==='Биржа труда')&&player.vk_id!==currentUser.vk_id&&!isMyOwner){
        var hireCost=player.hire_cost||100;
        hireBtn.style.display='block';hireBtn.textContent='💼 Нанять за '+hireCost+' опыта';
        hireBtn.onclick=async function(){
            if((currentUser.experience||0)<hireCost){toast('Недостаточно опыта! Нужно '+hireCost,'error');return}
            await supabase.from('players').update({experience:Math.max(0,(currentUser.experience||0)-hireCost)}).eq('vk_id',currentUser.vk_id);
            await supabase.from('players').update({owner_id:currentUser.vk_id,status:'Работает',role:'Учёный',income_per_hour:1,level:1,hire_cost:hireCost}).eq('vk_id',player.vk_id);
            currentUser.experience=Math.max(0,(currentUser.experience||0)-hireCost);
            toast('✅ Нанят!','success');closePlayerModal();updateAllStats();loadMyTeam(true);renderAll();
        };
    }
    
    // Кнопка Уволить: если это МОЙ сотрудник
    if(isMyEmployee){
        var fireIncome=Math.floor((player.hire_cost||100)*0.8);
        fireBtn.style.display='block';fireBtn.textContent='🔥 Уволить (+'+fireIncome+' опыта)';
        fireBtn.onclick=async function(){
            await supabase.from('players').update({experience:(currentUser.experience||0)+fireIncome}).eq('vk_id',currentUser.vk_id);
            await supabase.from('players').update({owner_id:null,status:'Биржа труда',role:null,income_per_hour:0,level:1,hire_cost:100}).eq('vk_id',player.vk_id);
            currentUser.experience+=fireIncome;
            toast('🔥 Уволен! +'+fireIncome+' опыта','info');closePlayerModal();updateAllStats();loadMyTeam(true);renderAll();
        };
    }
    
    // Загружаем сотрудников игрока
    supabase.from('players').select('*').eq('owner_id',player.vk_id).order('experience',{ascending:false}).then(function(r){
        var list=document.getElementById('modal-player-employees');
        if(!r.data||!r.data.length){
            document.getElementById('modal-player-stats').textContent='⭐'+(player.experience||0)+' • Нет сотрудников';
            list.innerHTML='<p style="color:#aaa;text-align:center;">Нет сотрудников</p>';
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
                        if((currentUser.experience||0)<stealCost){toast('Недостаточно опыта!','error');return}
                        await supabase.from('players').update({experience:Math.max(0,(currentUser.experience||0)-stealCost)}).eq('vk_id',currentUser.vk_id);
                        await supabase.from('players').update({owner_id:currentUser.vk_id,hire_cost:stealCost}).eq('vk_id',emp.vk_id);
                        currentUser.experience=Math.max(0,(currentUser.experience||0)-stealCost);
                        toast('✅ Перекуплен!','success');closePlayerModal();updateAllStats();loadMyTeam(true);renderAll();
                    };div.appendChild(btn);
                }
                list.appendChild(div);
            });
        }
    });
}
function closePlayerModal(){document.getElementById('player-modal').style.display='none'}

// ================= КЛАНЫ =================
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
            lb.onclick=async function(){if((currentUser.experience||0)<cost){toast('Недостаточно опыта!','error');return}
                await supabase.from('players').update({experience:Math.max(0,(currentUser.experience||0)-cost),company:null}).eq('vk_id',currentUser.vk_id);
                currentUser.experience=Math.max(0,(currentUser.experience||0)-cost);currentUser.company=null;
                toast('Вышли из клана','info');closeClanModal();location.reload()};
        }else{jb.style.display='block';jb.onclick=async function(){await supabase.from('players').update({company:name}).eq('vk_id',currentUser.vk_id);currentUser.company=name;toast('✅ Вступили!','success');closeClanModal();location.reload()}}
    }
}
function closeClanModal(){document.getElementById('clan-modal').style.display='none'}
async function createClan(){var n=prompt('Название:','Клан '+currentUser.first_name);if(!n)return;await supabase.from('players').update({company:n}).eq('vk_id',currentUser.vk_id);currentUser.company=n;toast('✅ Клан создан!','success');location.reload()}

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
    if(currentUser.company){st.textContent='🏢 Клан: '+currentUser.company;lb.style.display='block';lb.onclick=async function(){var cost=Math.floor((currentUser.hire_cost||100)*1.5);if((currentUser.experience||0)<cost){toast('Недостаточно опыта!','error');return}await supabase.from('players').update({experience:Math.max(0,(currentUser.experience||0)-cost),company:null}).eq('vk_id',currentUser.vk_id);currentUser.experience=Math.max(0,(currentUser.experience||0)-cost);currentUser.company=null;location.reload()}}
    else{st.textContent='Не в клане.';lb.style.display='none'}
    document.getElementById('invite-friend-btn').onclick=copyInviteLink;
    loadMyTeam(true);
}
document.getElementById('load-more-btn').addEventListener('click',function(){loadMyTeam(false)});
