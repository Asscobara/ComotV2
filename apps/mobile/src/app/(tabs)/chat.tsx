import type { ConversationWithMembers } from '@comot/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EmptyState, Screen, SectionTitle, TextField } from '@/components/ui';
import { createChannel, fetchConversations } from '@/lib/chat';
import { useAuth } from '@/lib/auth';
import { colors, radius, spacing, typography } from '@/theme';

export default function ChatListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session, membership } = useAuth();

  const building = membership?.building ?? null;
  const isCommittee = membership?.role === 'committee';

  const [conversations, setConversations] = useState<ConversationWithMembers[]>([]);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!building) return;
    try {
      setConversations(await fetchConversations(building.id));
    } catch {
      // shown empty; individual actions surface their own errors
    }
  }, [building]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const addChannel = async () => {
    if (!building || !channelName.trim()) return;
    setBusy(true);
    try {
      await createChannel(building.id, channelName);
      setChannelName('');
      setShowNewChannel(false);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('common.error');
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert(msg);
    } finally {
      setBusy(false);
    }
  };

  const channels = conversations.filter((c) => c.kind === 'channel');
  const dms = conversations.filter((c) => c.kind === 'dm');

  const dmTitle = (c: ConversationWithMembers) => {
    const other = c.members.find((m) => m.user_id !== session?.user.id);
    return other?.profile?.full_name || '—';
  };

  return (
    <Screen>
      <Text style={styles.title}>{t('chat.title')}</Text>

      <SectionTitle>{t('chat.channels')}</SectionTitle>
      <Card style={styles.listCard}>
        {channels.map((c) => (
          <Pressable
            key={c.id}
            style={styles.row}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })}
          >
            <View style={styles.iconWrap}>
              <Text style={styles.iconText}>#</Text>
            </View>
            <Text style={styles.rowText}>{c.name === 'general' ? t('chat.general') : c.name}</Text>
          </Pressable>
        ))}
        {isCommittee ? (
          showNewChannel ? (
            <View style={styles.newChannelRow}>
              <View style={styles.flex}>
                <TextField label={t('chat.channelName')} value={channelName} onChangeText={setChannelName} />
              </View>
              <Button title={t('common.save')} onPress={addChannel} loading={busy} />
            </View>
          ) : (
            <Pressable style={styles.row} onPress={() => setShowNewChannel(true)}>
              <View style={[styles.iconWrap, { backgroundColor: colors.bgSoft }]}>
                <Text style={[styles.iconText, { color: colors.inkSoft }]}>+</Text>
              </View>
              <Text style={[styles.rowText, { color: colors.primary }]}>{t('chat.newChannel')}</Text>
            </Pressable>
          )
        ) : null}
      </Card>

      <SectionTitle>{t('chat.directMessages')}</SectionTitle>
      <Card style={styles.listCard}>
        {dms.length === 0 ? (
          <EmptyState icon="✉️" title={t('chat.noDms')} />
        ) : (
          dms.map((c) => (
            <Pressable
              key={c.id}
              style={styles.row}
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })}
            >
              <View style={styles.iconWrap}>
                <Text style={styles.iconText}>{dmTitle(c).charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.rowText}>{dmTitle(c)}</Text>
            </Pressable>
          ))
        )}
        <Button title={t('chat.newDm')} variant="soft" onPress={() => router.push('/chat/new-dm')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, marginBottom: spacing.lg, textAlign: 'left' },
  listCard: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  rowText: { ...typography.body, fontWeight: '600', textAlign: 'left', flex: 1 },
  newChannelRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  flex: { flex: 1 },
});
