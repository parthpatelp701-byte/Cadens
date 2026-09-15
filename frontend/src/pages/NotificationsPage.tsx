import { useCallback, useEffect, useState } from 'react'
import type { Notification } from '@/types'
import {
  fetchNotifications,
  markNotificationsRead,
  loadLocalNotifications,
} from '@/lib/notifications'
import { Heart, MessageCircle, Users, Bell, CheckCheck } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ListSkeleton } from '@/components/ui/Skeleton'

const iconMap: Record<string, typeof Heart> = {
  like: Heart,
  comment: MessageCircle,
  group_invite: Users,
  group_approved: Users,
  mention: Bell,
  message: MessageCircle,
  system: Bell,
}

export function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [usingServer, setUsingServer] = useState(true)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const data = await fetchNotifications()
      setItems(data)
      setUsingServer(true)
    } catch {
      // Fallback to local until SQL migration is applied
      setItems(loadLocalNotifications())
      setUsingServer(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()

    // Realtime: refresh when new notifications arrive
    const channel = supabase
      .channel('cadens-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'daybook_notifications' },
        () => load()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  async function handleMarkAll() {
    try {
      if (usingServer) {
        await markNotificationsRead()
      }
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (err) {
      console.error(err)
    }
  }

  async function handleClick(n: Notification) {
    try {
      if (usingServer && !n.read) {
        await markNotificationsRead([n.id])
      }
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    } catch {}

    if (n.targetType === 'post') navigate('/')
    if (n.targetType === 'group') navigate('/groups')
    if (n.targetType === 'conversation') navigate('/messages')
    if (n.targetType === 'story') navigate('/')
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-[var(--color-dim)]">
            {usingServer ? 'Likes, comments, and group activity' : 'Local only — run the SQL migration for cross-device sync'}
          </p>
        </div>
        {items.some((n) => !n.read) && (
          <button
            onClick={handleMarkAll}
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-acc)]"
          >
            <CheckCheck size={16} />
            Mark all read
          </button>
        )}
      </header>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : items.length === 0 ? (
        <div className="py-20 text-center text-[var(--color-dim)]">
          <div className="text-4xl mb-3">🔔</div>
          <p className="font-medium">No notifications yet</p>
          <p className="text-sm mt-1">When people interact with your posts or groups, it will show up here.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((n) => {
            const Icon = iconMap[n.type] || Bell
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left flex gap-3 p-3.5 rounded-[14px] transition ${
                  n.read
                    ? 'bg-transparent hover:bg-[var(--color-s2)]'
                    : 'bg-[color-mix(in_srgb,var(--color-acc)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-acc)_16%,transparent)]'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    n.read ? 'bg-[var(--color-s3)] text-[var(--color-dim)]' : 'bg-[var(--color-acc)] text-[var(--color-ink)]'
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug">{n.title}</p>
                  {n.body && (
                    <p className="text-sm text-[var(--color-dim)] mt-0.5 line-clamp-2">{n.body}</p>
                  )}
                  <p className="text-[11px] text-[var(--color-mute)] mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!n.read && (
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-acc)] mt-2 shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
