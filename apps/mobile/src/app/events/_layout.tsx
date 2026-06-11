import { Stack } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme';

export default function EventsLayout() {
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
      <Stack.Screen name="new" options={{ title: t('events.new') }} />
      <Stack.Screen name="new-poll" options={{ title: t('polls.new') }} />
      <Stack.Screen name="[id]" options={{ title: t('events.title') }} />
    </Stack>
  );
}
