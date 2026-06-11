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

// ---------- Events & Polls (Phase 3) ----------

export type EventKind = 'meeting' | 'maintenance' | 'payment' | 'other';
export type EventRecurrence = 'none' | 'weekly' | 'monthly' | 'yearly';

export interface BuildingEvent {
  id: string;
  building_id: string;
  kind: EventKind;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  recurrence: EventRecurrence;
  created_by: string | null;
  created_at: string;
}

export interface Poll {
  id: string;
  building_id: string;
  event_id: string | null;
  question: string;
  is_anonymous: boolean;
  status: 'open' | 'closed';
  closes_at: string | null;
  created_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  label: string;
  position: number;
}

export interface PollWithOptions extends Poll {
  options: PollOption[];
}

/** Payload returned by the `poll_results` RPC. */
export interface PollResults {
  poll_id: string;
  status: 'open' | 'closed';
  total_votes: number;
  my_vote: string | null;
  options: { id: string; label: string; votes: number }[];
}

export const EVENT_KINDS: EventKind[] = ['meeting', 'maintenance', 'payment', 'other'];
export const EVENT_RECURRENCES: EventRecurrence[] = ['none', 'weekly', 'monthly', 'yearly'];

// ---------- Budget (Phase 3) ----------

export type BudgetKind = 'income' | 'expense';

export const INCOME_CATEGORIES = ['fee', 'special_collection', 'other_income'] as const;
export const EXPENSE_CATEGORIES = [
  'gardening',
  'electricity',
  'cleaning',
  'elevator',
  'maintenance',
  'repair',
  'other_expense',
] as const;
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type BudgetCategory = IncomeCategory | ExpenseCategory;

export interface BudgetEntry {
  id: string;
  building_id: string;
  kind: BudgetKind;
  category: BudgetCategory;
  title: string;
  amount: number;
  entry_date: string;
  fault_id: string | null;
  created_at: string;
}

export interface FeePayment {
  id: string;
  building_id: string;
  apartment_id: string;
  period: string; // 'YYYY-MM'
  amount: number;
  paid_at: string;
}
