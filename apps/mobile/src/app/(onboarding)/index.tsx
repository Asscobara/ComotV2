import { Redirect, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Logo } from '@/components/logo';
import { Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, typography } from '@/theme';

export default function ChoosePathScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { membership, signOut } = useAuth();

  if (membership?.status === 'pending') {
    return <Redirect href="/(onboarding)/pending" />;
  }

  return (
    <Screen style={styles.center}>
      <View style={styles.header}>
        <Logo size={56} />
        <Text style={styles.title}>{t('onboarding.title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>
      </View>

      <Pressable style={styles.choice} onPress={() => router.push('/(onboarding)/create-building')}>
        <Text style={styles.choiceIcon}>🏗️</Text>
        <Text style={styles.choiceTitle}>{t('onboarding.createTitle')}</Text>
        <Text style={styles.choiceBody}>{t('onboarding.createBody')}</Text>
      </Pressable>

      <Pressable style={styles.choice} onPress={() => router.push('/(onboarding)/join-building')}>
        <Text style={styles.choiceIcon}>🔑</Text>
        <Text style={styles.choiceTitle}>{t('onboarding.joinTitle')}</Text>
        <Text style={styles.choiceBody}>{t('onboarding.joinBody')}</Text>
      </Pressable>

      <Text style={styles.signOut} onPress={() => signOut()}>
        {t('common.signOut')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  title: { ...typography.title, marginTop: spacing.md },
  subtitle: { ...typography.caption, marginTop: 4, fontSize: 15 },
  choice: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  choiceIcon: { fontSize: 32, marginBottom: spacing.sm },
  choiceTitle: { ...typography.heading, textAlign: 'left' },
  choiceBody: { ...typography.caption, marginTop: 4, textAlign: 'left' },
  signOut: { textAlign: 'center', color: colors.inkSoft, fontWeight: '600', marginTop: spacing.md },
});
