import { supabase } from '@/lib/supabase'
import { track } from '@/lib/analytics'
import type { ProgressPost } from '@/types'

export type { ProgressPost }

export type ProgressAudience = 'me' | 'group' | 'family'

export async function listProgressFeed(limit = 50): Promise<ProgressPost[]> {
  // Prefer RPC (handles group visibility); fallback to own posts only
  const { data, error } = await supabase.rpc('list_progress_feed', {
    limit_count: limit,
  })

  if (error) {
    console.warn('list_progress_feed RPC unavailable, falling back to own posts', error.message)
    const { data: own, error: ownErr } = await supabase
      .from('progress_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (ownErr) throw ownErr
    return own || []
  }

  return (data as ProgressPost[]) || []
}

export async function createProgressPost(input: {
  body: string
  audience?: ProgressAudience
  group_id?: string | null
  media_path?: string | null
}): Promise<ProgressPost> {
  const body = input.body.trim()
  if (!body) throw new Error('Write something first')

  // Try RPC first
  const { data, error } = await supabase.rpc('create_progress_post', {
    p_body: body,
    p_audience: input.audience || 'me',
    p_group_id: input.group_id || null,
    p_media_path: input.media_path || null,
  })

  if (!error && data) {
    track('progress_posted', { audience: input.audience || 'me' })
    return data as ProgressPost
  }

  // Direct insert fallback (RLS: author only)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const audience = input.audience || 'me'
  const { data: row, error: insertErr } = await supabase
    .from('progress_posts')
    .insert({
      author_id: user.id,
      body,
      audience,
      group_id: audience === 'me' ? null : input.group_id || null,
      media_path: input.media_path || null,
    })
    .select()
    .single()

  if (insertErr) throw insertErr
  track('progress_posted', { audience: audience })
  return row as ProgressPost
}

export async function deleteProgressPost(id: string): Promise<void> {
  const { error } = await supabase.from('progress_posts').delete().eq('id', id)
  if (error) throw error
}

export async function listProgressForGroup(groupId: string, limit = 30): Promise<ProgressPost[]> {
  const { data, error } = await supabase
    .from('progress_posts')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}
