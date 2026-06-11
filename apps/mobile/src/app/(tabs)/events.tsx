import type { BuildingEvent, PollWithOptions } from '@comot/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PollCard } from '@/components/poll-card';
import { Button, Card, EmptyState, Screen, SectionTitle, Tag } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { fetchEvents, fetchPolls } from '@/lib/events';
import { colors, radius, spacing, typography } from '@/theme';

export const EVENT_GLYPHS: Record<BuildingEvent['kind'], string> = {
  meeting: '🧑‍🤝‍🧑',
  maintenance: '🔧',
  payment: '💳',
  other: '📌',
};

export default function EventsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { membership } = useAuth();
  const isCommittee = membership?.role === 'committee';

  const [events, setEvents] = useState<BuildingEvent[]>([]);
  const [polls, setPolls] = useState<PollWithOptions[]>([]);
  const [now, setNow] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setNow(Date.now());
      (async () => {
        if (!membership?.building) return;
        try {
          const [ev, pl] = await Promise.all([
            fetchEvents(membership.building.id),
            fetchPolls(membership.building.id),
          ]);
          if (active) {
            setEvents(ev);
            setPolls(pl);
          }
        } catch {
          // empty states shown
        }
      })();
      return () => {
        active = false;
      };
    }, [membership]),
  );
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= now);
  const past = events.filter((e) => new Date(e.starts_at).getTime() < now).reverse().slice(0, 10);
  const openPolls = polls.filter((p) => p.status === 'open');

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === 'he' ? 'he-IL' : 'en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  const EventRow = ({ event }: { event: BuildingEvent }) => (
    <Pressable onPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}>
      <Card style={styles.row}>
        <View style={styles.glyphWrap}>
          <Text style={styles.glyph}>{EVENT_GLYPHS[event.kind]}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.meta}>
            {fmt(event.starts_at)}
            {event.location ? ` · ${event.location}` : ''}
          </Text>
        </View>
        {event.recurrence !== 'none' ? (
          <Tag label={t(`events.rec_${event.recurrence}`)} tone="primary" />
        ) : null}
      </Card>
    </Pressable>
  );

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('events.title')}</Text>
      </View>

      {isCommittee ? (
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button title={t('events.new')} onPress={() => router.push('/events/new')} />
          </View>
          <View style={styles.flex}>
            <Button title={t('polls.new')} variant="soft" onPress={() => router.push('/events/new-poll')} />
          </View>
        </View>
      ) : null}

      {openPolls.length > 0 ? (
        <>
          <SectionTitle>{t('polls.title')}</SectionTitle>
          {openPolls.map((p) => (
            <PollCard key={p.id} poll={p} />
          ))}
        </>
      ) : null}

      <SectionTitle>{t('events.upcoming')}</SectionTitle>
      {upcoming.length === 0 ? (
        <EmptyState icon="📅" title={t('events.empty')} />
      ) : (
        upcoming.map((e) => <EventRow key={e.id} event={e} />)
      )}

      {past.length > 0 ? (
        <>
          <SectionTitle>{t('events.past')}</SectionTitle>
          {past.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.title, marginBottom: spacing.md, textAlign: 'left' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  glyphWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 20 },
  eventTitle: { ...typography.body, fontWeight: '700', textAlign: 'left' },
  meta: { ...typography.caption, marginTop: 1, textAlign: 'left' },
});
