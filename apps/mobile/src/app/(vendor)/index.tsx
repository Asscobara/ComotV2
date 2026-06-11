import type { FaultBooking } from '@comot/shared';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, Screen, SectionTitle, Tag } from '@/components/ui';
import { Logo } from '@/components/logo';
import { useAuth } from '@/lib/auth';
import { fetchMyBookings, respondBooking } from '@/lib/vendors';
import { colors, spacing, typography } from '@/theme';

const STATUS_TONES = {
  booked: 'warning',
  accepted: 'success',
  declined: 'neutral',
  done: 'primary',
} as const;

export default function VendorDashboardScreen() {
  const { t } = useTranslation();
  const { vendor, signOut } = useAuth();
  const [bookings, setBookings] = useState<FaultBooking[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!vendor) return;
    try {
      setBookings(await fetchMyBookings(vendor.id));
    } catch {
      // empty state shown
    }
  }, [vendor]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const respond = async (bookingId: string, accept: boolean) => {
    setBusy(true);
    try {
      await respondBooking(bookingId, accept);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!vendor) return null;

  return (
    <Screen>
      <View style={styles.header}>
        <Logo size={40} />
      </View>
      <Text style={styles.title}>{t('vendor.dashTitle', { name: vendor.business_name })}</Text>

      <SectionTitle>{t('vendor.myProfile')}</SectionTitle>
      <Card>
        <Text style={styles.profileName}>{vendor.business_name}</Text>
        <Text style={styles.meta}>
          {vendor.city}
          {vendor.phone ? ` · ${vendor.phone}` : ''}
        </Text>
        <View style={styles.tagRow}>
          {vendor.categories.map((c) => (
            <Tag key={c} label={t(`faults.cat_${c}`)} tone="primary" />
          ))}
        </View>
        <Text style={styles.note}>{t('vendor.freeNote')}</Text>
      </Card>

      <SectionTitle>{t('vendor.bookings')}</SectionTitle>
      {bookings.length === 0 ? (
        <EmptyState icon="🧰" title={t('vendor.noBookings')} />
      ) : (
        bookings.map((b) => (
          <Card key={b.id}>
            <View style={styles.bookingHead}>
              <View style={styles.flex}>
                <Text style={styles.bookingTitle}>{b.fault_title}</Text>
                <Text style={styles.meta}>
                  {t(`faults.cat_${b.fault_category}`)} · {b.city} ·{' '}
                  {new Date(b.created_at).toLocaleDateString()}
                </Text>
              </View>
              <Tag label={t(`vendor.status_${b.status}`)} tone={STATUS_TONES[b.status]} />
            </View>
            {b.status === 'booked' ? (
              <View style={styles.actions}>
                <View style={styles.flex}>
                  <Button title={t('vendor.accept')} onPress={() => respond(b.id, true)} loading={busy} />
                </View>
                <View style={styles.flex}>
                  <Button title={t('vendor.decline')} variant="ghost" onPress={() => respond(b.id, false)} loading={busy} />
                </View>
              </View>
            ) : null}
          </Card>
        ))
      )}

      <View style={{ height: spacing.lg }} />
      <Button title={t('common.signOut')} variant="danger" onPress={() => signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: spacing.md },
  title: { ...typography.title, fontSize: 24, marginBottom: spacing.lg, textAlign: 'left' },
  profileName: { ...typography.heading, fontSize: 17, textAlign: 'left' },
  meta: { ...typography.caption, marginTop: 2, textAlign: 'left' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  note: { ...typography.caption, fontSize: 12, marginTop: spacing.md, color: colors.inkFaint, textAlign: 'left' },
  bookingHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bookingTitle: { ...typography.body, fontWeight: '700', textAlign: 'left' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  flex: { flex: 1 },
});
