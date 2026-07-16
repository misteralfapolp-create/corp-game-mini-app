var SUPABASE_URL = 'https://fcrjkfiodvfhzamayvoe.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjcmprZmlvZHZmaHphbWF5dm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTcwMTQsImV4cCI6MjA5OTY5MzAxNH0.C3Ls4QMoYWnFciuOURZ7-WLmGa4TWtBsedhURVNulKI';
var APP_ID = '54679388';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
var currentUser = null, currentVkUser = null, topSubtab = 'players';
var myTeam = [], myTeamTotal = 0, myTeamOffset = 0, TEAM_PAGE_SIZE = 20;

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
    if(screen==='companies')loadCompaniesScreen();
    if(screen==='my-company')loadMyCompanyScreen();
}
function updateNavButtons(screen){
    var bar=document.getElementById('nav-bar');bar.innerHTML='';
    if(screen==='profile'){addNavBtn('top','🏆<br>Топ');addNavBtn('companies','🏢<br>Компании')}
    else if(screen==='top'){addNavBtn('companies','🏢<br>Компании');addNavBtn('profile','🏠<br>Профиль')}
    else if(screen==='companies'){addNavBtn('top','🏆<br>Топ');addNavBtn('profile','🏠<br>Профиль')}
    else if(screen==='my-company'){addNavBtn('top','🏆<br>Топ');addNavBtn('profile','🏠<br>Профиль')}
}
function addNavBtn(screen,label){var bar=document.getElementById('nav-bar');var btn=document.createElement('div');btn.className='nav-btn';btn.id='nav-'+screen;btn.innerHTML=label;btn.onclick=function(){goTo(screen)};bar.appendChild(btn)}

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
        await updateAllStats();renderAll();
    }catch(e){console.error(e)}
}

async function updateAllStats(){
    var empResult=await supabase.from('players').select('*').eq('owner_id',currentUser.vk_id).order('experience',{ascending:false});
    myTeam=empResult.data||[];myTeamTotal=myTeam.length;
    var totalIncome=0;myTeam.forEach(function(e){totalIncome+=(e.income_per_hour||0)});
    if(currentUser.owner_id&&currentUser.owner_id!==currentUser.vk_id)totalIncome=Math.floor(totalIncome/2);
    document.getElementById('my-employees-count').textContent=myTeamTotal;
    document.getElementById('my-income').textContent='+'+totalIncome;
    document.getElementById('my-team-total').textContent=myTeamTotal;
    var ava=document.getElementById('header-avatar'),quitBtn=document.getElementById('quit-job-btn'),ownerInfo=document.getElementById('owner-info');
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
        if(owner.data)ownerInfo.innerHTML='🔒 Нанят: <b onclick="openPlayerModalById('+owner.data.vk_id+')" style="cursor:pointer;text-decoration:underline;">'+owner.data.first_name+' '+owner.data.last_name+'</b>';
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
async function collectExperience(){if(!currentUser.pending_experience){toast('Нечего собирать','info');return}var collected=currentUser.pending_experience;await supabase.from('players').update({experience:(currentUser.experience||0)+collected,pending_experience:0,last_collect:new Date().toISOString()}).eq('vk_id',currentUser.vk_id);currentUser.experience+=collected;currentUser.pending_experience=0;toast('✅ +'+collected+' опыта!','success');renderAll()}
async function giveReferralBonus(id){var r=await supabase.from('players').select('experience').eq('vk_id',id).maybeSingle();if(r.data)await supabase.from('players').update({experience:(r.data.experience||0)+500}).eq('vk_id',id)}

// ================= МОЯ КОМАНДА =================
function loadMyTeam(reset){if(reset){myTeamOffset=0;document.getElementById('my-team-list').innerHTML=''}var list=document.getElementById('my-team-list');if(!myTeam.length){list.innerHTML='<p style="color:#aaa;text-align:center;">Нет сотрудников</p>';document.getElementById('load-more-btn').style.display='none';return}var page=myTeam.slice(myTeamOffset,myTeamOffset+TEAM_PAGE_SIZE);page.forEach(function(emp){renderEmployeeItem(emp,list,true)});myTeamOffset+=page.length;document.getElementById('load-more-btn').style.display=(myTeamOffset<myTeamTotal)?'block':'none'}
function renderEmployeeItem(emp,container,isMine){var cost=Math.floor(emp.hire_cost||100),upgradeCost=Math.floor(cost*1.5),fireIncome=Math.floor(cost*0.8);var div=document.createElement('div');div.className='player-item';div.innerHTML='<img src="'+(emp.photo_200||'https://vk.com/images/camera_200.png')+'" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="openPlayerModalById('+emp.vk_id+')"><div class="info" onclick="openPlayerModalById('+emp.vk_id+')"><div class="name">'+emp.first_name+' '+emp.last_name+'<span class="lvl">'+(emp.level||1)+' ур</span></div><div class="detail">🔬 +'+(emp.income_per_hour||0)+' оп/час • 💰'+cost+'</div></div>';if(isMine)div.innerHTML+='<div class="btn-group"><button class="btn-upgrade">⬆ '+upgradeCost+'</button><button class="btn-fire">🔥 +'+fireIncome+'</button></div>';container.appendChild(div);if(isMine){div.querySelector('.btn-upgrade').onclick=async function(e){e.stopPropagation();await upgradeEmployee(emp)};div.querySelector('.btn-fire').onclick=async function(e){e.stopPropagation();await fireEmployee(emp)}}}
async function upgradeEmployee(emp){var cost=Math.floor((emp.hire_cost||100)*1.5);if((currentUser.experience||0)<cost){toast('Недостаточно опыта!','error');return}await supabase.from('players').update({experience:Math.max(0,(currentUser.experience||0)-cost)}).eq('vk_id',currentUser.vk_id);var newCost=Math.floor((emp.hire_cost||100)*1.5);await supabase.from('players').update({level:(emp.level||1)+1,income_per_hour:(emp.income_per_hour||0)+1,hire_cost:newCost}).eq('vk_id',emp.vk_id);currentUser.experience=Math.max(0,(currentUser.experience||0)-cost);toast('✅ Прокачано!','success');await updateAllStats();loadMyTeam(true);renderAll()}
async function fireEmployee(emp){var fireIncome=Math.floor((emp.hire_cost||100)*0.8);await supabase.from('players').update({experience:(currentUser.experience||0)+fireIncome}).eq('vk_id',currentUser.vk_id);await supabase.from('players').update({owner_id:null,status:'Биржа труда',role:null,income_per_hour:0,level:1,hire_cost:100}).eq('vk_id',emp.vk_id);currentUser.experience+=fireIncome;toast('🔥 Уволен! +'+fireIncome+' опыта','info');await updateAllStats();loadMyTeam(true);renderAll()}

// ================= ТОП =================
function switchTopSubtab(sub){topSubtab=sub;document.querySelectorAll('.subtab').forEach(function(s){s.classList.remove('active')});document.getElementById('subtab-'+sub).classList.add('active');if(sub==='players')loadTopPlayersScreen();else loadCompaniesList(document.getElementById('top-content'),true)}
async function loadTopPlayersScreen(){var c=document.getElementById('top-content');c.innerHTML='Загрузка...';var r=await supabase.from('players').select('*').order('experience',{ascending:false}).limit(100);if(r.error){c.innerHTML='Ошибка';return}c.innerHTML='';r.data.forEach(function(p,i){var rc=i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'',isMe=p.vk_id===currentUser.vk_id;var div=document.createElement('div');div.className='player-item';div.style.background=isMe?'rgba(76,175,80,0.1)':'';div.innerHTML='<div class="rank '+rc+'">'+(i+1)+'</div><img src="'+(p.photo_200||'https://vk.com/images/camera_200.png')+'" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="event.stopPropagation();window.open(\'https://vk.com/id'+p.vk_id+'\',\'_blank\')"><div class="info"><div class="name">'+p.first_name+' '+p.last_name+(isMe?' ⭐':'')+'</div><div class="detail">⭐'+(p.experience||0)+'</div></div>';div.onclick=function(){openPlayerModalById(p.vk_id)};c.appendChild(div)})}
async function loadCompaniesScreen(){loadCompaniesList(document.getElementById('companies-content'),false)}
async function loadCompaniesList(container,showCreateBtn){
    container.innerHTML='Загрузка...';var r=await supabase.from('players').select('company').neq('company',null);
    if(r.error){container.innerHTML='Ошибка';return}var comps={};r.data.forEach(function(p){if(!p.company)return;if(!comps[p.company])comps[p.company]={name:p.company,count:0};comps[p.company].count++});
    var sorted=Object.values(comps).sort(function(a,b){return b.count-a.count});container.innerHTML='';if(!sorted.length){container.innerHTML='<p style="color:#aaa;">Компаний пока нет</p>'}
    sorted.forEach(function(c,i){var isMine=c.name===currentUser.company;var div=document.createElement('div');div.className='player-item';div.style.background=isMine?'rgba(76,175,80,0.1)':'';div.innerHTML='<div style="font-weight:700;width:25px;">'+(i+1)+'.</div><div class="info"><div class="name">'+c.name+(isMine?' ⭐':'')+'</div><div class="detail">👥 '+c.count+' участников</div></div>';div.onclick=function(){openCompanyModal(c.name)};container.appendChild(div)});
    if(showCreateBtn&&!currentUser.company){var btn=document.createElement('button');btn.className='btn-create';btn.textContent='🚀 Создать компанию';btn.onclick=createCompany;container.appendChild(btn)}
}

async function loadMyCompanyScreen(){
    if(!currentUser.company){toast('Вы не в компании!','info');goTo('profile');return}
    document.getElementById('my-company-name').textContent=currentUser.company;
    var r=await supabase.from('players').select('*').eq('company',currentUser.company).order('experience',{ascending:false});
    if(r.data){
        document.getElementById('my-company-stats').textContent='👥 '+r.data.length+' сотрудников';
        var list=document.getElementById('my-company-members');list.innerHTML='';
        r.data.forEach(function(p,i){var div=document.createElement('div');div.className='player-item';div.innerHTML='<div style="font-weight:700;width:25px;">'+(i+1)+'.</div><img src="'+(p.photo_200||'https://vk.com/images/camera_200.png')+'" onerror="this.src=\'https://vk.com/images/camera_200.png\'"><div class="info" onclick="openPlayerModalById('+p.vk_id+')"><div class="name">'+p.first_name+' '+p.last_name+'</div><div class="detail">⭐'+(p.experience||0)+'</div></div>';list.appendChild(div)});
    }
    document.getElementById('my-company-leave-btn').style.display='block';
    document.getElementById('my-company-leave-btn').onclick=async function(){
        var cost=Math.floor((currentUser.hire_cost||100)*1.5);
        if((currentUser.experience||0)<cost){toast('Недостаточно опыта!','error');return}
        await supabase.from('players').update({experience:Math.max(0,(currentUser.experience||0)-cost),company:null}).eq('vk_id',currentUser.vk_id);
        currentUser.experience=Math.max(0,(currentUser.experience||0)-cost);currentUser.company=null;
        toast('Вышли из компании','info');goTo('profile');location.reload();
    };
}

// ================= МОДАЛКА ИГРОКА (с директором) =================
async function openPlayerModalById(vkId){var r=await supabase.from('players').select('*').eq('vk_id',vkId).maybeSingle();if(r.data)openPlayerModal(r.data)}
function openPlayerModal(player){
    var modal=document.getElementById('player-modal');modal.style.display='flex';
    document.getElementById('modal-player-header').innerHTML='<img src="'+(player.photo_200||'https://vk.com/images/camera_200.png')+'" style="width:50px;height:50px;border-radius:50%;vertical-align:middle;margin-right:10px;cursor:pointer;" onclick="window.open(\'https://vk.com/id'+player.vk_id+'\',\'_blank\')"><span style="font-size:18px;font-weight:700;">'+player.first_name+' '+player.last_name+'</span>';
    
    // Показываем, у кого работает
    var ownerDiv=document.getElementById('modal-player-owner');
    if(player.owner_id&&player.owner_id!==player.vk_id){
        supabase.from('players').select('first_name,last_name,vk_id').eq('vk_id',player.owner_id).maybeSingle().then(function(r){
            if(r.data)ownerDiv.innerHTML='🔒 Работает на: <b style="cursor:pointer;text-decoration:underline;color:#ff9800;" onclick="openPlayerModalById('+r.data.vk_id+')">'+r.data.first_name+' '+r.data.last_name+'</b>';
        });
    }else{ownerDiv.innerHTML=''}
    
    var hireBtn=document.getElementById('modal-hire-btn'),fireBtn=document.getElementById('modal-fire-btn');
    hireBtn.style.display='none';fireBtn.style.display='none';
    var isMyOwner=currentUser.owner_id&&currentUser.owner_id===player.vk_id,isMyEmployee=player.owner_id===currentUser.vk_id;
    if((!player.owner_id||player.status==='Биржа труда')&&player.vk_id!==currentUser.vk_id&&!isMyOwner){
        var hireCost=player.hire_cost||100;hireBtn.style.display='block';hireBtn.textContent='💼 Нанять за '+hireCost+' опыта';
        hireBtn.onclick=async function(){if((currentUser.experience||0)<hireCost){toast('Недостаточно опыта!','error');return}await supabase.from('players').update({experience:Math.max(0,(currentUser.experience||0)-hireCost)}).eq('vk_id',currentUser.vk_id);await supabase.from('players').update({owner_id:currentUser.vk_id,status:'Работает',role:'Учёный',income_per_hour:1,level:1,hire_cost:hireCost}).eq('vk_id',player.vk_id);currentUser.experience=Math.max(0,(currentUser.experience||0)-hireCost);toast('✅ Нанят!','success');closePlayerModal();updateAllStats();loadMyTeam(true);renderAll()};
    }
    if(isMyEmployee){var fireIncome=Math.floor((player.hire_cost||100)*0.8);fireBtn.style.display='block';fireBtn.textContent='🔥 Уволить (+'+fireIncome+' опыта)';fireBtn.onclick=async function(){await supabase.from('players').update({experience:(currentUser.experience||0)+fireIncome}).eq('vk_id',currentUser.vk_id);await supabase.from('players').update({owner_id:null,status:'Биржа труда',role:null,income_per_hour:0,level:1,hire_cost:100}).eq('vk_id',player.vk_id);currentUser.experience+=fireIncome;toast('🔥 Уволен!','info');closePlayerModal();updateAllStats();loadMyTeam(true);renderAll()}}
    
    supabase.from('players').select('*').eq('owner_id',player.vk_id).order('experience',{ascending:false}).then(function(r){
        var list=document.getElementById('modal-player-employees');
        if(!r.data||!r.data.length){document.getElementById('modal-player-stats').textContent='⭐'+(player.experience||0)+' • Нет сотрудников';list.innerHTML='<p style="color:#aaa;">Нет сотрудников</p>'}
        else{document.getElementById('modal-player-stats').textContent='⭐'+(player.experience||0)+' • 👥 '+r.data.length+' сотр.';list.innerHTML='';r.data.forEach(function(emp){var stealCost=Math.floor((emp.hire_cost||100)*1.5);var div=document.createElement('div');div.className='player-item';div.innerHTML='<img src="'+(emp.photo_200||'https://vk.com/images/camera_200.png')+'" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="event.stopPropagation();openPlayerModalById('+emp.vk_id+')"><div class="info" onclick="openPlayerModalById('+emp.vk_id+')"><div class="name">'+emp.first_name+' '+emp.last_name+'<span class="lvl">'+(emp.level||1)+' ур</span></div><div class="detail">🔬 +'+(emp.income_per_hour||0)+' оп/час • 💰'+(emp.hire_cost||100)+'</div></div>';if(emp.owner_id!==currentUser.vk_id&&emp.vk_id!==currentUser.vk_id){var btn=document.createElement('button');btn.className='btn-steal';btn.textContent='💰 '+stealCost;btn.onclick=async function(e){e.stopPropagation();if((currentUser.experience||0)<stealCost){toast('Недостаточно опыта!','error');return}await supabase.from('players').update({experience:Math.max(0,(currentUser.experience||0)-stealCost)}).eq('vk_id',currentUser.vk_id);await supabase.from('players').update({owner_id:currentUser.vk_id,hire_cost:stealCost}).eq('vk_id',emp.vk_id);currentUser.experience=Math.max(0,(currentUser.experience||0)-stealCost);toast('✅ Перекуплен!','success');closePlayerModal();updateAllStats();loadMyTeam(true);renderAll()};div.appendChild(btn)}list.appendChild(div)})}
    });
}
function closePlayerModal(){document.getElementById('player-modal').style.display='none'}

// ================= КОМПАНИИ =================
async function openCompanyModal(name){
    document.getElementById('company-modal').style.display='flex';document.getElementById('modal-company-name').textContent='🏢 '+name;
    var r=await supabase.from('players').select('*').eq('company',name);
    if(r.data){document.getElementById('modal-company-stats').textContent='👥 '+r.data.length+' сотрудников';var list=document.getElementById('modal-company-members');list.innerHTML='';
        r.data.forEach(function(p){var div=document.createElement('div');div.className='player-item';div.innerHTML='<img src="'+(p.photo_200||'https://vk.com/images/camera_200.png')+'" onerror="this.src=\'https://vk.com/images/camera_200.png\'"><div class="info" onclick="closeCompanyModal();openPlayerModalById('+p.vk_id+')"><div class="name">'+p.first_name+' '+p.last_name+'</div><div class="detail">⭐'+(p.experience||0)+'</div></div>';list.appendChild(div)});
        var jb=document.getElementById('modal-join-btn'),lb=document.getElementById('modal-leave-btn');jb.style.display='none';lb.style.display='none';
        if(currentUser.company===name){lb.style.display='block';var cost=Math.floor((currentUser.hire_cost||100)*1.5);lb.textContent='🚪 Выйти ('+cost+' опыта)';lb.onclick=async function(){if((currentUser.experience||0)<cost){toast('Недостаточно опыта!','error');return}await supabase.from('players').update({experience:Math.max(0,(currentUser.experience||0)-cost),company:null}).eq('vk_id',currentUser.vk_id);currentUser.experience=Math.max(0,(currentUser.experience||0)-cost);currentUser.company=null;toast('Вышли из компании','info');closeCompanyModal();location.reload()}}
        else{jb.style.display='block';jb.onclick=async function(){await supabase.from('players').update({company:name}).eq('vk_id',currentUser.vk_id);currentUser.company=name;toast('✅ Вступили!','success');closeCompanyModal();location.reload()}}}
}
function closeCompanyModal(){document.getElementById('company-modal').style.display='none'}
async function createCompany(){var n=prompt('Название:','Компания '+currentUser.first_name);if(!n)return;await supabase.from('players').update({company:n}).eq('vk_id',currentUser.vk_id);currentUser.company=n;toast('✅ Создана!','success');location.reload()}

// ================= НАСТРОЙКИ =================
function openSettings(){document.getElementById('settings-modal').style.display='flex';document.getElementById('promo-input').value='';document.getElementById('promo-go-btn').onclick=applyPromo}
function closeSettings(){document.getElementById('settings-modal').style.display='none'}
async function applyPromo(){
    var code=document.getElementById('promo-input').value.trim().toUpperCase();
    if(!code){toast('Введите промокод!','error');return}
    var r=await supabase.from('promocodes').select('*').eq('code',code).maybeSingle();
    if(!r.data){toast('Промокод не найден!','error');return}var promo=r.data;
    if(promo.used_by&&promo.used_by.includes(currentUser.vk_id)){toast('Вы уже использовали!','error');return}
    if(promo.used_by&&promo.used_by.length>=promo.max_uses){toast('Промокод не действует!','error');return}
    var newExp=(currentUser.experience||0)+promo.reward_exp;await supabase.from('players').update({experience:newExp}).eq('vk_id',currentUser.vk_id);currentUser.experience=newExp;
    var usedBy=promo.used_by||[];usedBy.push(currentUser.vk_id);await supabase.from('promocodes').update({used_by:usedBy}).eq('code',code);
    toast('🎁 +'+promo.reward_exp+' опыта!','success');closeSettings();renderAll();
}

// ================= РЕФЕРАЛКА =================
function copyInviteLink(){var link='https://vk.com/app'+APP_ID+'#ref_'+currentUser.vk_id;navigator.clipboard?navigator.clipboard.writeText(link).then(function(){toast('🔗 Скопировано!','info')}):prompt('Скопируй:',link)}

// ================= ОТРИСОВКА =================
function renderAll(){
    document.getElementById('header-avatar').src=currentUser.photo_200||currentVkUser.photo_200||'https://vk.com/images/camera_200.png';
    document.getElementById('player-name').textContent=currentUser.first_name+' '+currentUser.last_name;
    document.getElementById('exp-value').textContent=currentUser.experience||0;
    var compEl=document.getElementById('company-display');
    if(currentUser.company)compEl.innerHTML='🏢 <span style="cursor:pointer;" onclick="goTo(\'my-company\')">'+currentUser.company+'</span>';
    else compEl.textContent='';
    document.getElementById('collect-panel').style.display=myTeamTotal?'flex':'none';
    if(myTeamTotal){document.getElementById('collect-amount').textContent=currentUser.pending_experience||0;document.getElementById('collect-btn').onclick=collectExperience}
    document.getElementById('invite-friend-btn').onclick=copyInviteLink;
    loadMyTeam(true);
}
document.getElementById('load-more-btn').addEventListener('click',function(){loadMyTeam(false)});
