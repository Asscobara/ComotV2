import type { AppNotification } from '@comot/shared';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from './supabase';

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function markAllRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw error;
}

/** Live INSERT feed of the signed-in user's notifications. */
export function subscribeToNotifications(userId: string, onInsert: () => void): RealtimeChannel {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      () => onInsert(),
    )
    .subscribe();
}

export async function getOrCreateEventChannel(eventId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_event_channel', { p_event_id: eventId });
  if (error) throw error;
  return data as string;
}
