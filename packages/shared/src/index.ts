// ComOt shared domain model — mirrors supabase/migrations schema.

export type MembershipRole = 'committee' | 'tenant';
export type TenantType = 'owner' | 'renter';
export type MembershipStatus = 'pending' | 'active' | 'rejected' | 'removed';
export type FeeFrequency = 'monthly' | 'bimonthly' | 'quarterly' | 'yearly';
export type HandoverStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  preferred_language: 'he' | 'en';
}

export interface Building {
  id: string;
  name: string;
  address: string;
  city: string;
  floors: number;
  apartments_count: number;
  notes: string | null;
  invite_code: string;
  fee_amount: number;
  fee_due_day: number;
  fee_frequency: FeeFrequency;
}

export interface Apartment {
  id: string;
  building_id: string;
  number: string;
  floor: number;
}

export interface Membership {
  id: string;
  building_id: string;
  user_id: string;
  apartment_id: string | null;
  role: MembershipRole;
  tenant_type: TenantType;
  status: MembershipStatus;
  created_at: string;
}

/** Membership row joined with related profile/apartment, as queried by the app. */
export interface MemberWithProfile extends Membership {
  profile: Pick<Profile, 'id' | 'full_name' | 'phone' | 'email' | 'avatar_url'> | null;
  apartment: Pick<Apartment, 'id' | 'number' | 'floor'> | null;
}

export interface CommitteeHandover {
  id: string;
  building_id: string;
  from_user_id: string;
  to_user_id: string;
  status: HandoverStatus;
  created_at: string;
}

/** Payload returned by the `get_building_by_invite_code` RPC. */
export interface BuildingPreview {
  building: Pick<Building, 'id' | 'name' | 'address' | 'city' | 'floors' | 'apartments_count'>;
  apartments: Pick<Apartment, 'id' | 'number' | 'floor'>[];
}

export const FEE_FREQUENCIES: FeeFrequency[] = ['monthly', 'bimonthly', 'quarterly', 'yearly'];

export const VENDOR_CATEGORIES = [
  'plumbing',
  'electricity',
  'gardening',
  'elevator',
  'cleaning',
  'roofing',
  'general',
] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

// ---------- Chat (Phase 2) ----------

export type ConversationKind = 'channel' | 'dm';

export interface Conversation {
  id: string;
  building_id: string;
  kind: ConversationKind;
  name: string | null;
  created_by: string | null;
  created_at: string;
}

/** Conversation row joined with DM participants, as queried by the app. */
export interface ConversationWithMembers extends Conversation {
  members: { user_id: string; profile: Pick<Profile, 'id' | 'full_name'> | null }[];
}

export interface Message {
  id: string;
  conversation_id: string;
  building_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface MessageWithSender extends Message {
  sender: Pick<Profile, 'id' | 'full_name'> | null;
}

// ---------- Faults (Phase 2) ----------

export type FaultStatus = 'reported' | 'in_progress' | 'resolved' | 'closed';
export type FaultCategory = VendorCategory;

export interface Fault {
  id: string;
  building_id: string;
  reporter_id: string;
  category: FaultCategory;
  title: string;
  description: string | null;
  location: string | null;
  photo_url: string | null;
  status: FaultStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface FaultWithReporter extends Fault {
  reporter: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface FaultUpdate {
  id: string;
  fault_id: string;
  building_id: string;
  author_id: string;
  status: FaultStatus | null;
  note: string | null;
  created_at: string;
}

export interface FaultUpdateWithAuthor extends FaultUpdate {
  author: Pick<Profile, 'id' | 'full_name'> | null;
}

export const FAULT_STATUSES: FaultStatus[] = ['reported', 'in_progress', 'resolved', 'closed'];
