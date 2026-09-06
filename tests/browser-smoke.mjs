// Isolated browser and mocked service responses: never reads user browser sessions.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/ipart/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const user={id:'a1111111-1111-4111-8111-111111111111',email:'test@example.invalid',aud:'authenticated',role:'authenticated'};
 const token=Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
 let revision=0,records=[],settings={};
 await page.route('https://alcdn.msauth.net/**',route=>route.fulfill({body:'',contentType:'application/javascript'}));
 await page.route('https://iqnctgdnlyxjngqnzacr.supabase.co/**',async route=>{
  const path=new URL(route.request().url()).pathname;let data={};
  if(path.endsWith('/token'))data={access_token:token,refresh_token:'fixture',expires_in:3600,token_type:'bearer',user};
  if(path.endsWith('/user'))data=user;
  if(path.endsWith('/daybook_load'))data={revision,records,settings};
  if(path.endsWith('/daybook_groups')||path.endsWith('/daybook_feed'))data=[];
  if(path.endsWith('/objects'))data=[];
  if(path.endsWith('/daybook_sync')){const body=route.request().postDataJSON();assert.equal(body.expected,revision);for(const p of body.changes){records=records.filter(r=>r.collection!==p.collection||r.id!==p.id);if(!p.deleted)records.push(p);}settings=body.preferences;data=++revision;}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:5174');
 assert.equal(await page.locator('#app').isVisible(),false);
 await page.locator('[name=email]').fill(user.email);await page.locator('[name=password]').fill('FixtureOnly123!');await page.locator('#cadensAuthForm button').click();
 await page.locator('#app').waitFor({state:'visible'});
 await page.locator('#quickTask').fill('Browser smoke task');await page.locator('[data-act=addTask]').click();
 await page.waitForFunction(()=>document.getElementById('cadensStatus').textContent==='Saved to your account');
 assert.ok(records.some(r=>r.collection==='tasks'&&r.payload.text==='Browser smoke task'));
 const regression=await page.evaluate(()=>{
  const t=S.tasks[0];t.repeat='daily';t.due_date=today();t.due_time='10:00';t.duration=45;
  toggleTask(t.id);toggleTask(t.id);toggleTask(t.id);
  const children=S.tasks.filter(x=>x.repeat_parent_id===t.id);
  blockTaskOnCalendar(t);blockTaskOnCalendar(t);
  return {children:children.length,time:children[0].due_time,events:S.events.filter(e=>e.taskId===t.id).length};
 });
 assert.deepEqual(regression,{children:1,time:'10:00',events:1});
 for(const view of ['diary','calendar','social','notes','places','tasks']){
  await page.locator('.nav [data-act=go][data-v='+view+']').click();
  assert.equal(await page.locator('#v-'+view).isVisible(),true);
 }
 await page.locator('#cadensLogout').click();await page.locator('#cadensAuth').waitFor({state:'visible'});
 assert.equal(await page.locator('#app').isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: login gate, task save, recurrence undo/recomplete, calendar upsert, six original views, logout privacy, no runtime errors');
}finally{await browser.close();}
