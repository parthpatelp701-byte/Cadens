import { supabase } from './supabase'

export interface Conversation {
  id: string
  is_group: boolean
  title?: string | null
  updated_at: string
  last_message?: {
    body: string
    sender_id: string
    created_at: string
  } | null
  unread: number
  members?: { id: string; name: string }[]
}

export interface Message {
  id: string
  sender_id: string
  sender_name: string
  body: string
  created_at: string
}

export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase.rpc('daybook_conversations_list')
  if (error) throw error
  return (data || []) as Conversation[]
}

export async function startConversation(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('daybook_conversation_start', {
    other_user_id: otherUserId,
  })
  if (error) throw error
  return data as string
}

export async function listMessages(conversationId: string, limit = 50): Promise<Message[]> {
  const { data, error } = await supabase.rpc('daybook_messages_list', {
    p_conversation_id: conversationId,
    p_limit: limit,
  })
  if (error) throw error
  return (data || []) as Message[]
}

export async function sendMessage(conversationId: string, body: string) {
  const { data, error } = await supabase.rpc('daybook_message_send', {
    p_conversation_id: conversationId,
    p_body: body,
  })
  if (error) throw error
  return data
}

/** Start a group chat for an existing Cadens group (requires SQL 05-group-chats) */
export async function startGroupConversation(groupId: string): Promise<string> {
  const { data, error } = await supabase.rpc('daybook_group_conversation_start', {
    p_group_id: groupId,
  })
  if (error) throw error
  return data as string
}

/** Create a multi-person conversation with explicit member ids */
export async function createGroupConversation(
  title: string,
  memberIds: string[]
): Promise<string> {
  const { data, error } = await supabase.rpc('daybook_conversation_create_group', {
    p_title: title,
    p_member_ids: memberIds,
  })
  if (error) throw error
  return data as string
}
