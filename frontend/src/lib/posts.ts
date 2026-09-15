import { mutateLegacyBook } from './legacyRecords'
import { supabase } from './supabase'
import type { Post } from '@/types'
import { addLocalNotification } from './notifications'
import { compressImages } from './image'
import { notifyMentions } from './mentions'

const MAX_IMAGES = 4

/** Create a text and/or multi-image post via daybook_sync */
export async function createPost(
  text: string,
  options: {
    mood?: string
    privacy?: 'private' | 'group' | 'circle'
    groupId?: string | null
    imageFile?: File | null
    imageFiles?: File[]
  } = {}
) {
  if (options.privacy === 'group' && !options.groupId) throw new Error('Choose an approved group')
  const {
    mood = '😊',
    privacy = 'private',
    groupId = null,
    imageFile = null,
    imageFiles = [],
  } = options

  const id = crypto.randomUUID()

  const files: File[] = []
  if (imageFiles.length) files.push(...imageFiles.slice(0, MAX_IMAGES))
  else if (imageFile) files.push(imageFile)

  let photo_path: string | undefined
  let photo_paths: string[] | undefined

  if (files.length > 0) {
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id
    if (!userId) throw new Error('Not signed in')

    // Compress before upload
    const compressed = await compressImages(files)

    const paths: string[] = []
    for (const f of compressed) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        throw new Error('Only JPEG, PNG, or WebP images are supported')
      }
      if (f.size > 1.2 * 1024 * 1024) {
        throw new Error('Image must be smaller than 1.2 MB after compression')
      }
      const path = `${userId}/posts/${crypto.randomUUID()}`
      const { error: uploadError } = await supabase.storage
        .from('cadens-photos')
        .upload(path, f, { contentType: f.type, upsert: false })
      if (uploadError) throw uploadError
      paths.push(path)
    }

    photo_path = paths[0]
    if (paths.length > 1) photo_paths = paths
  }

  const payload: Record<string, unknown> = {
    id,
    text: text.trim(),
    mood,
    privacy: privacy === 'circle' ? 'circle' : privacy === 'group' ? 'group' : 'private',
    created_at: new Date().toISOString(),
  }
  if (photo_path) payload.photo_path = photo_path
  if (photo_paths) {
    payload.photo_paths = photo_paths
    payload.media = photo_paths
  }
  if (privacy === 'group' && groupId) payload.groupId = groupId

  await mutateLegacyBook(() => ({ changes: [{collection: 'posts', id, payload}] }))

  // Mentions in post body
  if (text.includes('@')) {
    const { data: sessionData } = await supabase.auth.getSession()
    const authorName =
      sessionData.session?.user?.email?.split('@')[0] || 'Someone'
    await notifyMentions({
      text: text.trim(),
      targetId: id,
      targetType: 'post',
      authorName,
    })
  }

  return { id }
}

export async function getPostImageUrl(path: string) {
  const { data, error } = await supabase.storage.from('cadens-photos').createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

/** Resolve all image paths on a post (single or multi) */
export function getPostMediaPaths(post: Post & { photo_path?: string; photo_paths?: string[] }) {
  if (post.photo_paths?.length) return post.photo_paths
  if (post.media?.length) return post.media
  if (post.photo_path) return [post.photo_path]
  return []
}

export async function toggleLike(post: Post) {
  const { error } = await supabase.rpc('daybook_social_action', {
    action: post.liked ? 'unlike' : 'like',
    post_owner: post._ownerId,
    post_id: post._recordId || post.id,
    body: '',
  })
  if (error) throw error
}

export async function addComment(post: Post, body: string) {
  const { error } = await supabase.rpc('daybook_social_action', {
    action: 'comment',
    post_owner: post._ownerId,
    post_id: post._recordId || post.id,
    body: body.trim(),
  })
  if (error) throw error

  addLocalNotification({
    type: 'comment',
    title: 'New comment on your post',
    body: body.trim().slice(0, 120),
    targetId: post.id,
    targetType: 'post',
  })

  if (body.includes('@')) {
    const { data: sessionData } = await supabase.auth.getSession()
    const authorName =
      sessionData.session?.user?.email?.split('@')[0] || 'Someone'
    await notifyMentions({
      text: body.trim(),
      targetId: post.id,
      targetType: 'comment',
      authorName,
    })
  }
}

/** Delete own post via daybook_sync (tombstone / remove from collection) */
export async function deletePost(post: Post) {
 const id=post._recordId||post.id;
 await mutateLegacyBook(book=>{if(!book.records.some(r=>r.collection==='posts'&&r.id===id))throw new Error('Post no longer exists');return {changes:[{collection:'posts',id,deleted:true}]}})
}
export async function updatePostText(post:Post,text:string) {
 const id=post._recordId||post.id;
 await mutateLegacyBook(book=>{const record=book.records.find(r=>r.collection==='posts'&&r.id===id);if(!record)throw new Error('Post no longer exists');if(record.payload.text!==post.text)throw new Error('This post changed. Reload before editing.');return {changes:[{...record,payload:{...record.payload,text:text.trim()}}]}})
}
