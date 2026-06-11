import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen, SectionTitle, Segmented, TextField } from '@/components/ui';
import { updateProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { setLanguage, type AppLanguage } from '@/lib/i18n';
import { colors, spacing, typography } from '@/theme';

export default function MoreScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { profile, membership, refresh, signOut } = useAuth();

  const building = membership?.building ?? null;
  const isCommittee = membership?.role === 'committee';

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [busy, setBusy] = useState(false);

  const saveProfile = async () => {
    setBusy(true);
    try {
      await updateProfile({ full_name: fullName.trim() });
      await refresh();
      if (Platform.OS === 'web') window.alert(t('tenants.saved'));
      else Alert.alert(t('tenants.saved'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      if (Platform.OS === 'web') window.alert(msg ?? t('common.error'));
      else Alert.alert(t('common.error'), msg);
    } finally {
      setBusy(false);
    }
  };

  const changeLanguage = async (lang: AppLanguage) => {
    await setLanguage(lang);
    if (Platform.OS !== 'web') {
      Alert.alert(t('more.language'), t('more.languageNote'));
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>{t('more.title')}</Text>

      <SectionTitle>{t('more.profile')}</SectionTitle>
      <Card>
        <TextField label={t('auth.fullName')} value={fullName} onChangeText={setFullName} />
        <Text style={styles.email}>{profile?.email ?? ''}</Text>
        <Button title={t('common.save')} variant="soft" onPress={saveProfile} loading={busy} />
      </Card>

      <SectionTitle>{t('more.language')}</SectionTitle>
      <Card>
        <Segmented
          options={[
            { value: 'he' as AppLanguage, label: 'עברית' },
            { value: 'en' as AppLanguage, label: 'English' },
          ]}
          value={(i18n.language as AppLanguage) === 'en' ? 'en' : 'he'}
          onChange={changeLanguage}
        />
      </Card>

      {building ? (
        <>
          <SectionTitle>{t('more.building')}</SectionTitle>
          <Card>
            <Text style={styles.buildingName}>{building.name}</Text>
            <Text style={styles.meta}>
              {building.address}, {building.city}
            </Text>
            <Text style={styles.meta}>
              {t('more.fee', { amount: building.fee_amount, day: building.fee_due_day })}
            </Text>
            <View style={styles.actions}>
              <Button title={t('reports.title')} variant="soft" onPress={() => router.push('/reports')} />
              {isCommittee ? (
                <>
                  <Button title={t('more.manageTenants')} variant="soft" onPress={() => router.push('/tenants')} />
                  <Button
                    title={t('more.handover')}
                    variant="ghost"
                    onPress={() => router.push('/tenants?handover=1')}
                  />
                </>
              ) : null}
            </View>
          </Card>
        </>
      ) : null}

      <Button title={t('common.signOut')} variant="danger" onPress={() => signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, marginBottom: spacing.lg, textAlign: 'left' },
  email: { ...typography.caption, marginBottom: spacing.md, textAlign: 'left' },
  buildingName: { ...typography.heading, fontSize: 17, textAlign: 'left' },
  meta: { ...typography.caption, marginTop: 2, textAlign: 'left', color: colors.inkSoft },
  actions: { marginTop: spacing.md, gap: spacing.sm },
});
