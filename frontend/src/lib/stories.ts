import { supabase } from './supabase'
import type { StoryAuthor } from '@/types'

export async function fetchStories(): Promise<StoryAuthor[]> {
  const { data, error } = await supabase.rpc('daybook_stories_feed')
  if (error) throw error
  return (data || []) as StoryAuthor[]
}

export async function createTextStory(
  text: string,
  background = '#8B5CF6',
  audience: 'group' | 'family' | 'private' = 'group',
  groupId?: string
) {
  const { data, error } = await supabase.rpc('daybook_story_create', {
    p_media_type: 'text',
    p_text_content: text,
    p_background: background,
    p_audience: audience,
    p_group_id: groupId || null,
  })
  if (error) throw error
  return data
}

export async function createImageStory(
  file: File,
  audience: 'group' | 'family' | 'private' = 'group',
  groupId?: string
) {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id
  if (!userId) throw new Error('Not signed in')

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Only JPEG, PNG, or WebP images are supported')
  }
  if (file.size > 1.2 * 1024 * 1024) {
    throw new Error('Image must be smaller than 1.2 MB')
  }

  const path = `${userId}/stories/${crypto.randomUUID()}`
  const { error: uploadError } = await supabase.storage
    .from('cadens-photos')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) throw uploadError

  const { data, error } = await supabase.rpc('daybook_story_create', {
    p_media_type: 'image',
    p_media_path: path,
    p_audience: audience,
    p_group_id: groupId || null,
  })
  if (error) throw error
  return data
}

export async function getStoryImageUrl(path: string) {
  const { data, error } = await supabase.storage.from('cadens-photos').createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function markStoryViewed(storyId: string) {
  const { error } = await supabase.rpc('daybook_story_view', { p_story_id: storyId })
  if (error) throw error
}
