import assert from 'node:assert/strict'
import { test } from 'node:test'
import { completeLegacyTask, nextTaskDate, taskPoints } from './taskCompatibility'
const now = new Date('2026-09-13T05:00:00Z')
const task = {id:'old-text-id',text:'Prepare dinner',is_done:false,priority:'high',estimate:60,subs:[{id:'s1',text:'Shop',done:true}],repeat:'daily',due_date:'2026-09-12',custom:{keep:true}}
test('fair points preserve effort, priority, checklist and quick cap',()=>{
  assert.equal(taskPoints(task),15)
  assert.equal(taskPoints({...task,quick:true,estimate:999}),2)
  assert.equal(taskPoints({...task,estimate:999,priority:'urgent',subs:Array(90).fill({})}),35)
})
test('completion preserves IDs, unknown metadata and resets only recurrence state',()=>{
  const result=completeLegacyTask(task,true,[task],{profile:{showOnLeaderboard:false},xp:0,level:1},now,'next-id')
  assert.equal(result.row.id,task.id)
  assert.deepEqual(result.row.custom,task.custom)
  assert.equal(result.earned,15)
  assert.equal(result.next?.id,'next-id')
  assert.equal(result.next?.repeat_parent_id,task.id)
  assert.equal(result.next?.due_date,'2026-09-13')
  assert.deepEqual(result.next?.subs,[{id:'s1',text:'Shop',done:false}])
  assert.deepEqual(result.settings.profile,{showOnLeaderboard:false})
})
test('reopen and recomplete cannot farm points or create a duplicate recurrence',()=>{
  const first=completeLegacyTask(task,true,[task],{},now,'next-id')
  const reopened=completeLegacyTask(first.row,false,[first.row,first.next!],first.settings,now,'unused')
  const redone=completeLegacyTask(reopened.row,true,[reopened.row,first.next!],reopened.settings,now,'unused')
  assert.equal(redone.earned,0)
  assert.equal(redone.next,null)
  assert.equal(redone.settings.weekPoints,15)
  const duplicate=completeLegacyTask(first.row,true,[first.row],first.settings,now,'unused')
  assert.equal(duplicate.row,first.row)
  assert.equal(duplicate.earned,0)
})
test('weekly rollover keeps private settings/history and XP levels',()=>{
  const result=completeLegacyTask({...task,repeat:''},true,[task],{pointsWeekStart:'2026-08-31',weekPoints:99,xp:39,level:1,other:'keep'},now,'unused')
  assert.equal(result.settings.pointsWeekStart,'2026-09-07')
  assert.deepEqual(result.settings.pointsHistory,[{week:'2026-08-31',points:99}])
  assert.equal(result.settings.xp,14)
  assert.equal(result.settings.level,2)
  assert.equal(result.settings.other,'keep')
})
test('Pacific recurrence survives daylight changes and weekends',()=>{
  assert.equal(nextTaskDate('daily','2026-03-08'),'2026-03-09')
  assert.equal(nextTaskDate('daily','2026-11-01'),'2026-11-02')
  assert.equal(nextTaskDate('weekdays','2026-09-11'),'2026-09-14')
  assert.equal(nextTaskDate('weekly','2026-12-28'),'2027-01-04')
  assert.equal(nextTaskDate('unknown','2026-09-11'),null)
})
