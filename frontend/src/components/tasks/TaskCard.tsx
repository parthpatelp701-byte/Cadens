import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Circle, CheckCircle2, Pencil, Trash2 } from 'lucide-react'
import { pacificDay, pacificTime } from '@/lib/time'
import { clsx } from 'clsx'
import type { Task } from '@/lib/tasks'

export interface TaskCardProps {
  task: Task
  onToggle: (task: Task) => void | Promise<void>
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onSubtask?: (task: Task, index: number) => Promise<void>
}

export function TaskCard({ task, onToggle, onEdit, onDelete, onSubtask }: TaskCardProps) {
  const [optimisticDone, setOptimisticDone] = useState(task.status === 'done')
  const [pop, setPop] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setOptimisticDone(task.status === 'done')
  }, [task.id, task.status])
  const due = task.due_at ? new Date(task.due_at) : null
  const statusDone = optimisticDone
  const overdue = !!(due && !statusDone && pacificDay(due) < pacificDay())

  async function handleToggle() {
    if (busy) return
    setBusy(true)
    const nextDone = !statusDone
    setOptimisticDone(nextDone)
    if (nextDone) {
      setPop(true)
      window.setTimeout(() => setPop(false), 400)
    }
    try {
      await onToggle({ ...task, status: nextDone ? 'done' : 'open' })
    } catch {
      setOptimisticDone(!nextDone)
    } finally { setBusy(false) }
  }

  return (
    <article
      className={clsx(
        'group surface-elevated p-3.5 flex items-start gap-2.5 transition-opacity',
        statusDone && 'opacity-75'
      )}
    >
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={busy}
        className={clsx(
          'mt-0.5 text-[var(--color-acc)] shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-xl hover:bg-[color-mix(in_srgb,var(--color-acc)_12%,transparent)]',
          pop && 'success-pop'
        )}
        aria-label={statusDone ? 'Mark open' : 'Mark done'}
      >
        {statusDone ? (
          <CheckCircle2 size={22} className="text-[var(--color-acc)]" />
        ) : (
          <Circle size={22} className="text-[var(--color-mute)]" />
        )}
      </button>
      <div className="flex-1 min-w-0 py-1">
        <button
          type="button"
          onClick={() => onEdit(task)}
          className="text-left w-full min-h-0 !min-w-0"
        >
          <div
            className={clsx(
              'font-semibold text-sm tracking-tight transition-all',
              statusDone && 'line-through text-[var(--color-mute)]'
            )}
          >
            {task.title}
          </div>
          {task.notes && (
            <p className="text-xs text-[var(--color-dim)] mt-0.5 line-clamp-2 text-pretty">
              {task.notes}
            </p>
          )}
        </button>
        <div className="text-xs text-[var(--color-dim)] mt-1">{task.metadata.category} · {task.metadata.priority || 'normal'}{task.metadata.repeat ? ` · ${task.metadata.repeat}` : ''}{task.metadata.estimate ? ` · ${task.metadata.estimate} min` : ''}</div>
        {onSubtask && Array.isArray(task.metadata.subs) && task.metadata.subs.length > 0 && <ul className="space-y-1 mt-2">{task.metadata.subs.map((sub: {text:string;done:boolean}, index:number)=><li key={index}><label className="flex items-center gap-2 text-sm min-h-9"><input type="checkbox" checked={!!sub.done} disabled={busy} onChange={async()=>{setBusy(true);try {await onSubtask(task,index)} finally {setBusy(false)}}}/><span className={sub.done ? 'line-through text-[var(--color-mute)]' : ''}>{sub.text}</span></label></li>)}</ul>}
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {due && (
            <span
              className={clsx(
                'inline-flex items-center gap-1 text-[11px] font-semibold',
                overdue ? 'text-[var(--color-danger)]' : 'text-[var(--color-mute)]'
              )}
            >
              <Calendar size={12} aria-hidden />
              {task.all_day ? pacificDay(due) : `${pacificDay(due)} · ${pacificTime(due)}`}
              {pacificDay(due) === pacificDay() && ' · Today'}
            </span>
          )}
          {task.calendar_event_id && (
            <Link
              to="/calendar"
              className="text-[11px] font-bold text-[var(--color-acc)] hover:underline"
            >
              On Plan
            </Link>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(task)}
          className="p-2.5 rounded-xl text-[var(--color-mute)] hover:bg-[var(--color-s2)] hover:text-[var(--color-txt)] min-h-11 min-w-11"
          aria-label="Edit task"
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(task)}
          className="p-2.5 rounded-xl text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] min-h-11 min-w-11 sm:opacity-70 sm:group-hover:opacity-100"
          aria-label="Delete task"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  )
}
