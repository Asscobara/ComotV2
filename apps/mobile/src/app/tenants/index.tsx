import type { MemberWithProfile } from '@comot/shared';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Banner, Button, Card, EmptyState, Screen, SectionTitle, Tag } from '@/components/ui';
import { approveMember, fetchMembers, requestHandover } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorAlert } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme';

export default function TenantsScreen() {
  const { t } = useTranslation();
  const notifyError = useErrorAlert();
  const router = useRouter();
  const { session, membership } = useAuth();
  const { handover } = useLocalSearchParams<{ handover?: string }>();
  const handoverMode = handover === '1';

  const building = membership?.building ?? null;
  const isCommittee = membership?.role === 'committee';

  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [handoverSent, setHandoverSent] = useState(false);

  const load = useCallback(async () => {
    if (!building) return;
    try {
      setMembers(await fetchMembers(building.id));
    } catch (e) {
      notifyError(e);
    }
  }, [building, notifyError]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const decide = async (membershipId: string, approve: boolean) => {
    try {
      await approveMember(membershipId, approve);
      await load();
    } catch (e) {
      notifyError(e);
    }
  };

  const nominate = async (member: MemberWithProfile) => {
    if (!building) return;
    try {
      await requestHandover(building.id, member.user_id);
      setHandoverSent(true);
    } catch (e) {
      notifyError(e);
    }
  };

  const pending = members.filter((m) => m.status === 'pending');
  const active = members.filter((m) => m.status === 'active');
  const handoverCandidates = active.filter((m) => m.user_id !== session?.user.id);

  return (
    <Screen>
      {handoverMode ? (
        <Banner tone="primary" text={handoverSent ? t('more.handoverSent') : t('more.handoverPick')} />
      ) : null}

      {!handoverMode && isCommittee && building ? (
        <Card style={styles.inviteCard}>
          <Text style={styles.inviteLabel}>{t('home.inviteCode')}</Text>
          <Text style={styles.inviteCode}>{building.invite_code}</Text>
        </Card>
      ) : null}

      {!handoverMode && pending.length > 0 ? (
        <>
          <SectionTitle>{t('tenants.pending')}</SectionTitle>
          {pending.map((m) => (
            <Card key={m.id}>
              <MemberRow member={m} />
              {isCommittee ? (
                <View style={styles.decisionRow}>
                  <View style={styles.flex}>
                    <Button title={t('tenants.approve')} onPress={() => decide(m.id, true)} />
                  </View>
                  <View style={styles.flex}>
                    <Button title={t('tenants.reject')} variant="ghost" onPress={() => decide(m.id, false)} />
                  </View>
                </View>
              ) : null}
            </Card>
          ))}
        </>
      ) : null}

      <SectionTitle>{t('tenants.active')}</SectionTitle>
      {active.length === 0 ? (
        <EmptyState icon="👥" title={t('tenants.empty')} />
      ) : (
        (handoverMode ? handoverCandidates : active).map((m) => (
          <Pressable
            key={m.id}
            onPress={() => {
              if (handoverMode) {
                nominate(m);
              } else if (isCommittee) {
                router.push({ pathname: '/tenants/[id]', params: { id: m.id } });
              }
            }}
          >
            <Card>
              <MemberRow member={m} />
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

function MemberRow({ member }: { member: MemberWithProfile }) {
  const { t } = useTranslation();
  const isCommittee = member.role === 'committee';
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(member.profile?.full_name || '?').trim().charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.name}>{member.profile?.full_name || member.profile?.email || '—'}</Text>
        <Text style={styles.meta}>
          {member.apartment
            ? t('tenants.apartment', { number: member.apartment.number })
            : t('tenants.noApartment')}
          {' · '}
          {member.tenant_type === 'owner' ? t('home.owner') : t('home.renter')}
        </Text>
      </View>
      <Tag
        label={isCommittee ? t('tenants.committee') : t('tenants.tenant')}
        tone={isCommittee ? 'primary' : member.status === 'pending' ? 'warning' : 'neutral'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inviteCard: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  inviteLabel: { color: colors.periwinkle, fontSize: 12, fontWeight: '600', textAlign: 'left' },
  inviteCode: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'left',
  },
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
  meta: { ...typography.caption, marginTop: 1, textAlign: 'left' },
  decisionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  flex: { flex: 1 },
});
