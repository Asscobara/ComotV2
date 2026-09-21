import type { FeePayment } from '@comot/shared';

/**
 * Pure fee-period arithmetic, deliberately free of any Supabase import so it can
 * be reasoned about and tested on its own.
 *
 * Periods are 'YYYY-MM' strings: fee_payments.period is constrained to that shape
 * by a check constraint, and run_fee_reminders() bills monthly, so a building's
 * fee_frequency is descriptive rather than a schedule to derive periods from.
 */

export interface FeePeriod {
  period: string;
  paid: boolean;
  /** What was actually paid, or the building's current fee when still outstanding. */
  amount: number;
  paidAt: string | null;
}

function toPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function currentPeriod(now = new Date()): string {
  return toPeriod(now);
}

export function shiftPeriod(period: string, months: number): string {
  const [year, month] = period.split('-').map(Number);
  // Day 1 avoids the month-end overflow that makes "one month before 31 March" wrong.
  return toPeriod(new Date(year, month - 1 + months, 1));
}

/**
 * Periods to show for one member, newest first, bounded by the month they joined.
 * Nobody owes fees for periods before they were part of the building, and showing
 * a week-old member a year of "unpaid" would be both alarming and wrong.
 */
export function feePeriodsForMember(joinedAt: string, months = 12, now = new Date()): string[] {
  const joined = joinedAt.slice(0, 7);
  const current = currentPeriod(now);
  const periods: string[] = [];
  for (let i = 0; i < months; i++) {
    const period = shiftPeriod(current, -i);
    // Lexicographic comparison is correct for zero-padded 'YYYY-MM'.
    if (period < joined) break;
    periods.push(period);
  }
  return periods;
}

export function buildFeeHistory(
  periods: string[],
  payments: Pick<FeePayment, 'period' | 'amount' | 'paid_at'>[],
  feeAmount: number,
): FeePeriod[] {
  const byPeriod = new Map(payments.map((p) => [p.period, p]));
  return periods.map((period) => {
    const payment = byPeriod.get(period);
    return {
      period,
      paid: Boolean(payment),
      amount: payment ? Number(payment.amount) : feeAmount,
      paidAt: payment?.paid_at ?? null,
    };
  });
}
