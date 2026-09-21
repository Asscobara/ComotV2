import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen, SectionTitle, Segmented, TextField } from '@/components/ui';
import {
  deleteOwnAccount,
  fetchAccountDeletionPreview,
  isHandoverRequired,
} from '@/lib/account';
import { updateProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { alertBox, useErrorAlert } from '@/lib/errors';
import { setLanguage, type AppLanguage } from '@/lib/i18n';
import { colors, spacing, typography } from '@/theme';

export default function MoreScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const notifyError = useErrorAlert();
  const { profile, membership, refresh, signOut } = useAuth();

  const building = membership?.building ?? null;
  const isCommittee = membership?.role === 'committee';

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const confirm = async (title: string, message: string): Promise<boolean> => {
    if (Platform.OS === 'web') return window.confirm(`${title}\n\n${message}`);
    return new Promise((resolve) => {
      Alert.alert(title, message, [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('account.deleteConfirm'), style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
  };

  // Two steps on purpose: the preview says what will be lost before anything is
  // destroyed, and the confirmation is a separate, explicit decision.
  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const preview = await fetchAccountDeletionPreview();

      if (preview.blocking_buildings.length > 0) {
        const names = preview.blocking_buildings.map((b) => b.name).join(', ');
        alertBox(t('account.handoverNeeded'), t('account.handoverNeededBody', { buildings: names }));
        return;
      }

      const removed = preview.buildings_removed.map((b) => b.name).join(', ');
      const body = removed
        ? t('account.deleteWarningWithBuilding', { buildings: removed })
        : t('account.deleteWarning');

      if (!(await confirm(t('account.delete'), body))) return;

      await deleteOwnAccount();
      // The auth listener routes back to sign-in once the session is gone.
    } catch (e) {
      if (isHandoverRequired(e)) {
        alertBox(t('account.handoverNeeded'), t('account.handoverNeededBody', { buildings: '' }));
      } else {
        notifyError(e);
      }
    } finally {
      setDeleting(false);
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

      <SectionTitle>{t('account.section')}</SectionTitle>
      <Card>
        <Text style={styles.meta}>{t('account.deleteExplainer')}</Text>
        <View style={styles.actions}>
          <Button
            title={t('account.delete')}
            variant="danger"
            onPress={deleteAccount}
            loading={deleting}
          />
        </View>
      </Card>
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
