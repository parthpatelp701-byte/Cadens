export type Audience = 'private' | 'group' | 'family'

export interface Profile {
  displayName: string
  bio?: string
  avatarUrl?: string
}

export interface Group {
  id: string
  name: string
  kind: 'group' | 'family'
  code?: string
  ownerId: string
  status: 'pending' | 'active'
  members?: GroupMember[]
}

export interface GroupMember {
  id: string
  name: string
  status: 'pending' | 'active'
  role: 'Owner' | 'Member'
}

export interface Post {
  id: string
  _ownerId?: string
  _recordId?: string
  author: string
  avatar?: string
  text: string
  mood?: string
  privacy: 'me' | 'group' | 'circle' | 'private'
  likes: number
  liked: boolean
  comments: Comment[]
  created_at: string
  media?: string[]
}

export interface Comment {
  id: string
  userId: string
  by: string
  text: string
  created_at: string
}

export interface Notification {
  id: string
  type: 'like' | 'comment' | 'mention' | 'group_invite' | 'group_approved' | 'message' | 'system'
  title: string
  body?: string
  read: boolean
  created_at: string
  targetId?: string
  targetType?: 'post' | 'group' | 'conversation' | 'story'
}

export interface StoryItem {
  id: string
  media_type: 'image' | 'text'
  media_path?: string | null
  text_content?: string | null
  background?: string
  created_at: string
  expires_at: string
  viewed: boolean
}

export interface StoryAuthor {
  owner_id: string
  author: string
  latest: string
  is_me: boolean
  stories: StoryItem[]
}
