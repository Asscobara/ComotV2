import type {
  Building,
  BuildingPreview,
  CommitteeHandover,
  FeeFrequency,
  MemberWithProfile,
  Membership,
  MembershipRole,
  Profile,
  TenantType,
} from '@comot/shared';

import { supabase } from './supabase';

const MEMBER_SELECT =
  'id, building_id, user_id, apartment_id, role, tenant_type, status, created_at, ' +
  'profile:profiles (id, full_name, phone, email, avatar_url), ' +
  'apartment:apartments (id, number, floor)';

export async function fetchMyProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', auth.user.id).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function fetchMyMembership(): Promise<(Membership & { building: Building | null }) | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from('memberships')
    .select('*, building:buildings (*)')
    .eq('user_id', auth.user.id)
    .in('status', ['pending', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as (Membership & { building: Building | null }) | null;
}

export async function createBuilding(input: {
  name: string;
  address: string;
  city: string;
  floors: number;
  apartmentsCount: number;
  feeAmount: number;
  feeDueDay: number;
  feeFrequency: FeeFrequency;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_building', {
    p_name: input.name,
    p_address: input.address,
    p_city: input.city,
    p_floors: input.floors,
    p_apartments_count: input.apartmentsCount,
    p_fee_amount: input.feeAmount,
    p_fee_due_day: input.feeDueDay,
    p_fee_frequency: input.feeFrequency,
  });
  if (error) throw error;
  return data as string;
}

export async function getBuildingByInviteCode(code: string): Promise<BuildingPreview | null> {
  const { data, error } = await supabase.rpc('get_building_by_invite_code', { p_code: code });
  if (error) throw error;
  return (data as BuildingPreview | null) ?? null;
}

export async function joinBuilding(input: {
  inviteCode: string;
  apartmentId: string | null;
  tenantType: TenantType;
}): Promise<void> {
  const { error } = await supabase.rpc('join_building', {
    p_invite_code: input.inviteCode,
    p_apartment_id: input.apartmentId,
    p_tenant_type: input.tenantType,
  });
  if (error) throw error;
}

export async function fetchMembers(buildingId: string): Promise<MemberWithProfile[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select(MEMBER_SELECT)
    .eq('building_id', buildingId)
    .in('status', ['pending', 'active'])
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as MemberWithProfile[];
}

export async function fetchMember(membershipId: string): Promise<MemberWithProfile | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select(MEMBER_SELECT)
    .eq('id', membershipId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as MemberWithProfile | null;
}

export async function approveMember(membershipId: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc('approve_member', {
    p_membership_id: membershipId,
    p_approve: approve,
  });
  if (error) throw error;
}

export async function updateMember(
  membershipId: string,
  patch: Partial<{ apartment_id: string | null; tenant_type: TenantType; role: MembershipRole }>,
): Promise<void> {
  const { error } = await supabase.from('memberships').update(patch).eq('id', membershipId);
  if (error) throw error;
}

export async function removeMember(membershipId: string): Promise<void> {
  const { error } = await supabase.from('memberships').update({ status: 'removed' }).eq('id', membershipId);
  if (error) throw error;
}

export async function fetchApartments(buildingId: string) {
  const { data, error } = await supabase
    .from('apartments')
    .select('id, number, floor')
    .eq('building_id', buildingId)
    .order('floor')
    .order('number');
  if (error) throw error;
  return data ?? [];
}

export async function updateProfile(patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'preferred_language'>>) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');
  const { error } = await supabase.from('profiles').update(patch).eq('id', auth.user.id);
  if (error) throw error;
}

export async function fetchPendingHandoverForMe(): Promise<CommitteeHandover | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from('committee_handovers')
    .select('*')
    .eq('to_user_id', auth.user.id)
    .eq('status', 'pending')
    .maybeSingle();
  if (error) throw error;
  return data as CommitteeHandover | null;
}

export async function requestHandover(buildingId: string, toUserId: string): Promise<void> {
  const { error } = await supabase.rpc('request_handover', {
    p_building_id: buildingId,
    p_to_user: toUserId,
  });
  if (error) throw error;
}

export async function respondHandover(handoverId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_handover', {
    p_handover_id: handoverId,
    p_accept: accept,
  });
  if (error) throw error;
}
