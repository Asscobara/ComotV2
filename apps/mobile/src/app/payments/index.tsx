import type { Apartment } from '@comot/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Banner, Button, Card, EmptyState, Screen, SectionTitle, Tag } from '@/components/ui';
import { fetchApartments } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  buildFeeHistory,
  currentPeriod,
  feePeriodsForMember,
  fetchApartmentFeePayments,
  type FeePeriod,
} from '@/lib/budget';
import { useErrorAlert } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme';

function money(amount: number): string {
  return `₪${amount.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
}

/** 'YYYY-MM' rendered in the active language, e.g. "יולי 2026". */
function periodLabel(period: string, language: string): string {
  const [year, month] = period.split('-').map(Number);
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'he-IL', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

export default function PaymentsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const notifyError = useErrorAlert();
  const { membership } = useAuth();

  const building = membership?.building ?? null;
  const apartmentId = membership?.apartment_id ?? null;
  const isCommittee = membership?.role === 'committee';

  const [apartment, setApartment] = useState<Pick<Apartment, 'id' | 'number' | 'floor'> | null>(null);
  const [history, setHistory] = useState<FeePeriod[]>([]);

  const load = useCallback(async () => {
    if (!building || !apartmentId || !membership) return;
    try {
      const [apartments, payments] = await Promise.all([
        fetchApartments(building.id),
        fetchApartmentFeePayments(building.id, apartmentId),
      ]);
      setApartment(apartments.find((a) => a.id === apartmentId) ?? null);
      setHistory(
        buildFeeHistory(
          feePeriodsForMember(membership.created_at),
          payments,
          Number(building.fee_amount),
        ),
      );
    } catch (e) {
      notifyError(e);
    }
  }, [building, apartmentId, membership, notifyError]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!building) return null;

  // A member with no apartment cannot be billed, so there is nothing to show.
  if (!apartmentId) {
    return (
      <Screen>
        <EmptyState icon="💳" title={t('payments.noApartment')} body={t('payments.noApartmentBody')} />
      </Screen>
    );
  }

  const feeAmount = Number(building.fee_amount);
  const period = currentPeriod();
  const current = history.find((h) => h.period === period) ?? null;
  const outstanding = history.filter((h) => !h.paid);
  const outstandingTotal = outstanding.reduce((sum, h) => sum + h.amount, 0);

  const paidOnLabel = current?.paidAt
    ? new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-GB' : 'he-IL', {
        dateStyle: 'medium',
      }).format(new Date(current.paidAt))
    : null;

  return (
    <Screen>
      <Card>
        <Text style={styles.summaryLabel}>{t('payments.myFee')}</Text>
        <Text style={styles.amount}>{feeAmount > 0 ? money(feeAmount) : t('payments.noFee')}</Text>
        <Text style={styles.meta}>
          {t(`payments.freq_${building.fee_frequency}`)}
          {feeAmount > 0 ? ` · ${t('payments.dueDay', { day: building.fee_due_day })}` : ''}
        </Text>
        {apartment ? (
          <Text style={styles.meta}>{t('payments.apartment', { number: apartment.number })}</Text>
        ) : null}
      </Card>

      <View style={{ height: spacing.md }} />

      <Card>
        <View style={styles.row}>
          <Text style={styles.currentPeriod}>{periodLabel(period, i18n.language)}</Text>
          <Tag
            label={current?.paid ? t('payments.statusPaid') : t('payments.statusOutstanding')}
            tone={current?.paid ? 'success' : 'warning'}
          />
        </View>
        <Text style={styles.currentBody}>
          {!current?.paid
            ? t('payments.recordedByCommittee')
            : paidOnLabel
              ? t('payments.paidOn', { date: paidOnLabel })
              : t('payments.statusPaid')}
        </Text>
      </Card>

      {outstanding.length > 0 && feeAmount > 0 ? (
        <>
          <View style={{ height: spacing.md }} />
          <Banner
            tone="warning"
            text={t('payments.outstandingTotal', {
              count: outstanding.length,
              amount: money(outstandingTotal),
            })}
          />
        </>
      ) : null}

      <SectionTitle>{t('payments.history')}</SectionTitle>
      {history.length === 0 ? (
        <EmptyState icon="🧾" title={t('payments.historyEmpty')} />
      ) : (
        <Card>
          {history.map((entry, index) => (
            <View
              key={entry.period}
              style={[styles.historyRow, index > 0 ? styles.historyRowDivider : null]}
            >
              <View style={styles.historyMain}>
                <Text style={styles.historyPeriod}>{periodLabel(entry.period, i18n.language)}</Text>
                <Text style={styles.historyAmount}>{money(entry.amount)}</Text>
              </View>
              <Tag
                label={entry.paid ? t('payments.statusPaid') : t('payments.statusOutstanding')}
                tone={entry.paid ? 'success' : 'neutral'}
              />
            </View>
          ))}
        </Card>
      )}

      {isCommittee ? (
        <>
          <View style={{ height: spacing.lg }} />
          <Button
            title={t('payments.collectFees')}
            variant="soft"
            onPress={() => router.push('/budget/fees')}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryLabel: { ...typography.label, textAlign: 'left' },
  amount: { fontSize: 32, fontWeight: '900', color: colors.primary, marginTop: 4, textAlign: 'left' },
  meta: { ...typography.caption, marginTop: 4, textAlign: 'left' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  currentPeriod: { fontSize: 17, fontWeight: '800', color: colors.ink, textAlign: 'left' },
  currentBody: { ...typography.caption, marginTop: 6, textAlign: 'left' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 12,
  },
  historyRowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  historyMain: { gap: 2 },
  historyPeriod: { fontSize: 15, fontWeight: '700', color: colors.ink, textAlign: 'left' },
  historyAmount: { ...typography.caption, textAlign: 'left' },
});
