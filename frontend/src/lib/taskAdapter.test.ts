import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'

// Exercise the real exported adapter with only the authenticated CAS transport replaced.
const built=await build({entryPoints:['src/lib/tasks.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'isolated-book',setup(b){b.onResolve({filter:/legacyRecords$/},()=>({path:'book',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export async function loadLegacyBook(){return structuredClone(globalThis.__taskBook)}; export async function mutateLegacyBook(build){const original=structuredClone(globalThis.__taskBook); const mutation=build(original); if(globalThis.__conflict) throw new Error('40001 revision conflict'); for(const r of mutation.changes){const index=globalThis.__taskBook.records.findIndex(x=>x.collection===r.collection&&x.id===r.id);if(r.deleted){if(index>=0)globalThis.__taskBook.records.splice(index,1)} else if(index>=0)globalThis.__taskBook.records[index]=r;else globalThis.__taskBook.records.push(r)} globalThis.__taskBook.settings=mutation.settings??original.settings;globalThis.__taskBook.revision++;}` ,loader:'js'}))}}]})
const api=await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`)
const fixture=()=>({revision:7,settings:{profile:{showOnLeaderboard:false},custom:'keep'},records:[{collection:'notes',id:'n1',payload:{body:'private'}},{collection:'tasks',id:'legacy-string',payload:{id:'legacy-string',text:'Old task',is_done:false,updated_at:'old-version',custom:{keep:true},priority:'high',estimate:60,subs:[{text:'One',done:true}],repeat:'daily',due_date:'2026-09-13'}}]})
const state=globalThis as any

test('adapter edits preserve unrelated records, settings, original IDs and task metadata',async()=>{
 state.__taskBook=fixture(); state.__conflict=false
 await api.updateTask('legacy-string',{title:'Updated',expectedUpdatedAt:'old-version'})
 assert.equal(state.__taskBook.revision,8)
 assert.equal(state.__taskBook.records[1].payload.text,'Updated')
 assert.deepEqual(state.__taskBook.records[1].payload.custom,{keep:true})
 assert.deepEqual(state.__taskBook.settings,fixture().settings)
 assert.deepEqual(state.__taskBook.records[0],fixture().records[0])
 assert.equal((await api.listTasks())[0].id,'legacy-string')
})
test('adapter completion writes settings, log and recurrence atomically with no repeat award',async()=>{
 state.__taskBook=fixture(); state.__conflict=false
 await api.setTaskStatus('legacy-string','done')
 const points=state.__taskBook.settings.weekPoints
 assert.equal(points,15)
 assert.equal(state.__taskBook.records.filter((r:any)=>r.collection==='tasks').length,2)
 assert.equal(state.__taskBook.records.filter((r:any)=>r.collection==='log').length,1)
 await api.setTaskStatus('legacy-string','done')
 await api.setTaskStatus('legacy-string','open')
 await api.setTaskStatus('legacy-string','done')
 assert.equal(state.__taskBook.settings.weekPoints,points)
 assert.equal(state.__taskBook.records.filter((r:any)=>r.collection==='tasks').length,2)
 assert.equal(state.__taskBook.settings.profile.showOnLeaderboard,false)
})
test('adapter rejects stale editor and failed CAS without modifying fixture',async()=>{
 state.__taskBook=fixture(); state.__conflict=false
 await assert.rejects(api.updateTask('legacy-string',{title:'Lost update',expectedUpdatedAt:'older'}),/changed elsewhere/)
 assert.deepEqual(state.__taskBook,fixture())
 state.__conflict=true
 await assert.rejects(api.setTaskStatus('legacy-string','done'),/revision conflict/)
 assert.deepEqual(state.__taskBook,fixture())
 state.__conflict=false
})
