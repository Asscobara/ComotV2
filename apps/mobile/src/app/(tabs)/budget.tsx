import type { BudgetEntry } from '@comot/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Banner, Button, Card, EmptyState, Screen, SectionTitle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { fetchBudgetEntries, summarize, type BudgetSummary } from '@/lib/budget';
import { colors, radius, spacing, typography } from '@/theme';

const CATEGORY_GLYPHS: Record<string, string> = {
  fee: '🏠',
  special_collection: '🤝',
  other_income: '💵',
  gardening: '🌿',
  electricity: '⚡',
  cleaning: '🧹',
  elevator: '🛗',
  maintenance: '🔧',
  repair: '🛠️',
  other_expense: '📎',
};

export default function BudgetScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { membership } = useAuth();
  const isCommittee = membership?.role === 'committee';

  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [summary, setSummary] = useState<BudgetSummary>({
    income: 0,
    expenses: 0,
    balance: 0,
    monthIncome: 0,
    monthExpenses: 0,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!membership?.building) return;
        try {
          const data = await fetchBudgetEntries(membership.building.id);
          if (active) {
            setEntries(data);
            setSummary(summarize(data));
          }
        } catch {
          // empty state shown
        }
      })();
      return () => {
        active = false;
      };
    }, [membership]),
  );

  const money = (n: number) =>
    `₪${n.toLocaleString(i18n.language === 'he' ? 'he-IL' : 'en-GB', { maximumFractionDigits: 0 })}`;

  return (
    <Screen>
      <Text style={styles.title}>{t('budget.title')}</Text>

      {summary.balance < 0 ? (
        <Banner tone="warning" text={`${t('budget.deficit')} ${t('budget.deficitBody')}`} />
      ) : null}

      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t('budget.balance')}</Text>
        <Text style={styles.balanceValue}>{money(summary.balance)}</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>
              {t('budget.income')} · {t('budget.thisMonth')}
            </Text>
            <Text style={styles.statValue}>{money(summary.monthIncome)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>
              {t('budget.expenses')} · {t('budget.thisMonth')}
            </Text>
            <Text style={styles.statValue}>{money(summary.monthExpenses)}</Text>
          </View>
        </View>
      </Card>

      {isCommittee ? (
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button title={t('budget.addEntry')} onPress={() => router.push('/budget/new-entry')} />
          </View>
          <View style={styles.flex}>
            <Button title={t('budget.fees')} variant="soft" onPress={() => router.push('/budget/fees')} />
          </View>
        </View>
      ) : null}

      <SectionTitle>{t('budget.recent')}</SectionTitle>
      {entries.length === 0 ? (
        <EmptyState icon="💰" title={t('budget.empty')} />
      ) : (
        entries.map((e) => (
          <Card key={e.id} style={styles.row}>
            <View style={styles.glyphWrap}>
              <Text style={styles.glyph}>{CATEGORY_GLYPHS[e.category] ?? '📎'}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.entryTitle}>{e.title}</Text>
              <Text style={styles.meta}>
                {t(`budget.cat_${e.category}`)} · {e.entry_date}
              </Text>
            </View>
            <Text style={[styles.amount, e.kind === 'income' ? styles.amountIn : styles.amountOut]}>
              {e.kind === 'income' ? '+' : '-'}
              {money(Number(e.amount))}
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, marginBottom: spacing.md, textAlign: 'left' },
  balanceCard: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  balanceLabel: { color: colors.periwinkle, fontWeight: '600', fontSize: 13, textAlign: 'left' },
  balanceValue: { color: colors.white, fontWeight: '900', fontSize: 36, textAlign: 'left' },
  statsRow: { flexDirection: 'row', marginTop: spacing.md, alignItems: 'center' },
  stat: { flex: 1 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: spacing.md },
  statLabel: { color: colors.periwinkle, fontSize: 11, fontWeight: '600', textAlign: 'left' },
  statValue: { color: colors.white, fontSize: 17, fontWeight: '800', textAlign: 'left' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  glyphWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 18 },
  entryTitle: { ...typography.body, fontWeight: '700', fontSize: 15, textAlign: 'left' },
  meta: { ...typography.caption, fontSize: 12, marginTop: 1, textAlign: 'left' },
  amount: { fontWeight: '800', fontSize: 15 },
  amountIn: { color: colors.success },
  amountOut: { color: colors.danger },
});
