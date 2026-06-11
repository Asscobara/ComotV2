import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type BudgetCategory,
  type BudgetKind,
} from '@comot/shared';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen, Segmented, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { addBudgetEntry } from '@/lib/budget';
import { colors, radius, spacing, typography } from '@/theme';

export default function NewEntryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { membership } = useAuth();

  const [kind, setKind] = useState<BudgetKind>('expense');
  const [category, setCategory] = useState<BudgetCategory>('maintenance');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const categories = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const valid = title.trim().length >= 1 && Number(amount) > 0;

  const changeKind = (k: BudgetKind) => {
    setKind(k);
    setCategory(k === 'income' ? 'other_income' : 'maintenance');
  };

  const submit = async () => {
    if (!membership?.building) return;
    setBusy(true);
    try {
      await addBudgetEntry({
        buildingId: membership.building.id,
        kind,
        category,
        title,
        amount: Number(amount),
      });
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('common.error');
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.label}>{t('budget.entryKind')}</Text>
        <Segmented
          options={[
            { value: 'expense' as BudgetKind, label: t('budget.kind_expense') },
            { value: 'income' as BudgetKind, label: t('budget.kind_income') },
          ]}
          value={kind}
          onChange={changeKind}
        />

        <View style={{ height: spacing.md }} />
        <Text style={styles.label}>{t('budget.category')}</Text>
        <View style={styles.catGrid}>
          {categories.map((cat) => {
            const active = category === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[styles.cat, active && styles.catActive]}
              >
                <Text style={[styles.catLabel, active && styles.catLabelActive]}>
                  {t(`budget.cat_${cat}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: spacing.md }} />
        <TextField label={t('budget.entryTitle')} value={title} onChangeText={setTitle} />
        <TextField
          label={t('budget.amount')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        <Button title={t('budget.save')} onPress={submit} loading={busy} disabled={!valid} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, marginBottom: 6, textAlign: 'left' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cat: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  catActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  catLabel: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  catLabelActive: { color: colors.primary },
});
