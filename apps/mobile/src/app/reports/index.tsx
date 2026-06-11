import type { BudgetEntry } from '@comot/shared';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Share, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, Screen, SectionTitle } from '@/components/ui';
import { fetchApartments } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { currentPeriod, fetchBudgetEntries, fetchFeePayments } from '@/lib/budget';
import { colors, spacing, typography } from '@/theme';

interface CategoryTotal {
  category: string;
  kind: 'income' | 'expense';
  total: number;
}

export default function ReportsScreen() {
  const { t, i18n } = useTranslation();
  const { membership } = useAuth();
  const building = membership?.building ?? null;

  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [feeStats, setFeeStats] = useState({ paid: 0, total: 0 });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!building) return;
        try {
          const [all, apartments, payments] = await Promise.all([
            fetchBudgetEntries(building.id, 1000),
            fetchApartments(building.id),
            fetchFeePayments(building.id, currentPeriod()),
          ]);
          if (active) {
            setEntries(all);
            setFeeStats({ paid: payments.length, total: apartments.length });
          }
        } catch {
          // empty state
        }
      })();
      return () => {
        active = false;
      };
    }, [building]),
  );

  const year = new Date().getFullYear();
  const yearEntries = entries.filter((e) => e.entry_date.startsWith(String(year)));

  const byCategory: CategoryTotal[] = Object.values(
    yearEntries.reduce<Record<string, CategoryTotal>>((acc, e) => {
      const key = e.category;
      acc[key] = acc[key] ?? { category: e.category, kind: e.kind, total: 0 };
      acc[key].total += Number(e.amount);
      return acc;
    }, {}),
  ).sort((a, b) => (a.kind === b.kind ? b.total - a.total : a.kind === 'income' ? -1 : 1));

  const money = (n: number) =>
    `₪${n.toLocaleString(i18n.language === 'he' ? 'he-IL' : 'en-GB', { maximumFractionDigits: 0 })}`;

  const exportCsv = async () => {
    const header = 'date,kind,category,title,amount';
    const rows = yearEntries.map(
      (e) => `${e.entry_date},${e.kind},${e.category},"${e.title.replace(/"/g, '""')}",${e.amount}`,
    );
    const csv = [header, ...rows].join('\n');
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(csv);
        window.alert(t('reports.exported'));
      } else {
        await Share.share({ message: csv });
      }
    } catch {
      Alert.alert(t('common.error'));
    }
  };

  const pct = feeStats.total > 0 ? Math.round((feeStats.paid / feeStats.total) * 100) : 0;

  return (
    <Screen>
      <SectionTitle>{t('reports.feeRate', { period: currentPeriod() })}</SectionTitle>
      <Card>
        <Text style={styles.feeValue}>
          {t('reports.feeRateValue', { paid: feeStats.paid, total: feeStats.total, pct })}
        </Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
      </Card>

      <SectionTitle>
        {t('reports.byCategory')} · {t('reports.thisYear', { year })}
      </SectionTitle>
      {byCategory.length === 0 ? (
        <EmptyState icon="📊" title={t('reports.noData')} />
      ) : (
        <Card>
          {byCategory.map((c) => (
            <View key={c.category} style={styles.catRow}>
              <Text style={styles.catName}>{t(`budget.cat_${c.category}`)}</Text>
              <Text style={[styles.catTotal, c.kind === 'income' ? styles.in : styles.out]}>
                {c.kind === 'income' ? '+' : '-'}
                {money(c.total)}
              </Text>
            </View>
          ))}
        </Card>
      )}

      <Button title={t('reports.exportCsv')} variant="soft" onPress={exportCsv} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  feeValue: { ...typography.body, fontWeight: '700', marginBottom: spacing.sm, textAlign: 'left' },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: colors.bgSoft, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5, backgroundColor: colors.success },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgSoft,
  },
  catName: { ...typography.body, fontSize: 15, textAlign: 'left' },
  catTotal: { fontWeight: '800', fontSize: 15 },
  in: { color: colors.success },
  out: { color: colors.danger },
});
