import type { ConversationWithMembers, MessageWithSender } from '@comot/shared';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from './supabase';

const CONVERSATION_SELECT =
  'id, building_id, kind, name, created_by, created_at, ' +
  'members:conversation_members (user_id, profile:profiles (id, full_name))';

const MESSAGE_SELECT =
  'id, conversation_id, building_id, sender_id, body, created_at, sender:profiles (id, full_name)';

export async function fetchConversations(buildingId: string): Promise<ConversationWithMembers[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .eq('building_id', buildingId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ConversationWithMembers[];
}

export async function fetchConversation(conversationId: string): Promise<ConversationWithMembers | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as ConversationWithMembers | null;
}

export async function fetchMessages(conversationId: string, limit = 50): Promise<MessageWithSender[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as MessageWithSender[]).reverse();
}

export async function sendMessage(input: {
  conversationId: string;
  buildingId: string;
  body: string;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');
  const { error } = await supabase.from('messages').insert({
    conversation_id: input.conversationId,
    building_id: input.buildingId,
    sender_id: auth.user.id,
    body: input.body.trim(),
  });
  if (error) throw error;
}

export async function createChannel(buildingId: string, name: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');
  const { error } = await supabase.from('conversations').insert({
    building_id: buildingId,
    kind: 'channel',
    name: name.trim().toLowerCase().replace(/\s+/g, '-'),
    created_by: auth.user.id,
  });
  if (error) throw error;
}

export async function getOrCreateDm(buildingId: string, otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_dm', {
    p_building_id: buildingId,
    p_other_user: otherUserId,
  });
  if (error) throw error;
  return data as string;
}

/** Live INSERT feed for one conversation. Returns the channel; call `supabase.removeChannel` to stop. */
export function subscribeToMessages(
  conversationId: string,
  onInsert: (messageId: string) => void,
): RealtimeChannel {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onInsert((payload.new as { id: string }).id),
    )
    .subscribe();
}

export async function fetchMessageById(id: string): Promise<MessageWithSender | null> {
  const { data, error } = await supabase.from('messages').select(MESSAGE_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as unknown as MessageWithSender | null;
}
