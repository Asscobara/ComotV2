import type { PollResults, PollWithOptions } from '@comot/shared';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { closePoll, fetchPollResults, vote } from '@/lib/events';
import { colors, radius, spacing, typography } from '@/theme';

import { Button, Card, Tag } from './ui';

export function PollCard({ poll }: { poll: PollWithOptions }) {
  const { t } = useTranslation();
  const { membership } = useAuth();
  const isCommittee = membership?.role === 'committee';

  const [results, setResults] = useState<PollResults | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setResults(await fetchPollResults(poll.id));
    } catch {
      // poll stays in vote-only mode
    }
  }, [poll.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isOpen = (results?.status ?? poll.status) === 'open';

  const castVote = async (optionId: string) => {
    if (!isOpen) return;
    setBusy(true);
    try {
      await vote(poll.id, optionId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onClose = async () => {
    setBusy(true);
    try {
      await closePoll(poll.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const total = results?.total_votes ?? 0;

  return (
    <Card>
      <View style={styles.head}>
        <Text style={styles.question}>{poll.question}</Text>
        <Tag label={isOpen ? t('polls.open') : t('polls.closed')} tone={isOpen ? 'success' : 'neutral'} />
      </View>

      <View style={styles.options}>
        {(results?.options ?? poll.options.map((o) => ({ id: o.id, label: o.label, votes: 0 }))).map(
          (option) => {
            const isMine = results?.my_vote === option.id;
            const pct = total > 0 ? Math.round((option.votes / total) * 100) : 0;
            return (
              <Pressable
                key={option.id}
                disabled={busy || !isOpen}
                onPress={() => castVote(option.id)}
                style={[styles.option, isMine && styles.optionMine]}
              >
                <View style={[styles.optionFill, { width: `${pct}%` }]} />
                <View style={styles.optionRow}>
                  <Text style={[styles.optionLabel, isMine && { color: colors.primary }]}>
                    {option.label}
                    {isMine ? `  ✓` : ''}
                  </Text>
                  <Text style={styles.optionPct}>{total > 0 ? `${pct}%` : ''}</Text>
                </View>
              </Pressable>
            );
          },
        )}
      </View>

      <View style={styles.foot}>
        <Text style={styles.votes}>{t('polls.totalVotes', { count: total })}</Text>
        {isOpen ? <Text style={styles.hint}>{t('polls.changeVote')}</Text> : null}
      </View>

      {isCommittee && isOpen ? (
        <Button title={t('polls.close')} variant="ghost" onPress={onClose} loading={busy} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  question: { ...typography.heading, fontSize: 16, flex: 1, textAlign: 'left' },
  options: { gap: spacing.sm },
  option: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  optionMine: { borderColor: colors.primary },
  optionFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    insetInlineStart: 0,
    backgroundColor: colors.primarySoft,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  optionLabel: { fontWeight: '600', color: colors.ink, textAlign: 'left', flex: 1 },
  optionPct: { fontWeight: '700', color: colors.inkSoft, fontSize: 13 },
  foot: { marginTop: spacing.md, marginBottom: spacing.sm },
  votes: { ...typography.caption, fontWeight: '700', textAlign: 'left' },
  hint: { ...typography.caption, fontSize: 11, marginTop: 2, color: colors.inkFaint, textAlign: 'left' },
});
