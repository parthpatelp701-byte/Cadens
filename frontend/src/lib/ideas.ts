import { supabase } from './supabase'

export interface IdeaBoard {
  id: string
  group_id: string
  title: string
  status: 'open' | 'decided' | 'archived'
  decided_idea_id?: string | null
  created_by: string
  created_at: string
  updated_at: string
  idea_count?: number
}

export interface Idea {
  id: string
  board_id: string
  author_id: string
  author_name?: string
  body: string
  link_url?: string | null
  link_title?: string | null
  image_path?: string | null
  created_at: string
  reactions: number
  reacted: boolean
}

export async function listBoards(groupId: string): Promise<IdeaBoard[]> {
  const { data, error } = await supabase.rpc('cadens_idea_boards_list', {
    p_group_id: groupId,
  })
  if (error) throw error
  return (data || []) as IdeaBoard[]
}

export async function createBoard(groupId: string, title: string): Promise<IdeaBoard> {
  const { data, error } = await supabase.rpc('cadens_idea_board_create', {
    p_group_id: groupId,
    p_title: title,
  })
  if (error) throw error
  return data as IdeaBoard
}

export async function listIdeas(boardId: string, sort: 'new' | 'top' = 'new'): Promise<Idea[]> {
  const { data, error } = await supabase.rpc('cadens_ideas_list', {
    p_board_id: boardId,
    p_sort: sort,
  })
  if (error) throw error
  return (data || []) as Idea[]
}

export async function createIdea(
  boardId: string,
  body: string,
  linkUrl?: string,
  linkTitle?: string
): Promise<Idea> {
  const { data, error } = await supabase.rpc('cadens_idea_create', {
    p_board_id: boardId,
    p_body: body,
    p_link_url: linkUrl || null,
    p_link_title: linkTitle || null,
  })
  if (error) throw error
  return data as Idea
}

export async function reactIdea(ideaId: string) {
  const { error } = await supabase.rpc('cadens_idea_react', {
    p_idea_id: ideaId,
    p_kind: 'up',
  })
  if (error) throw error
}

export async function decideBoard(boardId: string, ideaId: string) {
  const { error } = await supabase.rpc('cadens_idea_board_decide', {
    p_board_id: boardId,
    p_idea_id: ideaId,
  })
  if (error) throw error
}
