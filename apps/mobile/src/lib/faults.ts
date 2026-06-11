import type { FaultCategory, FaultStatus, FaultUpdateWithAuthor, FaultWithReporter } from '@comot/shared';

import { supabase } from './supabase';

const FAULT_SELECT =
  'id, building_id, reporter_id, category, title, description, location, photo_url, status, created_at, resolved_at, ' +
  'reporter:profiles (id, full_name)';

export async function fetchFaults(buildingId: string): Promise<FaultWithReporter[]> {
  const { data, error } = await supabase
    .from('faults')
    .select(FAULT_SELECT)
    .eq('building_id', buildingId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FaultWithReporter[];
}

export async function fetchFault(faultId: string): Promise<FaultWithReporter | null> {
  const { data, error } = await supabase.from('faults').select(FAULT_SELECT).eq('id', faultId).maybeSingle();
  if (error) throw error;
  return data as unknown as FaultWithReporter | null;
}

export async function reportFault(input: {
  buildingId: string;
  category: FaultCategory;
  title: string;
  description: string;
  location: string;
}): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');
  const { data, error } = await supabase
    .from('faults')
    .insert({
      building_id: input.buildingId,
      reporter_id: auth.user.id,
      category: input.category,
      title: input.title.trim(),
      description: input.description.trim() || null,
      location: input.location.trim() || null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function fetchFaultUpdates(faultId: string): Promise<FaultUpdateWithAuthor[]> {
  const { data, error } = await supabase
    .from('fault_updates')
    .select('id, fault_id, building_id, author_id, status, note, created_at, author:profiles (id, full_name)')
    .eq('fault_id', faultId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as FaultUpdateWithAuthor[];
}

/** Committee-only; records the change on the fault timeline. */
export async function updateFaultStatus(faultId: string, status: FaultStatus, note?: string): Promise<void> {
  const { error } = await supabase.rpc('update_fault_status', {
    p_fault_id: faultId,
    p_status: status,
    p_note: note?.trim() || null,
  });
  if (error) throw error;
}

export async function addFaultNote(faultId: string, buildingId: string, note: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');
  const { error } = await supabase.from('fault_updates').insert({
    fault_id: faultId,
    building_id: buildingId,
    author_id: auth.user.id,
    note: note.trim(),
  });
  if (error) throw error;
}
