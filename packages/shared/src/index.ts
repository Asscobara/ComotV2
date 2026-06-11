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
