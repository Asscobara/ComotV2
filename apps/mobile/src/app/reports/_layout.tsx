import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme';

export default function ReportsLayout() {
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
      <Stack.Screen name="index" options={{ title: t('reports.title') }} />
    </Stack>
  );
}
