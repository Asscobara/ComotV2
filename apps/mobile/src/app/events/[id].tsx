import type { BuildingEvent, PollWithOptions } from '@comot/shared';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { PollCard } from '@/components/poll-card';
import { Button, Card, Screen, SectionTitle, Tag } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { deleteEvent, fetchEvent, fetchPollsForEvent } from '@/lib/events';
import { getOrCreateEventChannel } from '@/lib/notifications';
import { spacing, typography } from '@/theme';

const EVENT_GLYPHS: Record<BuildingEvent['kind'], string> = {
  meeting: '🧑‍🤝‍🧑',
  maintenance: '🔧',
  payment: '💳',
  other: '📌',
};

export default function EventDetailScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { membership } = useAuth();
  const isCommittee = membership?.role === 'committee';

  const [event, setEvent] = useState<BuildingEvent | null>(null);
  const [polls, setPolls] = useState<PollWithOptions[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [ev, pl] = await Promise.all([fetchEvent(id), fetchPollsForEvent(id)]);
          if (active) {
            setEvent(ev);
            setPolls(pl);
          }
        } catch {
          // empty state
        }
      })();
      return () => {
        active = false;
      };
    }, [id]),
  );

  const remove = () => {
    const doDelete = async () => {
      try {
        await deleteEvent(id);
        router.back();
      } catch (e) {
        const msg = e instanceof Error ? e.message : t('common.error');
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert(msg);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(t('events.deleteConfirm'))) void doDelete();
    } else {
      Alert.alert(t('events.delete'), t('events.deleteConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('events.delete'), style: 'destructive', onPress: () => void doDelete() },
      ]);
    }
  };

  if (!event) {
    return (
      <Screen scroll={false}>
        <View />
      </Screen>
    );
  }

  const fmt = new Date(event.starts_at).toLocaleString(i18n.language === 'he' ? 'he-IL' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: event.title }} />

      <Card>
        <View style={styles.headRow}>
          <Text style={styles.glyph}>{EVENT_GLYPHS[event.kind]}</Text>
          <View style={styles.flex}>
            <Text style={styles.title}>{event.title}</Text>
            <Text style={styles.meta}>{fmt}</Text>
            {event.location ? <Text style={styles.meta}>{event.location}</Text> : null}
          </View>
          <Tag label={t(`events.kind_${event.kind}`)} tone="primary" />
        </View>
        {event.recurrence !== 'none' ? (
          <Text style={styles.meta}>
            {t('events.recurrence')}: {t(`events.rec_${event.recurrence}`)}
          </Text>
        ) : null}
        {event.description ? <Text style={styles.description}>{event.description}</Text> : null}
        <View style={{ height: spacing.md }} />
        <Button
          title={`💬 ${t('events.discussion')}`}
          variant="soft"
          onPress={async () => {
            try {
              const conversationId = await getOrCreateEventChannel(id);
              router.push({ pathname: '/chat/[id]', params: { id: conversationId } });
            } catch (e) {
              const msg = e instanceof Error ? e.message : t('common.error');
              if (Platform.OS === 'web') window.alert(msg);
              else Alert.alert(msg);
            }
          }}
        />
      </Card>

      <SectionTitle>{t('events.polls')}</SectionTitle>
      {polls.map((p) => (
        <PollCard key={p.id} poll={p} />
      ))}
      {isCommittee ? (
        <Button
          title={t('polls.new')}
          variant="soft"
          onPress={() => router.push({ pathname: '/events/new-poll', params: { eventId: id } })}
        />
      ) : null}

      {isCommittee ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button title={t('events.delete')} variant="danger" onPress={remove} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  glyph: { fontSize: 26 },
  flex: { flex: 1 },
  title: { ...typography.heading, fontSize: 18, textAlign: 'left' },
  meta: { ...typography.caption, marginTop: 2, textAlign: 'left' },
  description: { ...typography.body, marginTop: spacing.md, textAlign: 'left' },
});
