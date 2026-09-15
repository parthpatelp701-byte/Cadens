import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectLegacyCalendar } from './calendarCompatibility'
import { pacificInput } from './time'

test('projects old IDs without copying records, filters completed tasks and honors planned date',()=>{
  const records = [
    {collection:'tasks',id:'old-task',payload:{text:'Plan',due_date:'2026-09-20',planned_date:'2026-09-13',is_done:false}},
    {collection:'tasks',id:'done',payload:{text:'Done',due_date:'2026-09-13',is_done:true}},
    {collection:'events',id:'old-event',payload:{title:'Picnic',date:'2026-09-13',allDay:true,source:'outlook',outlookId:'external-id'}},
  ]
  const before=JSON.stringify(records)
  const result=projectLegacyCalendar(records,'personal',pacificInput('2026-09-13'),pacificInput('2026-09-14'))
  assert.deepEqual(result.map(e=>e.id),['task:old-task','legacy-event:old-event'])
  assert.equal(result[0].task_id,'old-task')
  assert.equal(result[1].legacy_id,'old-event')
  assert.equal(result[1].ends_at,pacificInput('2026-09-14').toISOString())
  assert.equal(JSON.stringify(records),before)
})
test('keeps other days and unscheduled records out of the requested agenda',()=>{
  assert.equal(projectLegacyCalendar([
    {collection:'tasks',id:'no-date',payload:{text:'Someday'}},
    {collection:'events',id:'later',payload:{title:'Later',date:'2026-10-01'}},
  ],'personal',pacificInput('2026-09-13'),pacificInput('2026-09-14')).length,0)
})
