import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { createCalendar, type Calendar } from '@/lib/calendar'

export function CalendarCreate({ onCreated }: { onCreated: () => Promise<void> }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false), [name, setName] = useState(''), [scope, setScope] = useState('personal')
  const [groups, setGroups] = useState<{id:string;name:string;ownerId:string;status:string}[]>([])
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    if (open) void supabase.rpc('daybook_groups').then(({data,error}) => {
      if (!active) return
      if (error) setError('Could not load your groups. Close and reopen to retry.')
      else setGroups((data || []).filter((g:{ownerId:string;status:string}) => g.ownerId === user?.id && g.status === 'active'))
    })
    return () => { active = false }
  }, [open, user?.id])
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy || !name.trim()) return
    setBusy(true);setError('')
    try {
      const groupId = scope.startsWith('group:') ? scope.slice(6) : undefined
      await createCalendar(name.trim(), '#22C55E', groupId ? 'group' : scope as Calendar['kind'], groupId)
      setName('');setOpen(false);await onCreated()
    } catch(e) { setError(e instanceof Error ? e.message : 'Could not create calendar') }
    finally { setBusy(false) }
  }
  return <div className="surface-elevated p-3 space-y-2">
    <button onClick={() => {setOpen(!open);setError('')}} className="text-sm font-semibold text-[var(--color-acc)]">{open ? 'Close calendar setup' : '+ Create calendar'}</button>
    {open && <form onSubmit={submit} className="space-y-2">
      <label className="text-xs block">Name<input className="field mt-1" value={name} onChange={e=>setName(e.target.value)} required maxLength={100}/></label>
      <label className="text-xs block">Who can use it?<select className="field mt-1" value={scope} onChange={e=>setScope(e.target.value)}>
        <option value="personal">Only me · Personal</option><option value="work">Only me · Work</option><option value="focus">Only me · Focus</option>
        {groups.map(g=><option key={g.id} value={'group:'+g.id}>{g.name} · Approved members</option>)}
      </select></label>
      <p className="text-xs text-[var(--color-dim)]">{scope.startsWith('group:') ? 'All approved members can add, edit, and delete events. Only you manage the calendar.' : 'This calendar and its events are private to you.'}</p>
      <button className="text-sm font-bold" disabled={busy || !name.trim()}>{busy?'Creating…':'Create calendar'}</button>
    </form>}
    {error && <p role="alert" className="text-xs text-[var(--color-danger)]">{error}</p>}
  </div>
}
