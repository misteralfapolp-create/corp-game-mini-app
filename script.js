var SUPABASE_URL = 'https://fcrjkfiodvfhzamayvoe.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjcmprZmlvZHZmaHphbWF5dm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTcwMTQsImV4cCI6MjA5OTY5MzAxNH0.C3Ls4QMoYWnFciuOURZ7-WLmGa4TWtBsedhURVNulKI';
var APP_ID = '54679388';
var GROUP_URL = 'https://vk.ru/club240295160';
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
var currentUser = null, currentVkUser = null, topSubtab = 'players';
var myTeam = [], myTeamTotal = 0, myTeamOffset = 0, TEAM_PAGE_SIZE = 20;

// Запрет кэширования
(function(){
    var meta = document.createElement('meta');
    meta.httpEquiv = 'Cache-Control';
    meta.content = 'no-cache, no-store, must-revalidate';
    document.head.appendChild(meta);
    var meta2 = document.createElement('meta');
    meta2.httpEquiv = 'Pragma';
    meta2.content = 'no-cache';
    document.head.appendChild(meta2);
    var meta3 = document.createElement('meta');
    meta3.httpEquiv = 'Expires';
    meta3.content = '0';
    document.head.appendChild(meta3);
})();

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
    if(screen==='my-company')loadMyCompanyScreen();
}
function updateNavButtons(screen){
    var bar=document.getElementById('nav-bar');bar.innerHTML='';
    if(screen==='profile'){addNavBtn('top','🏆<br>Топ');addNavBtn('my-company','🏢<br>Моя компания')}
    else if(screen==='top'){addNavBtn('my-company','🏢<br>Моя компания');addNavBtn('profile','🏠<br>Профиль')}
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
            await supabase.from('players').insert([{vk_id:currentVkUser.id,first_name:currentVkUser.first_name,last_name:currentVkUser.last_name,photo_200:currentVkUser.photo_200||'',status:'Биржа труда',company:null,role:null,experience:0,income_per_hour:0,invited_by:invitedBy?parseInt(invitedBy):null,last_collect:new Date().toISOString(),pending_experience:0,level:1,hire_cost:100,owner_id:null,company_group_id:null,task_group_done:false,task_promo_done:false,max_pending:0}]);
            if(invitedBy){
                var inviter=await supabase.from('players').select('vk_id').eq('vk_id',parseInt(invitedBy)).maybeSingle();
                if(inviter.data){
                    await supabase.from('players').update({owner_id:parseInt(invitedBy),status:'Работает',role:'Учёный',income_per_hour:1}).eq('vk_id',currentVkUser.id);
                    await giveReferralBonus(parseInt(invitedBy));
                }
            }
            location.reload();return;
        }
        currentUser=r.data;
        if(currentUser.owner_id===undefined){await supabase.from('players').update({owner_id:null,last_collect:new Date().toISOString(),pending_experience:0}).eq('vk_id',currentUser.vk_id);currentUser.owner_id=null}
        if(currentUser.company_group_id===undefined){await supabase.from('players').update({company_group_id:null}).eq('vk_id',currentUser.vk_id);currentUser.company_group_id=null}
        if(currentUser.task_group_done===undefined){await supabase.from('players').update({task_group_done:false,task_promo_done:false,max_pending:0}).eq('vk_id',currentUser.vk_id);currentUser.task_group_done=false;currentUser.task_promo_done=false;currentUser.max_pending=0}
        if(invitedBy&&parseInt(invitedBy)!==currentUser.vk_id&&!currentUser.owner_id){
            var inviter2=await supabase.from('players').select('vk_id').eq('vk_id',parseInt(invitedBy)).maybeSingle();
            if(inviter2.data){
                await supabase.from('players').update({owner_id:parseInt(invitedBy),status:'Работает',role:'Учёный',income_per_hour:1}).eq('vk_id',currentUser.vk_id);
                await giveReferralBonus(parseInt(invitedBy));
                currentUser.owner_id=parseInt(invitedBy);currentUser.status='Работает';currentUser.role='Учёный';currentUser.income_per_hour=1;
            }
        }
        await updateAllStats();renderAll();
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
    var ava=document.getElementById('header-avatar'),quitBtn=document.getElementById('quit-job-btn'),ownerInfo=document.getElementById('owner-info');
    if(currentUser.owner_id&&currentUser.owner_id!==currentUser.vk_id){
        ava.classList.add('hired');quitBtn.style.display='block';
        var myCost=currentUser.hire_cost||100;
        quitBtn.textContent='🚪 Уволиться ('+myCost+' опыта)';
        quitBtn.onclick=async function(){
            if((currentUser.experience||0)<myCost){toast('Недостаточно опыта! Нужно '+myCost,'error');return}
            await supabase.from('players').update({
                experience: Math.max(0, (currentUser.experience||0) - myCost),
                owner_id: null,
                status: 'Биржа труда',
                role: null,
                income_per_hour: 0,
                level: 1,
                hire_cost: 100
            }).eq('vk_id', currentUser.vk_id);
            toast('Вы уволились! -'+myCost+' опыта','info');
            location.reload();
        };
        var owner=await supabase.from('players').select('first_name,last_name,vk_id').eq('vk_id',currentUser.owner_id).maybeSingle();
        if(owner.data)ownerInfo.innerHTML='🔒 Нанят: <b onclick="openPlayerModalById('+owner.data.vk_id+')" style="cursor:pointer;text-decoration:underline;">'+owner.data.first_name+' '+owner.data.last_name+'</b>';
    }else{ava.classList.remove('hired');quitBtn.style.display='none';ownerInfo.textContent=''}
    await calculatePendingExperience();
}

// ================= РАСЧЁТ ОПЫТА (макс 12 часов) =================
async function calculatePendingExperience(){
    if(!myTeam.length)return;
    var totalPerHour=0;myTeam.forEach(function(e){totalPerHour+=(e.income_per_hour||0)});
    if(currentUser.owner_id&&currentUser.owner_id!==currentUser.vk_id)totalPerHour=Math.floor(totalPerHour/2);
    var hoursPassed=(new Date()-new Date(currentUser.last_collect||new Date()))/3600000;
    hoursPassed=Math.min(hoursPassed,12);
    var newPending=Math.floor((currentUser.pending_experience||0)+totalPerHour*hoursPassed);
    var maxPending=totalPerHour*12;
    newPending=Math.min(newPending,maxPending);
    await supabase.from('players').update({pending_experience:newPending,last_collect:new Date().toISOString(),max_pending:maxPending}).eq('vk_id',currentUser.vk_id);
    currentUser.pending_experience=newPending;currentUser.max_pending=maxPending;
}

async function collectExperience(){
    if(!currentUser.pending_experience){toast('Нечего собирать','info');return}
    var collected=currentUser.pending_experience;
    await supabase.from('players').update({experience:(currentUser.experience||0)+collected,pending_experience:0,last_collect:new Date().toISOString(),max_pending:0}).eq('vk_id',currentUser.vk_id);
    currentUser.experience+=collected;currentUser.pending_experience=0;currentUser.max_pending=0;
    toast('✅ +'+collected+' опыта!','success');renderAll();
}

async function giveReferralBonus(id){var r=await supabase.from('players').select('experience').eq('vk_id',id).maybeSingle();if(r.data)await supabase.from('players').update({experience:(r.data.experience||0)+500}).eq('vk_id',id)}

// ================= МОЯ КОМАНДА =================
function loadMyTeam(reset){if(reset){myTeamOffset=0;document.getElementById('my-team-list').innerHTML=''}var list=document.getElementById('my-team-list');if(!myTeam.length){list.innerHTML='<p style="color:#aaa;text-align:center;">Нет сотрудников</p>';document.getElementById('load-more-btn').style.display='none';return}var page=myTeam.slice(myTeamOffset,myTeamOffset+TEAM_PAGE_SIZE);page.forEach(function(emp){renderEmployeeItem(emp,list,true)});myTeamOffset+=page.length;document.getElementById('load-more-btn').style.display=(myTeamOffset<myTeamTotal)?'block':'none'}
function renderEmployeeItem(emp,container,isMine){var cost=Math.floor(emp.hire_cost||100),upgradeCost=Math.floor(cost*1.5),fireIncome=Math.floor(cost*0.8);var div=document.createElement('div');div.className='player-item';div.innerHTML='<img src="'+(emp.photo_200||'https://vk.com/images/camera_200.png')+'" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="openPlayerModalById('+emp.vk_id+')"><div class="info" onclick="openPlayerModalById('+emp.vk_id+')"><div class="name">'+emp.first_name+' '+emp.last_name+'<span class="lvl">'+(emp.level||1)+' ур</span></div><div class="detail">🔬 +'+(emp.income_per_hour||0)+' оп/час • 💰'+cost+'</div></div>';if(isMine)div.innerHTML+='<div class="btn-group"><button class="btn-upgrade">⬆ '+upgradeCost+'</button><button class="btn-fire">🔥 +'+fireIncome+'</button></div>';container.appendChild(div);if(isMine){div.querySelector('.btn-upgrade').onclick=async function(e){e.stopPropagation();await upgradeEmployee(emp)};div.querySelector('.btn-fire').onclick=async function(e){e.stopPropagation();await fireEmployee(emp)}}}
async function upgradeEmployee(emp){var cost=Math.floor((emp.hire_cost||100)*1.5);if((currentUser.experience||0)<cost){toast('Недостаточно опыта!','error');return}await supabase.from('players').update({experience:Math.max(0,(currentUser.experience||0)-cost)}).eq('vk_id',currentUser.vk_id);var newCost=Math.floor((emp.hire_cost||100)*1.5);await supabase.from('players').update({level:(emp.level||1)+1,income_per_hour:(emp.income_per_hour||0)+1,hire_cost:newCost}).eq('vk_id',emp.vk_id);currentUser.experience=Math.max(0,(currentUser.experience||0)-cost);
    // Обновляем last_collect владельца, чтобы доход не начислился задним числом
    await supabase.from('players').update({last_collect: new Date().toISOString()}).eq('vk_id', currentUser.vk_id);
    currentUser.last_collect = new Date().toISOString();
    toast('✅ Прокачано! Доход увеличится','success');await updateAllStats();loadMyTeam(true);renderAll()}
async function fireEmployee(emp){var fireIncome=Math.floor((emp.hire_cost||100)*0.8);await supabase.from('players').update({experience:(currentUser.experience||0)+fireIncome}).eq('vk_id',currentUser.vk_id);await supabase.from('players').update({owner_id:null,status:'Биржа труда',role:null,income_per_hour:0,level:1,hire_cost:100}).eq('vk_id',emp.vk_id);currentUser.experience+=fireIncome;toast('🔥 Уволен! +'+fireIncome+' опыта','info');await updateAllStats();loadMyTeam(true);renderAll()}

// ================= ЗАДАНИЯ =================
function doGroupTask(){window.open(GROUP_URL,'_blank');toast('📱 Откройте группу и подпишитесь','info')}
async function checkGroupTask(){
    if(currentUser.task_group_done){toast('Уже выполнено!','info');return}
    try{
        var result=await vkBridge.send('VKWebAppCallAPIMethod',{method:'groups.isMember',params:{group_id:240295160,user_id:currentUser.vk_id,v:'5.199'}});
        if(result.response===1){
            await supabase.from('players').update({experience:(currentUser.experience||0)+1000,task_group_done:true}).eq('vk_id',currentUser.vk_id);
            currentUser.experience+=1000;currentUser.task_group_done=true;
            toast('✅ +1000 опыта!','success');renderAll();
        }else{toast('Не подписаны','error')}
    }catch(e){
        await supabase.from('players').update({experience:(currentUser.experience||0)+1000,task_group_done:true}).eq('vk_id',currentUser.vk_id);
        currentUser.experience+=1000;currentUser.task_group_done=true;
        toast('✅ +1000 опыта!','success');renderAll();
    }
}
function doPromoTask(){openSettings();toast('Введите промокод','info')}

// ================= ТОП =================
function switchTopSubtab(sub){topSubtab=sub;document.querySelectorAll('.subtab').forEach(function(s){s.classList.remove('active')});document.getElementById('subtab-'+sub).classList.add('active');if(sub==='players')loadTopPlayersScreen();else loadTopCompaniesScreen()}

async function loadTopPlayersScreen(){
    var c=document.getElementById('top-content');c.innerHTML='Загрузка...';
    var r=await supabase.from('players').select('*').order('experience',{ascending:false}).limit(200);
    if(r.error){c.innerHTML='Ошибка';return}
    var playersWithCount=[];
    for(var i=0;i<r.data.length;i++){var p=r.data[i];var countResult=await supabase.from('players').select('vk_id',{count:'exact'}).eq('owner_id',p.vk_id);playersWithCount.push({vk_id:p.vk_id,first_name:p.first_name,last_name:p.last_name,photo_200:p.photo_200,experience:p.experience||0,empCount:countResult.count||0})}
    playersWithCount.sort(function(a,b){return b.empCount-a.empCount});playersWithCount=playersWithCount.slice(0,100);
    c.innerHTML='';if(!playersWithCount.length){c.innerHTML='<p style="color:#aaa;">Нет данных</p>';return}
    playersWithCount.forEach(function(p,i){var rc=i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'',isMe=p.vk_id===currentUser.vk_id;var div=document.createElement('div');div.className='player-item';div.style.background=isMe?'rgba(76,175,80,0.1)':'';div.innerHTML='<div class="rank '+rc+'">'+(i+1)+'</div><img src="'+(p.photo_200||'https://vk.com/images/camera_200.png')+'" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="event.stopPropagation();window.open(\'https://vk.com/id'+p.vk_id+'\',\'_blank\')"><div class="info"><div class="name">'+p.first_name+' '+p.last_name+(isMe?' ⭐':'')+'</div><div class="detail">👥 '+p.empCount+' сотрудников • ⭐'+(p.experience||0)+'</div></div>';div.onclick=function(){openPlayerModalById(p.vk_id)};c.appendChild(div)})}

async function loadTopCompaniesScreen(){
    var c=document.getElementById('top-content');c.innerHTML='Загрузка...';
    var r=await supabase.from('players').select('company,experience,company_group_id').neq('company',null);
    if(r.error){c.innerHTML='Ошибка';return}
    var comps={};r.data.forEach(function(p){if(!p.company)return;if(!comps[p.company])comps[p.company]={name:p.company,totalExp:0,count:0,groupId:p.company_group_id};comps[p.company].totalExp+=(p.experience||0);comps[p.company].count++});
    var sorted=Object.values(comps).sort(function(a,b){return b.totalExp-a.totalExp});
    c.innerHTML='';if(!sorted.length){c.innerHTML='<p style="color:#aaa;">Компаний пока нет</p>'}
    sorted.forEach(function(co,i){var isMine=co.name===currentUser.company;var div=document.createElement('div');div.className='player-item';div.style.background=isMine?'rgba(76,175,80,0.1)':'';var groupIcon=co.groupId?' 📱':'';div.innerHTML='<div style="font-weight:700;width:25px;">'+(i+1)+'.</div><div class="info"><div class="name">'+co.name+groupIcon+(isMine?' ⭐':'')+'</div><div class="detail">👥 '+co.count+' уч. • ⭐'+co.totalExp+' опыта</div></div>';div.onclick=function(){if(co.groupId)window.open('https://vk.com/club'+co.groupId,'_blank');openCompanyModal(co.name)};c.appendChild(div)});
    if(!currentUser.company){var btn=document.createElement('button');btn.className='btn-create';btn.textContent='🚀 Создать компанию';btn.onclick=createCompany;c.appendChild(btn)}
}

// ================= МОЯ КОМПАНИЯ =================
async function loadMyCompanyScreen(){
    if(!currentUser.company){document.getElementById('my-company-name').textContent='У вас нет компании';document.getElementById('my-company-stats').textContent='';document.getElementById('my-company-members').innerHTML='<p style="color:#aaa;text-align:center;margin:20px 0;">Создайте свою компанию и приглашайте друзей!</p><button class="btn-create" onclick="createCompany()">🚀 Создать компанию</button>';document.getElementById('my-company-leave-btn').style.display='none';return}
    document.getElementById('my-company-name').textContent=currentUser.company;
    if(currentUser.company_group_id){document.getElementById('my-company-name').innerHTML+=' <a href="https://vk.com/club'+currentUser.company_group_id+'" target="_blank" style="color:#4a76a8;font-size:12px;">📱 Группа</a>'}
    var r=await supabase.from('players').select('*').eq('company',currentUser.company).order('experience',{ascending:false});
    if(r.data){document.getElementById('my-company-stats').textContent='👥 '+r.data.length+' сотрудников';var list=document.getElementById('my-company-members');list.innerHTML='';r.data.forEach(function(p,i){var div=document.createElement('div');div.className='player-item';div.innerHTML='<div style="font-weight:700;width:25px;">'+(i+1)+'.</div><img src="'+(p.photo_200||'https://vk.com/images/camera_200.png')+'" onerror="this.src=\'https://vk.com/images/camera_200.png\'"><div class="info" onclick="openPlayerModalById('+p.vk_id+')"><div class="name">'+p.first_name+' '+p.last_name+'</div><div class="detail">⭐'+(p.experience||0)+'</div></div>';list.appendChild(div)})}
    document.getElementById('my-company-leave-btn').style.display='block';
    document.getElementById('my-company-leave-btn').onclick=async function(){await supabase.from('players').update({company:null,company_group_id:null}).eq('vk_id',currentUser.vk_id);currentUser.company=null;currentUser.company_group_id=null;toast('Вышли из компании','info');goTo('profile');location.reload()}
}

async function createCompany(){
    var name=prompt('Введите название компании:','Компания '+currentUser.first_name);if(!name)return;
    var groupId=prompt('Введите ID группы ВК (число) или 0 если нет:','0');
    var finalGroupId=groupId&&parseInt(groupId)>0?parseInt(groupId):null;
    await supabase.from('players').update({company:name,company_group_id:finalGroupId}).eq('vk_id',currentUser.vk_id);
    currentUser.company=name;currentUser.company_group_id=finalGroupId;
    toast('✅ Компания «'+name+'» создана!','success');location.reload();
}

// ================= МОДАЛКА ИГРОКА =================
async function openPlayerModalById(vkId){var r=await supabase.from('players').select('*').eq('vk_id',vkId).maybeSingle();if(r.data)openPlayerModal(r.data)}
function openPlayerModal(player){
    var modal=document.getElementById('player-modal');modal.style.display='flex';
    document.getElementById('modal-player-header').innerHTML='<img src="'+(player.photo_200||'https://vk.com/images/camera_200.png')+'" style="width:50px;height:50px;border-radius:50%;vertical-align:middle;margin-right:10px;cursor:pointer;" onclick="window.open(\'https://vk.com/id'+player.vk_id+'\',\'_blank\')"><span style="font-size:18px;font-weight:700;">'+player.first_name+' '+player.last_name+'</span>';
    var ownerDiv=document.getElementById('modal-player-owner');
    if(player.owner_id&&player.owner_id!==player.vk_id){supabase.from('players').select('first_name,last_name,vk_id').eq('vk_id',player.owner_id).maybeSingle().then(function(r){if(r.data)ownerDiv.innerHTML='🔒 Работает на: <b style="cursor:pointer;text-decoration:underline;color:#ff9800;" onclick="openPlayerModalById('+r.data.vk_id+')">'+r.data.first_name+' '+r.data.last_name+'</b>'});}else{ownerDiv.innerHTML=''}
    var hireBtn=document.getElementById('modal-hire-btn'),fireBtn=document.getElementById('modal-fire-btn');hireBtn.style.display='none';fireBtn.style.display='none';
    
    var isMyOwner=currentUser.owner_id&&currentUser.owner_id===player.vk_id;
    var isMyEmployee=player.owner_id===currentUser.vk_id;
    var isInMyChain=false;
    if(currentUser.owner_id&&player.vk_id===currentUser.owner_id)isInMyChain=true;
    
    // НАНЯТЬ
    if((!player.owner_id||player.status==='Биржа труда')&&player.vk_id!==currentUser.vk_id&&!isMyOwner&&!isInMyChain){
        var hireCost=player.hire_cost||100;
        hireBtn.style.display='block';
        hireBtn.textContent='💼 Нанять за '+hireCost+' опыта';
        hireBtn.onclick=async function(){
            if((currentUser.experience||0)<hireCost){toast('Недостаточно опыта!','error');return}
            await supabase.from('players').update({experience:Math.max(0,(currentUser.experience||0)-hireCost)}).eq('vk_id',currentUser.vk_id);
            await supabase.from('players').update({owner_id:currentUser.vk_id,status:'Работает',role:'Учёный',income_per_hour:1,level:1,hire_cost:hireCost}).eq('vk_id',player.vk_id);
            currentUser.experience=Math.max(0,(currentUser.experience||0)-hireCost);
            // Обновляем last_collect владельца
            await supabase.from('players').update({last_collect: new Date().toISOString()}).eq('vk_id', currentUser.vk_id);
            currentUser.last_collect = new Date().toISOString();
            toast('✅ Нанят! Доход будет через час','success');
            closePlayerModal();updateAllStats();loadMyTeam(true);renderAll();
        };
    }
    
    // УВОЛИТЬ
    if(isMyEmployee){
        var fireIncome=Math.floor((player.hire_cost||100)*0.8);
        fireBtn.style.display='block';
        fireBtn.textContent='🔥 Уволить (+'+fireIncome+' опыта)';
        fireBtn.onclick=async function(){
            await supabase.from('players').update({experience:(currentUser.experience||0)+fireIncome}).eq('vk_id',currentUser.vk_id);
            await supabase.from('players').update({owner_id:null,status:'Биржа труда',role:null,income_per_hour:0,level:1,hire_cost:100}).eq('vk_id',player.vk_id);
            currentUser.experience+=fireIncome;
            toast('🔥 Уволен! +'+fireIncome+' опыта','info');
            closePlayerModal();updateAllStats();loadMyTeam(true);renderAll();
        };
    }
    
    // Загружаем сотрудников игрока
    supabase.from('players').select('*').eq('owner_id',player.vk_id).order('experience',{ascending:false}).then(function(r){
        var list=document.getElementById('modal-player-employees');
        if(!r.data||!r.data.length){
            document.getElementById('modal-player-stats').textContent='⭐'+(player.experience||0)+' • Нет сотрудников';
            list.innerHTML='<p style="color:#aaa;">Нет сотрудников</p>';
        }else{
            document.getElementById('modal-player-stats').textContent='⭐'+(player.experience||0)+' • 👥 '+r.data.length+' сотр.';
            list.innerHTML='';
            r.data.forEach(function(emp){
                var stealCost=Math.floor((emp.hire_cost||100)*1.5);
                var div=document.createElement('div');div.className='player-item';
                div.innerHTML='<img src="'+(emp.photo_200||'https://vk.com/images/camera_200.png')+'" onerror="this.src=\'https://vk.com/images/camera_200.png\'" onclick="event.stopPropagation();openPlayerModalById('+emp.vk_id+')"><div class="info" onclick="openPlayerModalById('+emp.vk_id+')"><div class="name">'+emp.first_name+' '+emp.last_name+'<span class="lvl">'+(emp.level||1)+' ур</span></div><div class="detail">🔬 +'+(emp.income_per_hour||0)+' оп/час • 💰'+(emp.hire_cost||100)+'</div></div>';
                if(emp.owner_id!==currentUser.vk_id&&emp.vk_id!==currentUser.vk_id&&emp.vk_id!==currentUser.owner_id){
                    var btn=document.createElement('button');btn.className='btn-steal';btn.textContent='💰 '+stealCost;
                    btn.onclick=async function(e){
                        e.stopPropagation();
                        if((currentUser.experience||0)<stealCost){toast('Недостаточно опыта!','error');return}
                        await supabase.from('players').update({experience:Math.max(0,(currentUser.experience||0)-stealCost)}).eq('vk_id',currentUser.vk_id);
                        await supabase.from('players').update({owner_id:currentUser.vk_id,hire_cost:stealCost}).eq('vk_id',emp.vk_id);
                        currentUser.experience=Math.max(0,(currentUser.experience||0)-stealCost);
                        // Обновляем last_collect владельца
                        await supabase.from('players').update({last_collect: new Date().toISOString()}).eq('vk_id', currentUser.vk_id);
                        currentUser.last_collect = new Date().toISOString();
                        toast('✅ Перекуплен! Доход будет через час','success');
                        closePlayerModal();updateAllStats();loadMyTeam(true);renderAll();
                    };
                    div.appendChild(btn);
                }
                list.appendChild(div);
            });
        }
    });
}
function closePlayerModal(){document.getElementById('player-modal').style.display='none'}

// ================= МОДАЛКА КОМПАНИИ =================
async function openCompanyModal(name){
    var r0=await supabase.from('players').select('company,company_group_id').eq('company',name).limit(1);var groupId=(r0.data&&r0.data.length>0)?r0.data[0].company_group_id:null;
    document.getElementById('company-modal').style.display='flex';document.getElementById('modal-company-name').innerHTML='🏢 '+name;
    if(groupId)document.getElementById('modal-company-name').innerHTML+=' <a href="https://vk.com/club'+groupId+'" target="_blank" style="color:#4a76a8;font-size:13px;">📱</a>';
    var r=await supabase.from('players').select('*').eq('company',name);
    if(r.data){document.getElementById('modal-company-stats').textContent='👥 '+r.data.length+' сотрудников';var list=document.getElementById('modal-company-members');list.innerHTML='';r.data.forEach(function(p){var div=document.createElement('div');div.className='player-item';div.innerHTML='<img src="'+(p.photo_200||'https://vk.com/images/camera_200.png')+'" onerror="this.src=\'https://vk.com/images/camera_200.png\'"><div class="info" onclick="closeCompanyModal();openPlayerModalById('+p.vk_id+')"><div class="name">'+p.first_name+' '+p.last_name+'</div><div class="detail">⭐'+(p.experience||0)+'</div></div>';list.appendChild(div)});
        var jb=document.getElementById('modal-join-btn'),lb=document.getElementById('modal-leave-btn');jb.style.display='none';lb.style.display='none';
        if(currentUser.company===name){lb.style.display='block';lb.textContent='🚪 Выйти из компании (бесплатно)';lb.onclick=async function(){await supabase.from('players').update({company:null,company_group_id:null}).eq('vk_id',currentUser.vk_id);currentUser.company=null;currentUser.company_group_id=null;toast('Вышли из компании','info');closeCompanyModal();location.reload()}}
        else{jb.style.display='block';jb.onclick=async function(){await supabase.from('players').update({company:name}).eq('vk_id',currentUser.vk_id);currentUser.company=name;toast('✅ Вступили!','success');closeCompanyModal();location.reload()}}}
}
function closeCompanyModal(){document.getElementById('company-modal').style.display='none'}

// ================= НАСТРОЙКИ =================
function openSettings(){document.getElementById('settings-modal').style.display='flex';document.getElementById('promo-input').value='';document.getElementById('promo-go-btn').onclick=applyPromo}
function closeSettings(){document.getElementById('settings-modal').style.display='none'}
async function applyPromo(){
    var code=document.getElementById('promo-input').value.trim().toUpperCase();if(!code){toast('Введите промокод!','error');return}
    var r=await supabase.from('promocodes').select('*').eq('code',code).maybeSingle();
    if(!r.data){toast('Промокод не найден!','error');return}var promo=r.data;
    if(promo.used_by&&promo.used_by.includes(currentUser.vk_id)){toast('Вы уже использовали!','error');return}
    if(promo.used_by&&promo.used_by.length>=promo.max_uses){toast('Промокод не действует!','error');return}
    var newExp=(currentUser.experience||0)+promo.reward_exp;await supabase.from('players').update({experience:newExp}).eq('vk_id',currentUser.vk_id);currentUser.experience=newExp;
    var usedBy=promo.used_by||[];usedBy.push(currentUser.vk_id);await supabase.from('promocodes').update({used_by:usedBy}).eq('code',code);
    if(!currentUser.task_promo_done){await supabase.from('players').update({experience:currentUser.experience+1000,task_promo_done:true}).eq('vk_id',currentUser.vk_id);currentUser.experience+=1000;currentUser.task_promo_done=true;toast('🎁 +'+promo.reward_exp+' + бонус 1000!','success')}
    else{toast('🎁 +'+promo.reward_exp+' опыта!','success')}
    closeSettings();renderAll();
}

// ================= РЕФЕРАЛКА =================
function copyInviteLink(){var link='https://vk.com/app'+APP_ID+'#ref_'+currentUser.vk_id;navigator.clipboard?navigator.clipboard.writeText(link).then(function(){toast('🔗 Отправь ссылку другу!','info')}):prompt('Скопируй:',link)}

// ================= ОТРИСОВКА =================
function renderAll(){
    document.getElementById('header-avatar').src=currentUser.photo_200||currentVkUser.photo_200||'https://vk.com/images/camera_200.png';
    document.getElementById('player-name').textContent=currentUser.first_name+' '+currentUser.last_name;
    document.getElementById('exp-value').textContent=currentUser.experience||0;
    var compEl=document.getElementById('company-display');
    if(currentUser.company){var groupLink=currentUser.company_group_id?' <a href="https://vk.com/club'+currentUser.company_group_id+'" target="_blank" style="color:#4a76a8;font-size:10px;">📱</a>':'';compEl.innerHTML='🏢 <span style="cursor:pointer;" onclick="goTo(\'my-company\')">'+currentUser.company+'</span>'+groupLink}else{compEl.textContent=''}
    document.getElementById('collect-panel').style.display=myTeamTotal?'flex':'none';
    if(myTeamTotal){
        document.getElementById('collect-amount').textContent=currentUser.pending_experience||0;
        var maxP=currentUser.max_pending||0;
        if(maxP>0)document.getElementById('collect-amount').textContent+=' / '+maxP;
        document.getElementById('collect-btn').onclick=collectExperience;
    }
    document.getElementById('invite-friend-btn').onclick=copyInviteLink;
    renderTasks();
    loadMyTeam(true);
}

function renderTasks(){
    var tasksPanel=document.getElementById('tasks-panel');
    if(!tasksPanel)return;
    var html='';
    html+='<div class="task-item"><div class="task-info"><b>📱 Подписаться на группу</b><br><span style="font-size:11px;color:#aaa;">Награда: 1000 опыта</span></div>';
    if(currentUser.task_group_done){html+='<span style="color:#4caf50;">✅ Выполнено</span>'}
    else{html+='<button class="btn-task" onclick="doGroupTask()">▶ Выполнить</button><button class="btn-task-check" onclick="checkGroupTask()">🔍 Проверить</button>'}
    html+='</div>';
    html+='<div class="task-item"><div class="task-info"><b>🎁 Ввести промокод</b><br><span style="font-size:11px;color:#aaa;">Награда: 1000 опыта</span></div>';
    if(currentUser.task_promo_done){html+='<span style="color:#4caf50;">✅ Выполнено</span>'}
    else{html+='<button class="btn-task" onclick="doPromoTask()">▶ Выполнить</button>'}
    html+='</div>';
    tasksPanel.innerHTML=html;
}

document.getElementById('load-more-btn').addEventListener('click',function(){loadMyTeam(false)});
