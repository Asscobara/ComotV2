import type { MemberWithProfile } from '@comot/shared';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, EmptyState, Screen } from '@/components/ui';
import { fetchMembers } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getOrCreateDm } from '@/lib/chat';
import { colors, spacing, typography } from '@/theme';

export default function NewDmScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session, membership } = useAuth();

  const [members, setMembers] = useState<MemberWithProfile[]>([]);

  useEffect(() => {
    (async () => {
      if (!membership?.building) return;
      try {
        const all = await fetchMembers(membership.building.id);
        setMembers(all.filter((m) => m.status === 'active' && m.user_id !== session?.user.id));
      } catch {
        // empty state shown
      }
    })();
  }, [membership, session]);

  const open = async (member: MemberWithProfile) => {
    if (!membership?.building) return;
    try {
      const conversationId = await getOrCreateDm(membership.building.id, member.user_id);
      router.replace({ pathname: '/chat/[id]', params: { id: conversationId } });
    } catch {
      // stay on the picker
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('chat.newDm') }} />
      <Text style={styles.subtitle}>{t('chat.pickMember')}</Text>
      {members.length === 0 ? (
        <EmptyState icon="👥" title={t('tenants.empty')} />
      ) : (
        members.map((m) => (
          <Pressable key={m.id} onPress={() => open(m)}>
            <Card style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(m.profile?.full_name || '?').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.name}>{m.profile?.full_name || m.profile?.email || '—'}</Text>
                <Text style={styles.meta}>
                  {m.apartment ? t('tenants.apartment', { number: m.apartment.number }) : t('tenants.noApartment')}
                </Text>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { ...typography.label, marginBottom: spacing.md, textAlign: 'left' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  name: { ...typography.body, fontWeight: '700', textAlign: 'left' },
  meta: { ...typography.caption, textAlign: 'left' },
});
