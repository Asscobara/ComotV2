import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, spacing, typography } from '@/theme';

export default function PendingScreen() {
  const { t } = useTranslation();
  const { membership, refresh, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    try {
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={styles.center} scroll={false}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>⏳</Text>
      </View>
      <Text style={styles.title}>{t('onboarding.pendingTitle')}</Text>
      <Text style={styles.body}>
        {t('onboarding.pendingBody', { building: membership?.building?.name ?? '' })}
      </Text>

      <View style={styles.actions}>
        <Button title={t('onboarding.checkStatus')} onPress={check} loading={busy} />
        <Button title={t('common.signOut')} variant="ghost" onPress={() => signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  icon: { fontSize: 40 },
  title: { ...typography.title, textAlign: 'center' },
  body: { ...typography.caption, fontSize: 15, textAlign: 'center', marginTop: spacing.sm, maxWidth: 320 },
  actions: { marginTop: spacing.xl, gap: spacing.sm, width: '100%' },
});
