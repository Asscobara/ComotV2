import type { BudgetCategory, BudgetEntry, BudgetKind, FeePayment } from '@comot/shared';

import { supabase } from './supabase';

export async function fetchBudgetEntries(buildingId: string, limit = 100): Promise<BudgetEntry[]> {
  const { data, error } = await supabase
    .from('budget_entries')
    .select('*')
    .eq('building_id', buildingId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as BudgetEntry[];
}

export interface BudgetSummary {
  income: number;
  expenses: number;
  balance: number;
  monthIncome: number;
  monthExpenses: number;
}

export function summarize(entries: BudgetEntry[]): BudgetSummary {
  const thisMonth = new Date().toISOString().slice(0, 7);
  let income = 0;
  let expenses = 0;
  let monthIncome = 0;
  let monthExpenses = 0;
  for (const e of entries) {
    const amount = Number(e.amount);
    const inMonth = e.entry_date.startsWith(thisMonth);
    if (e.kind === 'income') {
      income += amount;
      if (inMonth) monthIncome += amount;
    } else {
      expenses += amount;
      if (inMonth) monthExpenses += amount;
    }
  }
  return { income, expenses, balance: income - expenses, monthIncome, monthExpenses };
}

export async function addBudgetEntry(input: {
  buildingId: string;
  kind: BudgetKind;
  category: BudgetCategory;
  title: string;
  amount: number;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not authenticated');
  const { error } = await supabase.from('budget_entries').insert({
    building_id: input.buildingId,
    kind: input.kind,
    category: input.category,
    title: input.title.trim(),
    amount: input.amount,
    created_by: auth.user.id,
  });
  if (error) throw error;
}


export async function fetchFeePayments(buildingId: string, period: string): Promise<FeePayment[]> {
  const { data, error } = await supabase
    .from('fee_payments')
    .select('*')
    .eq('building_id', buildingId)
    .eq('period', period);
  if (error) throw error;
  return (data ?? []) as FeePayment[];
}

export async function markFeePaid(buildingId: string, apartmentId: string, period: string): Promise<void> {
  const { error } = await supabase.rpc('mark_fee_paid', {
    p_building_id: buildingId,
    p_apartment_id: apartmentId,
    p_period: period,
    p_amount: null,
  });
  if (error) throw error;
}

/** Every recorded payment for one apartment, newest period first. */
export async function fetchApartmentFeePayments(
  buildingId: string,
  apartmentId: string,
): Promise<FeePayment[]> {
  const { data, error } = await supabase
    .from('fee_payments')
    .select('*')
    .eq('building_id', buildingId)
    .eq('apartment_id', apartmentId)
    .order('period', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FeePayment[];
}

export { buildFeeHistory, currentPeriod, feePeriodsForMember, type FeePeriod } from './fees';
