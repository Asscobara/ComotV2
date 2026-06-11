import type { FaultBooking, Vendor, VendorCategory, VendorMatch } from '@comot/shared';

import { supabase } from './supabase';

export async function fetchMyVendorProfile(): Promise<Vendor | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data as Vendor | null;
}

export async function registerVendor(input: {
  businessName: string;
  categories: VendorCategory[];
  city: string;
  phone: string;
  about: string;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');
  const { error } = await supabase.from('vendors').insert({
    user_id: auth.user.id,
    business_name: input.businessName.trim(),
    categories: input.categories,
    city: input.city.trim(),
    phone: input.phone.trim() || null,
    about: input.about.trim() || null,
  });
  if (error) throw error;
}

export async function fetchMyBookings(vendorId: string): Promise<FaultBooking[]> {
  const { data, error } = await supabase
    .from('fault_bookings')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FaultBooking[];
}

export async function respondBooking(bookingId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_booking', {
    p_booking_id: bookingId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function matchVendors(faultId: string): Promise<VendorMatch[]> {
  const { data, error } = await supabase.rpc('match_vendors', { p_fault_id: faultId });
  if (error) throw error;
  return (data ?? []) as VendorMatch[];
}

export async function bookVendor(faultId: string, vendorId: string): Promise<void> {
  const { error } = await supabase.rpc('book_vendor', { p_fault_id: faultId, p_vendor_id: vendorId });
  if (error) throw error;
}

export async function fetchBookingForFault(faultId: string): Promise<(FaultBooking & { vendor: Pick<Vendor, 'business_name' | 'phone' | 'city'> | null }) | null> {
  const { data, error } = await supabase
    .from('fault_bookings')
    .select('*, vendor:vendors (business_name, phone, city)')
    .eq('fault_id', faultId)
    .in('status', ['booked', 'accepted'])
    .maybeSingle();
  if (error) throw error;
  return data as (FaultBooking & { vendor: Pick<Vendor, 'business_name' | 'phone' | 'city'> | null }) | null;
}
