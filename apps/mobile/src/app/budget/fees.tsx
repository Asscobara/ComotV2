import type { Apartment, FeePayment } from '@comot/shared';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Screen, SectionTitle } from '@/components/ui';
import { fetchApartments } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { currentPeriod, fetchFeePayments, markFeePaid } from '@/lib/budget';
import { colors, radius, spacing, typography } from '@/theme';

export default function FeesScreen() {
  const { t } = useTranslation();
  const { membership } = useAuth();
  const isCommittee = membership?.role === 'committee';
  const building = membership?.building ?? null;

  const period = currentPeriod();
  const [apartments, setApartments] = useState<Pick<Apartment, 'id' | 'number' | 'floor'>[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);

  const load = useCallback(async () => {
    if (!building) return;
    try {
      const [apts, pays] = await Promise.all([
        fetchApartments(building.id),
        fetchFeePayments(building.id, period),
      ]);
      setApartments(apts);
      setPayments(pays);
    } catch {
      // empty state
    }
  }, [building, period]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const paidSet = new Set(payments.map((p) => p.apartment_id));

  const mark = (apartmentId: string, number: string) => {
    if (!building || !isCommittee || paidSet.has(apartmentId)) return;
    const doMark = async () => {
      try {
        await markFeePaid(building.id, apartmentId, period);
        await load();
      } catch (e) {
        const msg = e instanceof Error ? e.message : t('common.error');
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert(msg);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(t('budget.markPaid', { number }))) void doMark();
    } else {
      Alert.alert(t('budget.paid'), t('budget.markPaid', { number }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('budget.paid'), onPress: () => void doMark() },
      ]);
    }
  };

  return (
    <Screen>
      <SectionTitle>{t('budget.feesFor', { period })}</SectionTitle>
      <Card>
        <Text style={styles.progress}>
          {t('budget.feeProgress', { paid: paidSet.size, total: apartments.length })}
        </Text>
        <View style={styles.grid}>
          {apartments.map((apt) => {
            const paid = paidSet.has(apt.id);
            return (
              <Pressable
                key={apt.id}
                onPress={() => mark(apt.id, apt.number)}
                style={[styles.apt, paid ? styles.aptPaid : styles.aptUnpaid]}
              >
                <Text style={[styles.aptNumber, paid && styles.aptNumberPaid]}>{apt.number}</Text>
                <Text style={[styles.aptStatus, paid && styles.aptNumberPaid]}>
                  {paid ? t('budget.paid') : t('budget.unpaid')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { ...typography.label, marginBottom: spacing.md, textAlign: 'left' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  apt: {
    minWidth: 76,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  aptPaid: { borderColor: colors.success, backgroundColor: colors.successSoft },
  aptUnpaid: { borderColor: colors.border, backgroundColor: colors.surface },
  aptNumber: { fontWeight: '800', fontSize: 16, color: colors.ink },
  aptNumberPaid: { color: colors.success },
  aptStatus: { fontSize: 10, fontWeight: '600', color: colors.inkSoft, marginTop: 2 },
});
