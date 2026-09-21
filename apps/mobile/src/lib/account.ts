import { supabase } from './supabase';

export interface AccountDeletionPreview {
  /** Buildings that would be left with members but no committee. Blocks deletion. */
  blocking_buildings: { id: string; name: string }[];
  /** Buildings the caller is the last member of, deleted along with the account. */
  buildings_removed: { id: string; name: string }[];
  is_vendor: boolean;
}

export async function fetchAccountDeletionPreview(): Promise<AccountDeletionPreview> {
  const { data, error } = await supabase.rpc('account_deletion_preview');
  if (error) throw error;
  return data as AccountDeletionPreview;
}

/**
 * Deletes the signed-in account and everything that cascades from it.
 *
 * The local sign-out afterwards matters: deleting the row invalidates refresh
 * tokens, but an access token already issued stays valid until it expires, so
 * the client must drop it rather than keep using a session for a user that no
 * longer exists.
 */
export async function deleteOwnAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
  await supabase.auth.signOut();
}

/** True when deletion was refused because a building would lose its committee. */
export function isHandoverRequired(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return message.includes('committee_handover_required');
}
