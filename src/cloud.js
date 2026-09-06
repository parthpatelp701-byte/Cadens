import {createClient} from '@supabase/supabase-js';
import {collections,preferenceKeys,delta,canonical,pacificDay,validateBackup} from './sync.mjs';
const client=createClient(CADENS_URL,CADENS_KEY);
const blank=structuredClone(S);
let user=null, revision=0, confirmed={},dirty=false,saving=null,blocked=false,generation=0,timer,groups=[];
const photos=new Map();
const auth=document.getElementById('cadensAuth'),app=document.getElementById('app'),bar=document.getElementById('cadensCloudBar');
function status(message){document.getElementById('cadensStatus').textContent=message;}
async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
function snapshot(){
  const result={};
  for(const c of collections) result[c]=S[c].filter(p=>!p._ownerId||p._ownerId===user?.id).map(p=>{
    const r=structuredClone(p);delete r._ownerId;delete r._recordId;
    if(c==='posts'){delete r.likes;delete r.liked;delete r.comments;delete r.author;delete r.avatar;}
    if(c==='places'&&r.photo_path)delete r.photo;
    return r;
  });
  for(const k of preferenceKeys)result[k]=structuredClone(S[k]);
  result.profile.group=null; result.selectedGroup=S.profile.group?.id||null;
  return result;
}
function settings(book){return Object.fromEntries(Object.entries(book).filter(([k])=>!collections.includes(k)));}
function stash(){try{sessionStorage.setItem('cadens-draft:'+user.id,JSON.stringify(snapshot()));}catch{status('Unsaved changes — keep this tab open and export a backup.');}}
function changed(){if(!user)return;dirty=true;stash();status('Unsaved changes');clearTimeout(timer);timer=setTimeout(()=>flush().catch(showError),500);}
function showError(error){status(error.message||String(error));}
async function preparePhotos(epoch){
  for(const place of S.places){
    if(!place.photo?.startsWith('data:'))continue;
    const source=place.photo;
    if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(source))throw Error('Unsupported photo format');
    const blob=await (await fetch(source)).blob();
    if(blob.size>1258291)throw Error('Photo must be smaller than 1.2 MB');
    const path=user.id+'/'+crypto.randomUUID();
    const {error}=await client.storage.from('cadens-photos').upload(path,blob,{contentType:blob.type,upsert:false});
    if(error)throw error;if(epoch!==generation)throw Error('Account changed');
    if(place.photo===source){place.photo_path=path;place.photo=URL.createObjectURL(blob);photos.set(path,place.photo);}
  }
}
async function flush(){
  if(saving)return saving;
  if(!user||!dirty)return;
  if(blocked)throw Error('Another device saved changes. Export this draft, then reload to continue.');
  const epoch=generation;
  saving=(async()=>{
    while(dirty&&epoch===generation){
      status('Saving…'); await preparePhotos(epoch);
      const book=snapshot(),changes=delta(confirmed,book);
      try{const next=await rpc('daybook_sync',{expected:revision,changes,preferences:settings(book)});
        if(epoch!==generation)return;
        revision=next;confirmed=book;dirty=canonical(snapshot())!==canonical(book);
        if(!dirty)sessionStorage.removeItem('cadens-draft:'+user.id);
        status(dirty?'Saving…':'Saved to your account');
      }catch(error){if(error.code==='40001')blocked=true;stash();throw error;}
    }
  })().finally(()=>{saving=null;});
  return saving;
}
function gate(){
  generation++;user=null;dirty=false;blocked=false;confirmed={};groups=[];clearTimeout(timer);
  clearInterval(S._focusTimer);clearInterval(S._breakTimer);
  for(const url of photos.values())URL.revokeObjectURL(url);photos.clear();
  Object.assign(S,structuredClone(blank));closeSheets();
  app.hidden=true;app.inert=true;bar.hidden=true;auth.hidden=false;
  bar.querySelectorAll('[data-extra]').forEach(b=>b.remove());
}
function authForm(mode='login',message=''){
  auth.hidden=false;
  auth.innerHTML=`<h1>Cadens</h1><h2>${{login:'Welcome back',signup:'Create your account',reset:'Reset password',password:'Choose a new password',loading:'Opening your account'}[mode]}</h2>
  <form id="cadensAuthForm">${['login','signup','reset'].includes(mode)?'<label>Email<input name="email" type="email" required autocomplete="email"></label>':''}
  ${['login','signup','password'].includes(mode)?'<label>Password<input name="password" type="password" required minlength="8" autocomplete="'+(mode==='login'?'current-password':'new-password')+'"></label>':''}
  ${mode!=='loading'?'<button type="submit">Continue</button>':''}</form><p role="alert" id="cadensAuthMessage"></p>
  <button data-auth="login">Log in</button><button data-auth="signup">Sign up</button><button data-auth="reset">Forgot password</button>`;
  document.getElementById('cadensAuthMessage').textContent=message;
  auth.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>authForm(b.dataset.auth));
  document.getElementById('cadensAuthForm').onsubmit=async event=>{
    event.preventDefault();const form=event.target,button=form.querySelector('button');button.disabled=true;
    const values=new FormData(form),email=values.get('email'),password=values.get('password');let result;
    try{
      if(mode==='login')result=await client.auth.signInWithPassword({email,password});
      if(mode==='signup')result=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/'}});
      if(mode==='reset')result=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/?recovery=1'});
      if(mode==='password')result=await client.auth.updateUser({password});
      if(result.error)throw result.error;
      if(mode==='signup'&&!result.data.session)authForm('login','Check your email to verify your account.');
      if(mode==='reset')authForm('login','If an account exists, a reset link has been requested.');
      if(mode==='password'){history.replaceState(null,'',location.pathname);await openAccount(result.data.user);}
    }catch(error){document.getElementById('cadensAuthMessage').textContent=error.message;}
    finally{button.disabled=false;}
  };
}
async function openAccount(next){
  if(user?.id===next.id)return;
  gate();user=next;const epoch=generation;authForm('loading');
  try{
    const data=await rpc('daybook_load');if(epoch!==generation)return;
    for(const k of preferenceKeys)if(data.settings[k]!==undefined)S[k]=data.settings[k];
    S.profile={...blank.profile,...S.profile,group:null};
    for(const c of collections)S[c]=data.records.filter(r=>r.collection===c).map(r=>({...r.payload,id:r.id}));
    revision=data.revision;confirmed=snapshot();
    await refreshGroups(data.settings.selectedGroup);await refreshFeed();
    if(epoch!==generation)return;
    for(const p of S.places)if(p.photo_path){const {data:blob,error}=await client.storage.from('cadens-photos').download(p.photo_path);if(epoch!==generation)return;if(!error){p.photo=URL.createObjectURL(blob);photos.set(p.photo_path,p.photo);}}
    const draft=sessionStorage.getItem('cadens-draft:'+user.id);
    auth.hidden=true;bar.hidden=false;app.hidden=false;app.inert=false;window.CadensBoot();
    status(draft?'An unsaved draft is available. Export it before reloading.':'Saved to your account');
    if(draft){const b=document.createElement('button');b.dataset.extra='draft';b.textContent='Export previous draft';b.onclick=()=>download(JSON.parse(draft));bar.append(b);}
    offerEarlierCaptures(epoch);
  }catch(error){if(epoch===generation){gate();authForm('login','Could not load your account: '+error.message);}}
}
async function refreshGroups(selected=S.profile.group?.id){
  const epoch=generation;const list=await rpc('daybook_groups');if(epoch!==generation)return;
  groups=list;S.profile.group=groups.find(g=>g.id===selected&&g.status==='active')||groups.find(g=>g.status==='active')||null;
}
async function refreshFeed(){
  const epoch=generation,list=await rpc('daybook_feed');if(epoch!==generation)return;
  const own=S.posts.filter(p=>!p._ownerId||p._ownerId===user.id);
  const safe=list.map(p=>({...p,id:p._ownerId===user.id?p.id:p._ownerId+':'+p.id,_recordId:p.id,
    avatar:String(p.author||'M')[0],mood:String(p.mood||''),author:String(p.author||'Member')}));
  S.posts=own.map(p=>({...p,...safe.find(x=>x._ownerId===user.id&&x.id===p.id)})).concat(safe.filter(p=>p._ownerId!==user.id));
}
renderGroupSheet=function(){
  document.getElementById('leaveGroupBtn').hidden=true;
  document.getElementById('groupCurrent').innerHTML=groups.length?groups.map(g=>`<div class="group-banner"><div><b>${esc(g.name)}</b><p>${esc(g.status==='active'?g.code:'Waiting for owner approval')}</p>${g.status==='active'?`<button data-cloud="select" data-group="${g.id}">Use this space</button>`:''}${g.ownerId===user.id?`<button data-cloud="rotate" data-group="${g.id}">Replace invite code</button><button data-cloud="delete" data-group="${g.id}">Delete group</button>`:`<button data-cloud="leave" data-group="${g.id}">Leave</button>`}</div></div>`).join(''):'<p>No groups yet. Join requests require owner approval.</p>';
  document.getElementById('groupMembers').innerHTML=groups.filter(g=>g.status==='active').map(g=>`<h3>${esc(g.name)}</h3>`+g.members.map(m=>`<div class="circle-row"><b>${esc(m.name)}</b> · ${esc(m.status)} ${g.ownerId===user.id&&m.id!==user.id?`${m.status==='pending'?`<button data-cloud="approve" data-group="${g.id}" data-member="${m.id}">Approve</button>`:''}<button data-cloud="remove" data-group="${g.id}" data-member="${m.id}">Remove</button>`:''}</div>`).join('')).join('');
};
function download(book){const url=URL.createObjectURL(new Blob([JSON.stringify(book,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='cadens-'+pacificDay()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportBook(){
 const book=snapshot();
 for(const p of book.places)if(p.photo_path){
  const {data,error}=await client.storage.from('cadens-photos').download(p.photo_path);if(error)throw error;
  p.photo=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(data);});delete p.photo_path;
 }
 download(book);
}
async function offerEarlierCaptures(epoch){
 const {data,error}=await client.from('objects').select('*');
 if(error||epoch!==generation||!data?.length)return;
 const pending=data.filter(p=>!collections.some(c=>S[c].some(x=>x.legacy_capture_id===p.id)));
 if(!pending.length)return;
 const button=document.createElement('button');button.dataset.extra='legacy';button.textContent='Import '+pending.length+' earlier captures';
 button.onclick=async()=>{try{
  for(const p of pending){const base={id:crypto.randomUUID(),legacy_capture_id:p.id,created_at:p.created_at};
   if(p.kind==='task')S.tasks.push({...base,text:p.title,notes:p.body||'',is_done:p.is_done,due_date:p.due_date,priority:'normal',progress:p.is_done?100:0,category:'Personal',subs:[]});
   else if(p.kind==='event'&&p.due_date)S.events.push({...base,title:p.title,notes:p.body||'',date:p.due_date,allDay:true,color:'#8B5CF6'});
   else if(p.kind==='place')S.places.push({...base,name:p.title,note:p.body||'',kind:'saved'});
   else if(p.kind==='list')S.lists.push({...base,name:p.title,items:(p.body||'').split('\n').filter(Boolean).map(text=>({id:crypto.randomUUID(),text,done:false}))});
   else S.notes.push({...base,title:p.title,body:(p.body||'')+(p.url?'\n'+p.url:''),color:0});
  }
  changed();await flush();button.remove();render();
 }catch(error){showError(error);}};bar.append(button);
}
document.addEventListener('click',async event=>{
  const b=event.target.closest('[data-act],[data-cloud]');if(!b||!user)return;
  const act=b.dataset.act,cloud=b.dataset.cloud;
  if(!cloud&&!['createGroup','joinGroup','leaveGroup','like','comment','delPost','export','reset'].includes(act))return;
  event.preventDefault();event.stopImmediatePropagation();
  try{
    if(act==='export'){await exportBook();return;}
    if(act==='reset'){if(confirm('Delete all your personal records? Your group memberships remain.')){for(const c of collections)S[c]=[];changed();await flush();render();}return;}
    await flush();
    if(cloud==='select'){S.profile.group=groups.find(g=>g.id===b.dataset.group&&g.status==='active')||null;changed();renderGroupBanner();return;}
    if(cloud||['createGroup','joinGroup','leaveGroup'].includes(act)){
      const action=cloud||{createGroup:'create',joinGroup:'join',leaveGroup:'leave'}[act];
      if(['delete','remove','rotate'].includes(action)&&!confirm(action==='delete'?'Delete this group and revoke its shared access?':'Confirm this membership or invite-code change?'))return;
      groups=await rpc('daybook_group_action',{action,target:b.dataset.group||S.profile.group?.id||null,member_id:b.dataset.member||null,label:document.getElementById('gName').value,invite_code:document.getElementById('gCode').value,group_kind:document.getElementById('cadensGroupKind').value});
      await refreshGroups();await refreshFeed();renderGroupSheet();renderGroupBanner();renderSocial();return;
    }
    const p=S.posts.find(p=>p.id===b.dataset.id);if(!p)return;
    if(act==='delPost'){if(p._ownerId&&p._ownerId!==user.id)throw Error('You can only delete your own posts');S.posts=S.posts.filter(x=>x!==p);changed();await flush();}
    else {const body=act==='comment'?prompt('Comment'):'';if(act==='comment'&&!body?.trim())return;await rpc('daybook_social_action',{action:act==='like'?(p.liked?'unlike':'like'):'comment',post_owner:p._ownerId||user.id,post_id:p._recordId||p.id,body:body||''});}
    await refreshFeed();renderSocial();
  }catch(error){showError(error);toast(error.message);}
},true);
document.addEventListener('change',async event=>{
  if(event.target.id!=='importFile')return;event.stopImmediatePropagation();
  const file=event.target.files?.[0];event.target.value='';if(!file||!user)return;
  try{if(file.size>20000000)throw Error('Backup exceeds 20 MB');const book=validateBackup(JSON.parse(await file.text()));if(!confirm('Replace your personal data with this backup? Imported posts will be private.'))return;Object.assign(S,book);changed();await flush();fillCats();render();toast('Imported and saved');}catch(error){toast(error.message);}
},true);
document.getElementById('cadensSave').onclick=()=>flush().catch(showError);
document.getElementById('cadensLogout').onclick=async()=>{try{await flush();const {error}=await client.auth.signOut();if(error)throw error;gate();authForm();}catch(error){showError(error);}};
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('online',()=>flush().catch(showError));
let refreshing=false;
async function refreshRemote(){
  if(!user||dirty||saving||refreshing||auth.hidden===false)return;
  refreshing=true;const epoch=generation;
  try{await refreshGroups();if(epoch!==generation||dirty)return;await refreshFeed();if(epoch===generation&&S.view==='social')renderSocial();}
  catch(error){showError(error);}finally{refreshing=false;}
}
window.addEventListener('focus',refreshRemote);
setInterval(refreshRemote,30000);
window.CadensCloud={changed,today:pacificDay,get userId(){return user?.id;}};
client.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'){gate();authForm();}
  else if(event==='PASSWORD_RECOVERY'){gate();authForm('password');}
  else if(session?.user&&!new URLSearchParams(location.search).has('recovery'))setTimeout(()=>openAccount(session.user),0);
});
gate();authForm();
client.auth.getSession().then(({data,error})=>{if(error){authForm('login',error.message);return;}if(data.session){if(new URLSearchParams(location.search).has('recovery'))authForm('password');else openAccount(data.session.user);}});
