import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CommitteeHandover } from '@comot/shared';
import { Button, Card, Screen, SectionTitle, Tag } from '@/components/ui';
import { fetchMembers, fetchPendingHandoverForMe, respondHandover } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, typography } from '@/theme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile, membership, refresh } = useAuth();

  const building = membership?.building ?? null;
  const isCommittee = membership?.role === 'committee';

  const [pendingCount, setPendingCount] = useState(0);
  const [handover, setHandover] = useState<CommitteeHandover | null>(null);
  const [copied, setCopied] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          if (isCommittee && building) {
            const members = await fetchMembers(building.id);
            if (active) setPendingCount(members.filter((m) => m.status === 'pending').length);
          }
          const h = await fetchPendingHandoverForMe();
          if (active) setHandover(h);
        } catch {
          // network/config errors are surfaced by the actions themselves
        }
      })();
      return () => {
        active = false;
      };
    }, [isCommittee, building]),
  );

  const copyInvite = async () => {
    if (!building) return;
    if (Platform.OS === 'web' && navigator.clipboard) {
      await navigator.clipboard.writeText(building.invite_code);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const answerHandover = async (accept: boolean) => {
    if (!handover) return;
    try {
      await respondHandover(handover.id, accept);
      setHandover(null);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      if (Platform.OS === 'web') window.alert(msg ?? t('common.error'));
      else Alert.alert(t('common.error'), msg);
    }
  };

  const comingSoon = () => {
    if (Platform.OS === 'web') window.alert(t('common.comingSoonBody'));
    else Alert.alert(t('common.comingSoon'), t('common.comingSoonBody'));
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text style={styles.hello}>{t('home.hello', { name: profile?.full_name || '' })}</Text>
        <Tag
          label={isCommittee ? t('home.roleCommittee') : t('home.roleTenant')}
          tone={isCommittee ? 'primary' : 'neutral'}
        />
      </View>

      {handover ? (
        <Card style={styles.handoverCard}>
          <Text style={styles.handoverTitle}>{t('home.handoverTitle')}</Text>
          <Text style={styles.handoverBody}>{t('home.handoverBody')}</Text>
          <View style={styles.handoverActions}>
            <View style={styles.flex}>
              <Button title={t('home.accept')} onPress={() => answerHandover(true)} />
            </View>
            <View style={styles.flex}>
              <Button title={t('home.decline')} variant="ghost" onPress={() => answerHandover(false)} />
            </View>
          </View>
        </Card>
      ) : null}

      {building ? (
        <Card style={styles.buildingCard}>
          <Text style={styles.buildingName}>{building.name}</Text>
          <Text style={styles.buildingMeta}>
            {building.address}, {building.city}
          </Text>
          <Text style={styles.buildingMeta}>
            {t('home.floorsCount', { floors: building.floors, apartments: building.apartments_count })}
          </Text>
          {isCommittee ? (
            <Pressable onPress={copyInvite} style={styles.invite}>
              <Text style={styles.inviteLabel}>{copied ? t('home.copied') : t('home.inviteCode')}</Text>
              <Text style={styles.inviteCode}>{building.invite_code}</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {isCommittee && pendingCount > 0 ? (
        <Card style={styles.pendingCard}>
          <Text style={styles.pendingTitle}>{t('home.pendingApprovals')}</Text>
          <Text style={styles.pendingBody}>{t('home.pendingApprovalsBody', { count: pendingCount })}</Text>
          <Button title={t('home.review')} variant="soft" onPress={() => router.push('/tenants')} />
        </Card>
      ) : null}

      <SectionTitle>{t('home.quickActions')}</SectionTitle>
      <View style={styles.actionsGrid}>
        <QuickAction glyph="💬" label={t('tabs.chat')} onPress={() => router.push('/(tabs)/chat')} />
        <QuickAction glyph="⚠️" label={t('home.reportFault')} onPress={comingSoon} />
        <QuickAction glyph="💳" label={t('home.payments')} onPress={comingSoon} />
        <QuickAction glyph="📅" label={t('tabs.events')} onPress={() => router.push('/(tabs)/events')} />
      </View>

      {isCommittee ? (
        <Card>
          <Text style={styles.manageTitle}>{t('tenants.title')}</Text>
          <Button title={t('more.manageTenants')} variant="soft" onPress={() => router.push('/tenants')} />
        </Card>
      ) : null}
    </Screen>
  );
}

function QuickAction({ glyph, label, onPress }: { glyph: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
      <Text style={styles.actionGlyph}>{glyph}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  hello: { ...typography.title, fontSize: 24, flexShrink: 1, textAlign: 'left' },
  buildingCard: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  buildingName: { fontSize: 20, fontWeight: '800', color: colors.white, textAlign: 'left' },
  buildingMeta: { color: colors.periwinkle, marginTop: 2, textAlign: 'left' },
  invite: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  inviteLabel: { color: colors.periwinkle, fontSize: 12, fontWeight: '600', textAlign: 'left' },
  inviteCode: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'left',
  },
  pendingCard: { borderColor: colors.periwinkle, backgroundColor: colors.primarySoft },
  pendingTitle: { ...typography.heading, fontSize: 16, textAlign: 'left' },
  pendingBody: { ...typography.caption, marginVertical: spacing.sm, textAlign: 'left' },
  actionsGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  action: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  actionGlyph: { fontSize: 22 },
  actionLabel: { fontSize: 12, fontWeight: '600', color: colors.inkSoft, textAlign: 'center' },
  manageTitle: { ...typography.heading, fontSize: 16, marginBottom: spacing.sm, textAlign: 'left' },
  handoverCard: { borderColor: colors.periwinkle, backgroundColor: colors.primarySoft },
  handoverTitle: { ...typography.heading, fontSize: 16, textAlign: 'left' },
  handoverBody: { ...typography.caption, marginVertical: spacing.sm, textAlign: 'left' },
  handoverActions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
