import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckSquare, Plus, Loader2 } from 'lucide-react'
import { parseISO } from 'date-fns'
import { pacificDay, pacificInput, TIME_ZONE } from '@/lib/time'
import {
  listTasks,
  createTask,
  updateTask,
  setTaskStatus,
  deleteTask,
  type Task,
} from '@/lib/tasks'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { clsx } from 'clsx'
import { TaskCard } from '@/components/tasks/TaskCard'
import { Sheet, SheetActions } from '@/components/ui/Sheet'

export function TasksPage() {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  type FlowTab = 'now' | 'today' | 'planned' | 'done'
  const [filter, setFilter] = useState<FlowTab>('today')
  const [composer, setComposer] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingVersion, setEditingVersion] = useState('')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [busy, setBusy] = useState(false)
  const [metadata, setMetadata] = useState<Task['metadata']>({})
  const [subtasks, setSubtasks] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listTasks(null)
      const startToday = pacificInput(pacificDay())
      const endToday = pacificInput(pacificDay(), '23:59')
      endToday.setSeconds(59,999)
      const filtered = data.filter((t) => {
        if (filter === 'done') return t.status === 'done'
        if (t.status !== 'open') return false
        const due = t.due_at ? parseISO(t.due_at) : null
        if (filter === 'now') {
          if (!due) return true
          return due <= endToday
        }
        if (filter === 'today') {
          if (!due) return t.metadata.planned_date === pacificDay()
          return t.metadata.planned_date === pacificDay() || (due >= startToday && due <= endToday)
        }
        if (filter === 'planned') {
          if (!due) return true
          return due > endToday
        }
        return true
      })
      setTasks(filtered)
    } catch (e: any) {
      setError(e.message || 'Could not load tasks. Please retry.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditingId(null)
    setMetadata({category:'Personal',priority:'normal',repeat:''})
    setSubtasks('')
    setTitle('')
    setNotes('')
    setDueDate('')
    setDueTime('')
    setAllDay(false)
    setComposer(true)
  }

  function openEdit(task: Task) {
    setEditingId(task.id)
    setEditingVersion(task.updated_at)
    setMetadata({...task.metadata})
    setSubtasks((task.metadata.subs || []).map((s: {text:string})=>s.text).join('\n'))
    setTitle(task.title)
    setNotes(task.notes || '')
    if (task.due_at) {
      const d = parseISO(task.due_at)
      setDueDate(pacificDay(d))
      setDueTime(task.all_day ? '' : new Intl.DateTimeFormat('en-GB',{timeZone:TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d))
      setAllDay(task.all_day)
    } else {
      setDueDate('')
      setDueTime('')
      setAllDay(false)
    }
    setComposer(true)
  }

  async function handleCreate() {
    if (!title.trim() || busy) return
    setBusy(true)
    try {
      let dueAt: Date | null = null
      if (dueDate) {
        if (allDay || !dueTime) dueAt = pacificInput(dueDate)
        else dueAt = pacificInput(dueDate,dueTime)
      }
      const remaining = [...(metadata.subs || [])]
      const editedMetadata = {...metadata, subs:subtasks.split('\n').map(text=>text.trim()).filter(Boolean).map(text=>{const index=remaining.findIndex(s=>s.text===text); return index<0 ? {text,done:false} : remaining.splice(index,1)[0]})}
      const allDayVal = allDay || (!!dueDate && !dueTime)

      if (editingId) {
        const task = await updateTask(editingId, {
          expectedUpdatedAt:editingVersion,
          title: title.trim(),
          notes: notes.trim(),
          dueAt: dueDate ? dueAt : null,
          clearDue: !dueDate,
          allDay: allDayVal,
          metadata:editedMetadata,
        })
        setComposer(false)
        setEditingId(null)
        toast(
          task.calendar_event_id
            ? 'Task updated · Plan synced'
            : dueDate
              ? 'Task updated'
              : 'Task updated · removed from Plan',
          'success'
        )
      } else {
        const task = await createTask({
          title: title.trim(),
          notes: notes.trim() || undefined,
          dueAt,
          allDay: allDayVal,
          metadata:editedMetadata,
        })
        setComposer(false)
        toast(task.calendar_event_id ? 'Task saved · added to Plan' : 'Task saved', 'success')
      }
      setTitle('')
      setNotes('')
      setDueDate('')
      setDueTime('')
      setAllDay(false)
      await load()
    } catch (e: any) {
      toast(e.message || 'Could not save task', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function toggleDone(task: Task) {
    try {
      await setTaskStatus(task.id, task.status === 'done' ? 'done' : 'open')
      await load()
    } catch (e: any) {
      toast(e.message || 'Update failed', 'error')
      throw e
    }
  }

  async function remove(task: Task) {
    const msg = task.calendar_event_id
      ? 'Delete this task and its Plan event?'
      : 'Delete this task?'
    if (!confirm(msg)) return
    try {
      await deleteTask(task.id)
      toast(task.calendar_event_id ? 'Task and Plan event removed' : 'Task removed', 'info')
      await load()
    } catch (e: any) {
      toast(e.message || 'Delete failed', 'error')
    }
  }

  return (
    <div className="space-y-4 page-enter">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.65rem] font-bold tracking-tight flex items-center gap-2 text-balance">
            <CheckSquare size={24} className="text-[var(--color-acc)] shrink-0" aria-hidden />
            Tasks
          </h1>
          <p className="text-sm text-[var(--color-dim)] mt-1 text-pretty">
            Daily Flow · Pacific time ·{' '}
            <Link to="/calendar" className="text-[var(--color-acc)] font-semibold">
              Plan
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="shrink-0 inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] border-2 border-[var(--color-ink)] text-sm font-bold shadow-[4px_4px_0_var(--color-ink)]"
        >
          <Plus size={18} aria-hidden /> New
        </button>
      </header>

      <div
        className="flex gap-1 p-1 rounded-full bg-[var(--color-s2)] border border-[var(--color-line2)] w-fit"
        role="tablist"
        aria-label="Daily Flow"
      >
        {([['now','Now'],['today','Today'],['planned','Planned'],['done','Done']] as const).map(([f, label]) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-3.5 py-1.5 rounded-full text-xs font-bold min-h-9 transition-colors',
              filter === f
                ? 'bg-[var(--color-acc)] text-[var(--color-ink)]'
                : 'text-[var(--color-dim)] hover:text-[var(--color-txt)]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-[14px] border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--color-danger)]"
        >
          {error}
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={28} />}
          title={
            filter === 'done'
              ? 'No completed tasks'
              : filter === 'today'
                ? 'Nothing due today'
                : filter === 'planned'
                  ? 'Nothing planned ahead'
                  : 'Inbox is clear'
          }
          description={
            filter === 'done'
              ? 'Completed tasks will show up here.'
              : 'Add a task, due date and checklist to plan your day.'
          }
          action={
            filter !== 'done' ? (
              <button
                type="button"
                onClick={openCreate}
                className="min-h-11 px-5 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] text-sm font-bold"
              >
                New task
              </button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2.5" aria-label="Tasks">
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                onToggle={toggleDone}
                onEdit={openEdit}
                onDelete={remove}
                onSubtask={async(task,index)=>{
                  try {
                    await updateTask(task.id,{expectedUpdatedAt:task.updated_at,metadata:{subs:task.metadata.subs.map((s: {text:string;done:boolean},i:number)=>i===index ? {...s,done:!s.done} : s)}})
                    await load()
                  } catch(e:any) {toast(e.message || 'Could not update checklist','error')}
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {composer && (
        <Sheet
          open={composer}
          onClose={() => setComposer(false)}
          title={editingId ? 'Edit task' : 'New task'}
          titleId="task-composer-title"
        >
          <input
            aria-label="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            autoFocus
            className="field"
          />
          <textarea
            aria-label="Task notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="field !min-h-[4.5rem] resize-none py-3"
          />
          <div className="flex gap-2 flex-wrap">
            <input
              type="date"
              aria-label="Due date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="field flex-1 min-w-[140px]"
            />
            {!allDay && (
              <input
                type="time"
                aria-label="Due time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="field w-[7.5rem]"
              />
            )}
          </div>
          <label className="flex items-center gap-2.5 text-sm text-[var(--color-dim)] min-h-11">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="rounded border-[var(--color-line)]"
            />
            All day
          </label>
          {dueDate && (
            <p className="text-xs font-medium text-[var(--color-acc)]">
              Scheduled in Pacific time
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">Category<input className="field" value={metadata.category || ''} onChange={e=>setMetadata({...metadata,category:e.target.value})}/></label>
            <label className="text-sm">Priority<select className="field" value={metadata.priority || 'normal'} onChange={e=>setMetadata({...metadata,priority:e.target.value})}>{['low','normal','high','urgent'].map(v=><option key={v}>{v}</option>)}</select></label>
            <label className="text-sm">Repeat<select className="field" value={metadata.repeat || ''} onChange={e=>setMetadata({...metadata,repeat:e.target.value})}><option value="">Never</option>{['daily','weekdays','weekly'].map(v=><option key={v}>{v}</option>)}</select></label>
            <label className="text-sm">Estimate (minutes)<input type="number" min="1" max="1440" className="field" value={metadata.estimate || ''} onChange={e=>setMetadata({...metadata,estimate:e.target.value ? Number(e.target.value) : null})}/></label>
          </div>
          <label className="text-sm">Checklist (one per line)<textarea className="field" rows={3} value={subtasks} onChange={e=>setSubtasks(e.target.value)}/></label>
          <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={!!metadata.quick} onChange={e=>setMetadata({...metadata,quick:e.target.checked})}/>Two-minute task (2 points)</label>
          <SheetActions>
            <button
              type="button"
              onClick={() => setComposer(false)}
              className="flex-1 min-h-11 rounded-full border border-[var(--color-line)] text-sm font-bold text-[var(--color-dim)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!title.trim() || busy}
              onClick={handleCreate}
              className="flex-1 min-h-11 rounded-full bg-[var(--color-acc)] text-[var(--color-ink)] border-2 border-[var(--color-ink)] text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-[4px_4px_0_var(--color-ink)]"
            >
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
              {editingId ? 'Save changes' : 'Save task'}
            </button>
          </SheetActions>
        </Sheet>
      )}
    </div>
  )
}
