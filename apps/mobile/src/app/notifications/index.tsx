import type { AppNotification } from '@comot/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, Screen } from '@/components/ui';
import { fetchNotifications, markAllRead, markRead } from '@/lib/notifications';
import { colors, radius, spacing, typography } from '@/theme';

const KIND_GLYPHS: Record<string, string> = {
  member_pending: '👥',
  member_approved: '✅',
  member_rejected: '🚫',
  fault_reported: '⚠️',
  fault_status: '🔧',
  handover_request: '🔑',
  poll_opened: '🗳️',
  booking_new: '🧰',
  booking_response: '📋',
  fee_due: '💳',
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);

  const load = useCallback(async () => {
    try {
      setItems(await fetchNotifications());
    } catch {
      // empty state
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const text = (n: AppNotification): string => {
    const p = n.payload ?? {};
    if (n.kind === 'booking_response') {
      const key = p.status === 'accepted' ? 'notifications.n_booking_accepted' : 'notifications.n_booking_declined';
      return t(key, { ...p });
    }
    if (n.kind === 'fault_status') {
      return t('notifications.n_fault_status', { ...p, status: t(`faults.status_${p.status}`) });
    }
    return t(`notifications.n_${n.kind}`, { ...p });
  };

  const open = async (n: AppNotification) => {
    if (!n.read_at) {
      try {
        await markRead(n.id);
      } catch {
        // non-fatal
      }
    }
    const faultId = n.payload?.fault_id as string | undefined;
    if ((n.kind === 'fault_reported' || n.kind === 'fault_status' || n.kind === 'booking_response') && faultId) {
      router.push({ pathname: '/faults/[id]', params: { id: faultId } });
    } else if (n.kind === 'member_pending') {
      router.push('/tenants');
    } else if (n.kind === 'poll_opened') {
      router.push('/(tabs)/events');
    } else if (n.kind === 'fee_due') {
      router.push('/(tabs)/budget');
    } else if (n.kind === 'handover_request') {
      router.push('/(tabs)');
    } else {
      await load();
    }
  };

  const markAll = async () => {
    try {
      await markAllRead();
      await load();
    } catch {
      // non-fatal
    }
  };

  const hasUnread = items.some((n) => !n.read_at);

  return (
    <Screen>
      {hasUnread ? <Button title={t('notifications.markAll')} variant="soft" onPress={markAll} /> : null}
      <View style={{ height: spacing.md }} />
      {items.length === 0 ? (
        <EmptyState icon="🔔" title={t('notifications.empty')} />
      ) : (
        items.map((n) => (
          <Pressable key={n.id} onPress={() => open(n)}>
            <Card style={[styles.row, !n.read_at && styles.unread]}>
              <View style={[styles.glyphWrap, !n.read_at && styles.glyphUnread]}>
                <Text style={styles.glyph}>{KIND_GLYPHS[n.kind] ?? '🔔'}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={[styles.text, !n.read_at && styles.textUnread]}>{text(n)}</Text>
                <Text style={styles.time}>{new Date(n.created_at).toLocaleString()}</Text>
              </View>
              {!n.read_at ? <View style={styles.dot} /> : null}
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  unread: { borderColor: colors.periwinkle, backgroundColor: colors.primarySoft },
  glyphWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphUnread: { backgroundColor: colors.surface },
  glyph: { fontSize: 18 },
  flex: { flex: 1 },
  text: { ...typography.body, fontSize: 14, textAlign: 'left' },
  textUnread: { fontWeight: '700' },
  time: { ...typography.caption, fontSize: 11, marginTop: 2, color: colors.inkFaint, textAlign: 'left' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
