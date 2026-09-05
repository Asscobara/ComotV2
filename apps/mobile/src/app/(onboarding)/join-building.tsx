import type { BuildingPreview, TenantType } from '@comot/shared';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen, Segmented, TextField } from '@/components/ui';
import { getBuildingByInviteCode, joinBuilding } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorAlert } from '@/lib/errors';
import { colors, radius, spacing, typography } from '@/theme';

export default function JoinBuildingScreen() {
  const { t } = useTranslation();
  const notifyError = useErrorAlert();
  const router = useRouter();
  const { refresh } = useAuth();

  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<BuildingPreview | null>(null);
  const [apartmentId, setApartmentId] = useState<string | null>(null);
  const [tenantType, setTenantType] = useState<TenantType>('owner');
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const lookup = async () => {
    setBusy(true);
    setNotFound(false);
    try {
      const result = await getBuildingByInviteCode(code);
      if (!result) {
        setNotFound(true);
        setPreview(null);
      } else {
        setPreview(result);
      }
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await joinBuilding({ inviteCode: code, apartmentId, tenantType });
      await refresh();
      router.replace('/(onboarding)/pending');
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <Text style={styles.title}>{t('onboarding.joinTitle')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.joinBody')}</Text>

      <Card>
        <TextField
          label={t('onboarding.inviteCode')}
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          error={notFound ? t('onboarding.buildingNotFound') : null}
        />
        <Button title={t('onboarding.findBuilding')} onPress={lookup} loading={busy && !preview} disabled={code.trim().length < 4} />
      </Card>

      {preview ? (
        <Card>
          <Text style={styles.buildingName}>{preview.building.name}</Text>
          <Text style={styles.buildingMeta}>
            {preview.building.address}, {preview.building.city}
          </Text>
          <Text style={styles.buildingMeta}>
            {t('home.floorsCount', {
              floors: preview.building.floors,
              apartments: preview.building.apartments_count,
            })}
          </Text>

          <View style={{ height: spacing.md }} />
          <Text style={styles.label}>{t('onboarding.selectApartment')}</Text>
          <View style={styles.aptGrid}>
            {preview.apartments.map((apt) => {
              const active = apartmentId === apt.id;
              return (
                <Pressable
                  key={apt.id}
                  onPress={() => setApartmentId(active ? null : apt.id)}
                  style={[styles.apt, active && styles.aptActive]}
                >
                  <Text style={[styles.aptText, active && styles.aptTextActive]}>{apt.number}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ height: spacing.md }} />
          <Segmented
            options={[
              { value: 'owner', label: t('onboarding.iAmOwner') },
              { value: 'renter', label: t('onboarding.iAmRenter') },
            ]}
            value={tenantType}
            onChange={setTenantType}
          />

          <View style={{ height: spacing.lg }} />
          <Button title={t('onboarding.requestJoin')} onPress={submit} loading={busy} disabled={!apartmentId} />
        </Card>
      ) : null}

      <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { ...typography.title, textAlign: 'left', marginBottom: 4 },
  subtitle: { ...typography.caption, textAlign: 'left', marginBottom: spacing.lg },
  buildingName: { ...typography.heading, textAlign: 'left' },
  buildingMeta: { ...typography.caption, marginTop: 2, textAlign: 'left' },
  label: { ...typography.label, marginBottom: spacing.sm, textAlign: 'left' },
  aptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  apt: {
    minWidth: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  aptActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  aptText: { fontWeight: '700', color: colors.inkSoft },
  aptTextActive: { color: colors.primary },
});
