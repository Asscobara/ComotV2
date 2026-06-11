import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme';

export default function BudgetLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: '800' },
        contentStyle: { backgroundColor: colors.bgSoft },
      }}
    >
      <Stack.Screen name="new-entry" options={{ title: t('budget.addEntry') }} />
      <Stack.Screen name="fees" options={{ title: t('budget.fees') }} />
    </Stack>
  );
}
