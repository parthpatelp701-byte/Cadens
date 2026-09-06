import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const original=readFileSync(new URL('../reference/Daybook-original.html',import.meta.url));
if(createHash('sha256').update(original).digest('hex')!=='13807a1d1325b15e6794f14f2fdfe93f37786514793b04e5e36a31b6900470ee') throw Error('Original reference changed');
let html=original.toString('utf8');
function replace(from,to){if(!html.includes(from))throw Error('Patch anchor missing: '+from);html=html.replace(from,to);}
replace('<title>Daybook</title>','<title>Cadens — Daybook</title>');
replace('<body>','<body>\n<link rel="stylesheet" href="cloud.css">\n<section id="cadensAuth" aria-label="Cadens account"></section>\n<div id="cadensCloudBar" hidden><span id="cadensStatus" role="status"></span><button id="cadensSave">Save now</button><button id="cadensLogout">Log out</button></div>');
replace('<div class="app" id="app">','<div class="app" id="app" hidden inert>');
replace("postMood:'😊', postPriv:'group'","postMood:'😊', postPriv:'private'");
replace('data-v="public">Public','data-v="public">Approved family');
replace('placeholder="DAY-AB12" maxlength="16"','placeholder="C-…" maxlength="32"');
replace('<button class="btn soft block" data-act="createGroup">','<label>Space type<select id="cadensGroupKind"><option value="group">Group</option><option value="family">Family</option></select></label><button class="btn soft block" data-act="createGroup">');
replace('function persist(){','function persist(){ return window.CadensCloud?.changed(); }\nfunction legacyPersist(){');
replace("const today = () => ymd(new Date());","const today = () => window.CadensCloud?.today() || new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver'}).format(new Date());");
replace("const addDays = n => { const d=new Date(); d.setDate(d.getDate()+n); return ymd(d); };","const addDays = n => { const d=parseYMD(today()); d.setDate(d.getDate()+n); return ymd(d); };");
replace("const t=new Date(); t.setHours(0,0,0,0);","const t=parseYMD(today());");
replace('const clone = {\n      id:uid(), text:t.text,','const clone = {\n      ...t, repeat_parent_id:t.id, id:uid(), text:t.text,');
replace('S.tasks.unshift(clone);','if(!S.tasks.some(x=>x.repeat_parent_id===t.id&&x.due_date===next)) S.tasks.unshift(clone);');
replace('const end = addMinutes(start, dur);','const end = addMinutes(start, dur);\n  const existing=S.events.find(e=>e.taskId===task.id);\n  if(existing){Object.assign(existing,{title:task.text.slice(0,80),date:task.due_date,start,end});return;}');
replace("const cur = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');","const cur = new Intl.DateTimeFormat('en-GB',{timeZone:'America/Vancouver',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);");
replace("S._lastRemind !== cur","S._lastRemind !== today()+' '+cur");
replace('S._lastRemind = cur;','S._lastRemind = today()+\' \'+cur;');
replace("(p.author==='You'||p.author===(S.profile.displayName||'You'))","(!p._ownerId||p._ownerId===window.CadensCloud?.userId)");
replace("${p.mood||''}","${esc(p.mood||'')}");
html=html.replaceAll('${p.id}','${esc(p.id)}');
replace('onclick="event.stopPropagation()"','');
replace("${(you[0]||'Y').toUpperCase()}","${esc((you[0]||'Y').toUpperCase())}");
replace("${(c.name[0]||'?').toUpperCase()}","${esc((c.name[0]||'?').toUpperCase())}");
// Numerical progress values are interpolated into markup by the original.
replace('const s = p.progress || {};','const s = Object.fromEntries(Object.entries(p.progress || {}).map(([k,v])=>[k,Number.isFinite(+v)?Math.max(0,+v):0]));');
const start=html.lastIndexOf('initThemeEngine();');
if(start<0)throw Error('Startup missing');
html=html.slice(0,start)+`window.CadensBoot = function(){
  initThemeEngine(); fillCats();
  const av=$('#avChip');if(av)av.textContent=((S.profile.displayName||'You')[0]||'Y').toUpperCase();
  go('tasks');
};
</script>
<script src="cloud.js"></script>
</body>
</html>
`;
writeFileSync(new URL('../index.html',import.meta.url),html);
