import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Banner, Button, Card, Screen, TextField } from '@/components/ui';
import { Logo } from '@/components/logo';
import { useAuth, type SocialProvider } from '@/lib/auth';
import { alertBox, useErrorAlert } from '@/lib/errors';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, spacing, typography } from '@/theme';

export default function SignInScreen() {
  const { t } = useTranslation();
  const notifyError = useErrorAlert();
  const { signInWithPassword, signUpWithPassword, signInWithProvider } = useAuth();

  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'signIn') {
        await signInWithPassword(email, password);
      } else {
        const { needsConfirmation } = await signUpWithPassword(email, password, fullName);
        if (needsConfirmation) alertBox(t('auth.checkEmail'));
      }
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  const social = async (provider: SocialProvider) => {
    try {
      await signInWithProvider(provider);
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <Screen style={styles.center}>
      <View style={styles.header}>
        <Logo size={64} />
        <Text style={styles.tagline}>{t('common.tagline')}</Text>
      </View>

      {!isSupabaseConfigured ? <Banner tone="warning" text={t('common.notConfigured')} /> : null}

      <Card>
        <Text style={styles.title}>{mode === 'signIn' ? t('auth.signIn') : t('auth.signUp')}</Text>
        <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>

        {mode === 'signUp' ? (
          <TextField
            label={t('auth.fullName')}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
        ) : null}
        <TextField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <Button
          title={mode === 'signIn' ? t('auth.signIn') : t('auth.signUp')}
          onPress={submit}
          loading={busy}
          disabled={!email || !password || (mode === 'signUp' && !fullName)}
        />

        <Text style={styles.divider}>{t('auth.orWith')}</Text>

        <View style={styles.socialCol}>
          <Button title={t('auth.google')} variant="soft" onPress={() => social('google')} />
          <Button title={t('auth.apple')} variant="soft" onPress={() => social('apple')} />
          <Button title={t('auth.facebook')} variant="soft" onPress={() => social('facebook')} />
        </View>

        <Text
          style={styles.switchMode}
          onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
        >
          {mode === 'signIn' ? t('auth.noAccount') : t('auth.haveAccount')}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  tagline: { ...typography.caption, marginTop: spacing.sm, fontSize: 15 },
  title: { ...typography.title, textAlign: 'center' },
  subtitle: { ...typography.caption, textAlign: 'center', marginTop: 6, marginBottom: spacing.lg },
  divider: {
    textAlign: 'center',
    color: colors.inkFaint,
    marginVertical: spacing.md,
    fontSize: 13,
    fontWeight: '600',
  },
  socialCol: { gap: spacing.sm },
  switchMode: {
    textAlign: 'center',
    color: colors.primary,
    fontWeight: '700',
    marginTop: spacing.lg,
    fontSize: 14,
  },
});
