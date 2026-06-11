import type { BuildingEvent, EventKind, EventRecurrence, PollResults, PollWithOptions } from '@comot/shared';

import { supabase } from './supabase';

// ---------- Events ----------

export async function fetchEvents(buildingId: string): Promise<BuildingEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('building_id', buildingId)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as BuildingEvent[];
}

export async function fetchEvent(eventId: string): Promise<BuildingEvent | null> {
  const { data, error } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw error;
  return data as BuildingEvent | null;
}

export async function createEvent(input: {
  buildingId: string;
  kind: EventKind;
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  recurrence: EventRecurrence;
}): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');
  const { data, error } = await supabase
    .from('events')
    .insert({
      building_id: input.buildingId,
      kind: input.kind,
      title: input.title.trim(),
      description: input.description.trim() || null,
      location: input.location.trim() || null,
      starts_at: input.startsAt.toISOString(),
      recurrence: input.recurrence,
      created_by: auth.user.id,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) throw error;
}

// ---------- Polls ----------

const POLL_SELECT = '*, options:poll_options (id, poll_id, label, position)';

export async function fetchPolls(buildingId: string): Promise<PollWithOptions[]> {
  const { data, error } = await supabase
    .from('polls')
    .select(POLL_SELECT)
    .eq('building_id', buildingId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PollWithOptions[];
}

export async function fetchPollsForEvent(eventId: string): Promise<PollWithOptions[]> {
  const { data, error } = await supabase
    .from('polls')
    .select(POLL_SELECT)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PollWithOptions[];
}

export async function createPoll(input: {
  buildingId: string;
  question: string;
  options: string[];
  eventId?: string | null;
  isAnonymous?: boolean;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_poll', {
    p_building_id: input.buildingId,
    p_question: input.question.trim(),
    p_options: input.options.map((o) => o.trim()).filter(Boolean),
    p_event_id: input.eventId ?? null,
    p_is_anonymous: input.isAnonymous ?? true,
    p_closes_at: null,
  });
  if (error) throw error;
  return data as string;
}

export async function vote(pollId: string, optionId: string): Promise<void> {
  const { error } = await supabase.rpc('vote', { p_poll_id: pollId, p_option_id: optionId });
  if (error) throw error;
}

export async function closePoll(pollId: string): Promise<void> {
  const { error } = await supabase.rpc('close_poll', { p_poll_id: pollId });
  if (error) throw error;
}

export async function fetchPollResults(pollId: string): Promise<PollResults> {
  const { data, error } = await supabase.rpc('poll_results', { p_poll_id: pollId });
  if (error) throw error;
  return data as PollResults;
}
