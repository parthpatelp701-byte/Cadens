/* Isolated UI regression checks. All Supabase traffic is mocked; no beta data or email is touched. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/ipart/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const base = process.env.CADENS_TEST_URL || 'http://127.0.0.1:5173'
const out = path.resolve(__dirname, '../../tests/theme-review')
fs.mkdirSync(out, { recursive: true })
const user = { id:'00000000-0000-4000-8000-000000000001', aud:'authenticated', role:'authenticated', email:'cadens-ui-test@example.invalid', user_metadata:{full_name:'UI check'}, app_metadata:{provider:'email'}, created_at:new Date().toISOString() }
const session = { access_token:'ui-fixture-token', refresh_token:'ui-fixture-refresh', token_type:'bearer', expires_in:36000, expires_at:Math.floor(Date.now()/1000)+36000, user }
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver'}).format(new Date())
const book = { revision:1, settings:{profile:{displayName:'UI check',family:[],showOnLeaderboard:true},xp:0,level:1,weekPoints:0,pointsWeekStart:today}, records:[{collection:'tasks',id:'ui-task-1',payload:{id:'ui-task-1',text:'Plan a little adventure',due_date:today,is_done:false,priority:'normal',category:'Personal',subs:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString(),unknown_field:'preserve-me'}}] }
const calendar = {id:'ui-calendar',user_id:user.id,name:'Personal',color:'#16a34a',kind:'personal',is_default:true}
const report = { fixtureOnly:true, base, checks:[], layouts:[], errors:[], unknownEndpoints:[], transitions:[] }
let browser
async function check(name, work) { await work(); report.checks.push(name); console.log('PASS: '+name) }
;(async()=>{
  browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'})
  const context = await browser.newContext({viewport:{width:1366,height:900}})
  await context.addInitScript(()=>{
    addEventListener('pagereveal',event=>{
      if(event.viewTransition)event.viewTransition.ready.then(()=>{window.__cadensDocumentTransition='ready';console.info('CADENS_TRANSITION:ready')}).catch(error=>{window.__cadensDocumentTransition='failed:'+error.message;console.info('CADENS_TRANSITION:'+window.__cadensDocumentTransition)})
    })
  })
  await context.route('**/iqnctgdnlyxjngqnzacr.supabase.co/**', async route=>{
    const request=route.request(), url=new URL(request.url()), endpoint=url.pathname.split('/').pop()
    let body={}; try{body=request.postDataJSON() || {}}catch{}
    let result=[]
    if(url.pathname.includes('/auth/v1/')) result=endpoint==='token'?session:endpoint==='user'?user:endpoint==='signup'?{user}:{}
    else if(endpoint==='daybook_load') result=book
    else if(endpoint==='daybook_sync') {
      if(body.expected!==book.revision) return route.fulfill({status:409,json:{code:'40001',message:'Revision conflict'}})
      for(const change of body.changes || []) {
        const index=book.records.findIndex(row=>row.id===change.id && row.collection===change.collection)
        if(change.deleted){if(index>=0)book.records.splice(index,1)}
        else if(index>=0)book.records[index]=change
        else book.records.push(change)
      }
      book.settings=body.preferences; result=++book.revision
    } else if(endpoint==='ensure_default_calendar') result=calendar
    else if(endpoint==='calendars') result=[calendar]
    else if(endpoint==='daybook_notifications_unread_count') result=0
    else if(!['list_calendar_events','daybook_groups','daybook_feed','profiles','objects','daybook_notifications_list'].includes(endpoint)) report.unknownEndpoints.push(endpoint)
    await route.fulfill({status:200,json:result})
  })
  const page=await context.newPage()
  page.on('pageerror',error=>report.errors.push(error.message))
  page.on('console',message=>{if(message.text().startsWith('CADENS_TRANSITION:'))report.transitions.push(message.text())})
  await check('Landing CTA opens pink signup with the heartbeat layout',async()=>{
    await page.goto(base+'/welcome.html')
    await page.locator('a[href="/signup"]').first().click()
    await page.getByRole('heading',{name:'start your cadence',exact:true}).waitFor()
    await page.waitForFunction(()=>window.__cadensDocumentTransition==='ready')
    assert.equal(new URL(page.url()).pathname,'/signup')
    assert.equal(await page.locator('button[type=submit]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(236, 72, 153)')
    assert.equal(await page.locator('.auth-beat').count(),1)
    await page.screenshot({path:path.join(out,'signup-desktop.png')})
  })
  await check('Signup, reset, login and browser back retain working auth navigation',async()=>{
    await page.getByLabel('Email',{exact:true}).fill(user.email)
    await page.getByLabel('Password',{exact:true}).fill('Test-only-passphrase123!')
    await page.getByRole('button',{name:'get started free',exact:true}).click()
    await page.getByText('Check your inbox — one tap and you’re in.',{exact:true}).waitFor()
    await page.getByRole('link',{name:'Forgot password',exact:true}).click()
    await page.getByRole('button',{name:'send reset link',exact:true}).click()
    await page.getByText('If that account exists, a reset link is on the way.',{exact:true}).waitFor()
    await page.getByRole('heading',{name:'back to your rhythm',exact:true}).waitFor()
    await page.getByRole('link',{name:'Sign up',exact:true}).click()
    await page.getByRole('heading',{name:'start your cadence',exact:true}).waitFor()
    await page.goBack()
    await page.getByRole('heading',{name:'back to your rhythm',exact:true}).waitFor()
    await page.getByRole('button',{name:'keep going',exact:true}).click()
    await page.locator('.mode-grid').waitFor()
    assert.equal(await page.locator('.mode-card').count(),6)
    const plan=page.locator('.mode-card').filter({hasText:'plan the day'})
    await plan.locator('summary').click()
    await plan.getByRole('link',{name:'tasks',exact:true}).click()
    await page.getByRole('heading',{name:'Tasks',exact:true}).waitFor()
  })
  await check('Task dialog focus trap, Escape and long form scrolling',async()=>{
    await page.goto(base+'/tasks')
    await page.getByRole('button',{name:'New',exact:true}).click()
    const dialog=page.getByRole('dialog')
    await dialog.waitFor()
    await page.getByRole('button',{name:'Close',exact:true}).focus()
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'Cancel')
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Close')
    await page.keyboard.press('Escape')
    await dialog.waitFor({state:'hidden'})
    assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'New')
  })
  await check('Create and complete a task, preserve unknown fields, update points once',async()=>{
    await page.getByRole('button',{name:'New',exact:true}).click()
    await page.getByPlaceholder('What needs doing?').fill('UI test task')
    await page.getByRole('dialog').locator('input[type=date]').fill(today)
    await page.getByRole('button',{name:'Save task',exact:true}).click()
    await page.getByRole('dialog').waitFor({state:'hidden'})
    await page.getByText('UI test task',{exact:true}).waitFor()
    const item=page.getByRole('list',{name:'Tasks'}).locator('li').filter({hasText:'Plan a little adventure'})
    await item.getByRole('button',{name:'Mark done',exact:true}).click()
    await item.waitFor({state:'hidden'})
    const task=book.records.find(row=>row.id==='ui-task-1').payload
    assert.equal(task.is_done,true);assert.equal(task.unknown_field,'preserve-me');assert.equal(task.pointsAwarded,true)
    assert.ok(book.settings.weekPoints>0)
    const awarded=book.settings.weekPoints
    await page.getByRole('tab',{name:'Done',exact:true}).click()
    await page.getByRole('button',{name:'Mark open',exact:true}).first().click()
    await page.getByRole('tab',{name:'Today',exact:true}).click()
    await page.getByRole('list',{name:'Tasks'}).locator('li').filter({hasText:'Plan a little adventure'}).getByRole('button',{name:'Mark done',exact:true}).click()
    await page.waitForFunction(()=>!document.querySelector('[aria-label="Tasks"]')?.textContent.includes('Plan a little adventure'))
    assert.equal(book.settings.weekPoints,awarded)
  })
  for(const width of [360,375,414,430,768,1024,1366]) {
    await page.setViewportSize({width,height:900})
    for(const route of ['/','/tasks','/calendar','/journal','/saves','/progress','/people','/you']) {
      await page.goto(base+route)
      await page.locator('main h1').first().waitFor()
      await page.waitForLoadState('networkidle')
      const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,bg:getComputedStyle(document.body).backgroundColor}))
      assert.ok(layout.scroll<=width+1,route+' overflows at '+width)
      assert.equal(layout.bg,'rgb(9, 9, 11)')
      report.layouts.push({route,width,pass:true})
      if(width===375 && ['/', '/calendar','/journal'].includes(route)) await page.screenshot({path:path.join(out,(route==='/'?'today':route.slice(1))+'-375.png')})
    }
  }
  console.log('PASS: 56 route/viewport dark-theme and overflow checks')
  await check('Specialist modes load and leaderboard mute persists',async()=>{
    await page.setViewportSize({width:414,height:900})
    for(const mode of ['focus','places','lists','links','wrap','review','sync','calendar','share','leaderboard']) {
      await page.goto(base+'/app.html?mode='+mode)
      await page.locator('#app:not([hidden])').waitFor()
      assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(9, 9, 11)')
    }
    await page.locator('#leaderboardCard').waitFor()
    await page.locator('#leaderboardCard [data-act="toggleLbVisible"]').click()
    await page.waitForFunction(()=>document.querySelector('#cadensStatus')?.textContent==='Saved to your account')
    assert.equal(book.settings.profile.showOnLeaderboard,false)
    await page.screenshot({path:path.join(out,'leaderboard-414.png')})
  })
  await check('Reduced motion and single auth entry fallback',async()=>{
    await context.clearCookies()
    await page.evaluate(()=>localStorage.clear())
    await page.emulateMedia({reducedMotion:'reduce'})
    await page.goto(base+'/cadens-auth.html#signup')
    await page.getByRole('heading',{name:'start your cadence',exact:true}).waitFor()
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    const animations=await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)
    assert.equal(animations,0)
    await page.setViewportSize({width:375,height:812})
    await page.screenshot({path:path.join(out,'signup-375.png'),fullPage:true})
  })
  assert.deepEqual(report.errors,[])
  report.result='PASS'
})().catch(error=>{report.result='FAIL';report.failure=error.stack;console.error(error);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();fs.writeFileSync(path.join(out,'ui-results.json'),JSON.stringify(report,null,2)+'\n')})
