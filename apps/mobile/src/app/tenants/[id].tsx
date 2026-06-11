import type { Apartment, MemberWithProfile, MembershipRole, TenantType } from '@comot/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen, SectionTitle, Segmented } from '@/components/ui';
import { fetchApartments, fetchMember, removeMember, updateMember } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, typography } from '@/theme';

function notifyError(fallback: string, e: unknown) {
  const msg = e instanceof Error ? e.message : fallback;
  if (Platform.OS === 'web') window.alert(msg);
  else Alert.alert(msg);
}

export default function EditTenantScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { membership } = useAuth();

  const [member, setMember] = useState<MemberWithProfile | null>(null);
  const [apartments, setApartments] = useState<Pick<Apartment, 'id' | 'number' | 'floor'>[]>([]);
  const [apartmentId, setApartmentId] = useState<string | null>(null);
  const [tenantType, setTenantType] = useState<TenantType>('owner');
  const [role, setRole] = useState<MembershipRole>('tenant');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const m = await fetchMember(id);
        if (!m) return;
        setMember(m);
        setApartmentId(m.apartment_id);
        setTenantType(m.tenant_type);
        setRole(m.role);
        if (membership?.building) {
          setApartments(await fetchApartments(membership.building.id));
        }
      } catch (e) {
        notifyError(t('common.error'), e);
      }
    })();
  }, [id, membership, t]);

  const save = async () => {
    setBusy(true);
    try {
      await updateMember(id, { apartment_id: apartmentId, tenant_type: tenantType, role });
      router.back();
    } catch (e) {
      notifyError(t('common.error'), e);
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = () => {
    const doRemove = async () => {
      try {
        await removeMember(id);
        router.back();
      } catch (e) {
        notifyError(t('common.error'), e);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(t('tenants.removeConfirm'))) void doRemove();
    } else {
      Alert.alert(t('tenants.remove'), t('tenants.removeConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('tenants.remove'), style: 'destructive', onPress: () => void doRemove() },
      ]);
    }
  };

  if (!member) {
    return (
      <Screen scroll={false}>
        <View />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.name}>{member.profile?.full_name || member.profile?.email || '—'}</Text>
      <Text style={styles.meta}>{member.profile?.email ?? ''}</Text>

      <SectionTitle>{t('onboarding.selectApartment')}</SectionTitle>
      <Card>
        <View style={styles.aptGrid}>
          {apartments.map((apt) => {
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
      </Card>

      <SectionTitle>{t('tenants.tenantType')}</SectionTitle>
      <Card>
        <Segmented
          options={[
            { value: 'owner', label: t('onboarding.iAmOwner') },
            { value: 'renter', label: t('onboarding.iAmRenter') },
          ]}
          value={tenantType}
          onChange={setTenantType}
        />
      </Card>

      <SectionTitle>{t('tenants.role')}</SectionTitle>
      <Card>
        <Segmented
          options={[
            { value: 'tenant', label: t('tenants.tenant') },
            { value: 'committee', label: t('tenants.committee') },
          ]}
          value={role}
          onChange={setRole}
        />
      </Card>

      <Button title={t('common.save')} onPress={save} loading={busy} />
      <View style={{ height: spacing.sm }} />
      <Button title={t('tenants.remove')} variant="danger" onPress={confirmRemove} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { ...typography.title, fontSize: 24, textAlign: 'left' },
  meta: { ...typography.caption, marginBottom: spacing.lg, textAlign: 'left' },
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
