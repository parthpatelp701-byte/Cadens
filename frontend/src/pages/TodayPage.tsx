import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Plus } from 'lucide-react'
import { listTasks, createTask, setTaskStatus } from '@/lib/tasks'
import type { Task } from '@/lib/tasks'
import { listEventsInRange, expandRecurringEvents } from '@/lib/calendar'
import type { CalendarEvent } from '@/lib/calendar'
import { pacificDay, pacificInput, pacificTime } from '@/lib/time'
import { ModePicker } from '@/components/home/ModePicker'

export function TodayPage(){
  const [tasks,setTasks]=useState<Task[]>([]),[events,setEvents]=useState<CalendarEvent[]>([])
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[capture,setCapture]=useState(''),[busy,setBusy]=useState<string|null>(null)
  const today=pacificDay()
  const load=useCallback(async()=>{
    setLoading(true);setError('')
    try{
      const from=pacificInput(today),to=pacificInput(today)
      to.setDate(to.getDate()+1)
      const [t,e]=await Promise.all([listTasks(null),listEventsInRange(from,to)])
      setTasks(t);setEvents(expandRecurringEvents(e,from,to))
    }catch(e){setError(e instanceof Error?e.message:'Could not load today. Please try again.')}
    finally{setLoading(false)}
  },[today])
  useEffect(()=>{void load()},[load])
  const due=tasks.filter(t=>t.status==='open'&&t.due_at&&pacificDay(t.due_at)<=today)
  const unscheduled=tasks.filter(t=>t.status==='open'&&!t.due_at)
  async function add(e:React.FormEvent){
    e.preventDefault();if(!capture.trim()||busy)return;setBusy('capture');setError('')
    try{await createTask({title:capture.trim(),dueAt:pacificInput(today),allDay:true});setCapture('');await load()}
    catch(e){setError(e instanceof Error?e.message:'Could not save task')}finally{setBusy(null)}
  }
  async function complete(t:Task){
    if(busy)return;setBusy(t.id)
    try{await setTaskStatus(t.id,'done');await load()}catch(e){setError(e instanceof Error?e.message:'Could not complete task')}finally{setBusy(null)}
  }
  return <div className="space-y-6 page-enter">
    <header><p className="text-sm text-[var(--color-dim)]">{new Intl.DateTimeFormat('en-US',{timeZone:'America/Vancouver',weekday:'long',month:'long',day:'numeric'}).format(new Date())} · Pacific time</p><h1 className="text-3xl font-bold mt-1">today’s rhythm</h1></header>
    <ModePicker />
    <form onSubmit={add} className="surface-elevated p-3 flex gap-2"><label htmlFor="today-capture" className="sr-only">Add a task for today</label><input id="today-capture" className="field flex-1 min-w-0" value={capture} onChange={e=>setCapture(e.target.value)} placeholder="What do you want to do today?" maxLength={300}/><button className="px-4 rounded-xl bg-[var(--color-acc)] text-[var(--color-ink)] border-2 border-[var(--color-ink)] shadow-[4px_4px_0_var(--color-ink)]" disabled={!!busy||!capture.trim()} aria-label="Add task"><Plus size={20}/></button></form>
    {error&&<div role="alert" className="surface-elevated p-4"><p>{error}</p><button onClick={()=>void load()} className="text-[var(--color-acc)] mt-2">Try again</button></div>}
    {loading?<p role="status">Loading your day…</p>:<>
      <section className="surface-elevated p-5"><div className="flex justify-between items-center mb-4"><h2 className="font-bold flex gap-2"><CheckCircle2 size={20}/>tasks <span className="text-[var(--color-dim)]">{due.length}</span></h2><Link to="/tasks" className="text-sm text-[var(--color-acc)]">see all</Link></div>
      {!due.length?<p className="text-[var(--color-dim)]">Nothing due. Nice.</p>:<ul className="divide-y divide-[var(--color-line2)]">{due.map(t=><li key={t.id} className="flex gap-3 py-3"><button disabled={!!busy} onClick={()=>void complete(t)} aria-label={'Complete '+t.title} className="min-w-11 min-h-11 rounded-full border border-[var(--color-line2)]">✓</button><div className="flex-1"><Link to="/tasks" className="font-medium">{t.title}</Link><p className="text-xs text-[var(--color-dim)]">{t.due_at&&pacificDay(t.due_at)<today?'Overdue':t.all_day?'Today':pacificTime(t.due_at!)}</p></div></li>)}</ul>}
      {!!unscheduled.length&&<Link className="text-sm text-[var(--color-acc)] mt-4 block" to="/tasks">{unscheduled.length} waiting for a date →</Link>}</section>
      <section className="surface-elevated p-5"><div className="flex justify-between mb-4"><h2 className="font-bold flex gap-2"><CalendarDays size={20}/>calendar</h2><Link className="text-sm text-[var(--color-acc)]" to="/calendar">open</Link></div>{!events.length?<p className="text-[var(--color-dim)]">Clear day. Yours to shape.</p>:<ul className="space-y-3">{events.map(e=><li key={e.id}><Link to="/calendar" className="flex gap-4"><span className="text-sm text-[var(--color-acc)] w-20 shrink-0">{e.all_day?'All day':pacificTime(e.starts_at)}</span><span>{e.title}</span></Link></li>)}</ul>}</section>
    </>}
  </div>
}
