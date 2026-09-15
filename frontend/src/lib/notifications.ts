import { supabase } from './supabase'
import type { Notification } from '@/types'

/** Fetch notifications from the server */
export async function fetchNotifications(limit = 50): Promise<Notification[]> {
  const { data, error } = await supabase.rpc('daybook_notifications_list', {
    limit_count: limit,
  })
  if (error) throw error
  return (data || []) as Notification[]
}

/** Mark specific notifications (or all) as read */
export async function markNotificationsRead(ids?: string[]) {
  const { error } = await supabase.rpc('daybook_notifications_mark_read', {
    notification_ids: ids ?? null,
  })
  if (error) throw error
}

/** Unread count from server */
export async function fetchUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('daybook_notifications_unread_count')
  if (error) throw error
  return (data as number) || 0
}

// ---- Local fallback (used before the SQL migration is applied) ----

const STORAGE_KEY = 'cadens-notifications'

export function loadLocalNotifications(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Notification[]
  } catch {
    return []
  }
}

export function saveLocalNotifications(list: Notification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 100)))
}

export function addLocalNotification(
  partial: Omit<Notification, 'id' | 'created_at' | 'read'>
) {
  const list = loadLocalNotifications()
  const item: Notification = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    read: false,
    ...partial,
  }
  const next = [item, ...list].slice(0, 100)
  saveLocalNotifications(next)
  return item
}
