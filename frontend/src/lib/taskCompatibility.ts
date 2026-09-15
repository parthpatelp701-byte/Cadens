import { pacificDay, pacificInput } from './time'
export type TaskPayload = Record<string, any>
export function taskPoints(t: TaskPayload): number {
  if (t.quick) return 2
  const estimate = Number(t.estimate) || Number(t.duration) || 0
  const minutes = estimate > 0 ? estimate : 20
  const priority = ({low:0,normal:2,high:5,urgent:8} as Record<string,number>)[t.priority] ?? 2
  return Math.max(2, Math.min(40, 3 + Math.max(1,Math.min(18,Math.round(minutes/10))) + priority + Math.min(6, Array.isArray(t.subs) ? t.subs.length : 0)))
}
export function nextTaskDate(repeat: string, day: string): string | null {
  if (!['daily','weekly','weekdays'].includes(repeat)) return null
  const d = pacificInput(day)
  d.setDate(d.getDate() + (repeat === 'weekly' ? 7 : 1))
  while (repeat === 'weekdays' && [0,6].includes(d.getDay())) d.setDate(d.getDate()+1)
  return pacificDay(d)
}
// Returns a single atomic record/settings change; callers persist through the existing revision CAS.
export function completeLegacyTask(task: TaskPayload, done: boolean, tasks: TaskPayload[], preferences: TaskPayload, now: Date, newId: string) {
  const row: TaskPayload = {...task, is_done:done, progress:done ? 100 : (task.progress >= 100 ? 0 : task.progress), updated_at:now.toISOString()}
  const settings = {...preferences}
  let next: TaskPayload | null = null
  if (!!task.is_done === done) return {row:task,settings,next,earned:0}
  let earned = 0
  if (done) {
    const day = pacificDay(now)
    settings.combo = settings.comboDay === day ? (Number(settings.combo)||0)+1 : 1
    settings.comboDay = day
    if (!task.pointsAwarded) {
      earned = taskPoints(task) + (task.quick ? 0 : Math.min(5,settings.combo-1))
      row.pointsAwarded = true
      const monday = pacificInput(day)
      monday.setDate(monday.getDate() - (monday.getDay()+6)%7)
      const week = pacificDay(monday)
      if (settings.pointsWeekStart !== week) {
        settings.pointsHistory = (settings.pointsWeekStart ? [{week:settings.pointsWeekStart,points:settings.weekPoints||0},...(settings.pointsHistory||[])] : (settings.pointsHistory||[])).slice(0,12)
        settings.pointsWeekStart = week
        settings.weekPoints = 0
      }
      settings.weekPoints = (Number(settings.weekPoints)||0)+earned
      settings.xp = (Number(settings.xp)||0)+earned
      settings.level = Math.max(1, Number(settings.level)||1)
      while(settings.xp >= settings.level*40) { settings.xp -= settings.level*40; settings.level++ }
    }
    const due = nextTaskDate(task.repeat, task.due_date || day)
    if (due && !tasks.some(t=>t.repeat_parent_id === task.id && t.due_date === due)) {
      next = {...row,id:newId,is_done:false,pointsAwarded:false,repeat_parent_id:task.id,due_date:due,progress:0,planned_date:null,pinned:false,subs:(task.subs||[]).map((s:TaskPayload)=>({...s,done:false})),created_at:now.toISOString(),updated_at:now.toISOString()}
    }
  } else settings.combo = 0
  return {row,settings,next,earned}
}


