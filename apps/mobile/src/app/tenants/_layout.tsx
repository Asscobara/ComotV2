import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme';

export default function TenantsLayout() {
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
      <Stack.Screen name="index" options={{ title: t('tenants.title') }} />
      <Stack.Screen name="[id]" options={{ title: t('tenants.edit') }} />
    </Stack>
  );
}
