import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Subscribe to changes relevant to the social feed.
 * When any post, reaction, or comment changes, call onUpdate.
 */
export function useRealtimeFeed(onUpdate: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('cadens-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daybook_records', filter: 'collection=eq.posts' },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daybook_reactions' },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daybook_comments' },
        () => onUpdate()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [onUpdate])
}
