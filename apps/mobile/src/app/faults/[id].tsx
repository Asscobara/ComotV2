import type { FaultStatus, FaultUpdateWithAuthor, FaultWithReporter } from '@comot/shared';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_GLYPHS, FaultStatusTag } from '@/components/fault-bits';
import { Button, Card, Screen, SectionTitle, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { addFaultNote, fetchFault, fetchFaultUpdates, updateFaultStatus } from '@/lib/faults';
import { colors, spacing, typography } from '@/theme';

function notifyError(fallback: string, e: unknown) {
  const msg = e instanceof Error ? e.message : fallback;
  if (Platform.OS === 'web') window.alert(msg);
  else Alert.alert(msg);
}

const NEXT_ACTIONS: Partial<Record<FaultStatus, { next: FaultStatus; key: string }[]>> = {
  reported: [{ next: 'in_progress', key: 'faults.markInProgress' }],
  in_progress: [{ next: 'resolved', key: 'faults.markResolved' }],
  resolved: [{ next: 'closed', key: 'faults.markClosed' }],
};

export default function FaultDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { membership } = useAuth();
  const isCommittee = membership?.role === 'committee';

  const [fault, setFault] = useState<FaultWithReporter | null>(null);
  const [updates, setUpdates] = useState<FaultUpdateWithAuthor[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, u] = await Promise.all([fetchFault(id), fetchFaultUpdates(id)]);
      setFault(f);
      setUpdates(u);
    } catch (e) {
      notifyError(t('common.error'), e);
    }
  }, [id, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const changeStatus = async (status: FaultStatus) => {
    setBusy(true);
    try {
      await updateFaultStatus(id, status, note || undefined);
      setNote('');
      await load();
    } catch (e) {
      notifyError(t('common.error'), e);
    } finally {
      setBusy(false);
    }
  };

  const submitNote = async () => {
    if (!fault || !note.trim()) return;
    setBusy(true);
    try {
      await addFaultNote(fault.id, fault.building_id, note);
      setNote('');
      await load();
    } catch (e) {
      notifyError(t('common.error'), e);
    } finally {
      setBusy(false);
    }
  };

  if (!fault) {
    return (
      <Screen scroll={false}>
        <View />
      </Screen>
    );
  }

  const actions = NEXT_ACTIONS[fault.status] ?? [];

  return (
    <Screen>
      <Stack.Screen options={{ title: fault.title }} />

      <Card>
        <View style={styles.headRow}>
          <Text style={styles.glyph}>{CATEGORY_GLYPHS[fault.category]}</Text>
          <View style={styles.flex}>
            <Text style={styles.title}>{fault.title}</Text>
            <Text style={styles.meta}>
              {t(`faults.cat_${fault.category}`)}
              {fault.location ? ` · ${fault.location}` : ''}
            </Text>
            <Text style={styles.meta}>
              {t('faults.reportedBy', { name: fault.reporter?.full_name || '—' })}
              {' · '}
              {new Date(fault.created_at).toLocaleDateString()}
            </Text>
          </View>
          <FaultStatusTag status={fault.status} />
        </View>
        {fault.description ? <Text style={styles.description}>{fault.description}</Text> : null}
      </Card>

      <SectionTitle>{t('faults.timeline')}</SectionTitle>
      <Card>
        {updates.length === 0 ? (
          <Text style={styles.meta}>—</Text>
        ) : (
          updates.map((u) => (
            <View key={u.id} style={styles.update}>
              <View style={styles.updateDot} />
              <View style={styles.flex}>
                <View style={styles.updateHead}>
                  <Text style={styles.updateAuthor}>{u.author?.full_name || '—'}</Text>
                  {u.status ? <FaultStatusTag status={u.status} /> : null}
                </View>
                {u.note ? <Text style={styles.updateNote}>{u.note}</Text> : null}
                <Text style={styles.updateTime}>{new Date(u.created_at).toLocaleString()}</Text>
              </View>
            </View>
          ))
        )}
      </Card>

      <Card>
        <TextField
          label={t('faults.addNote')}
          value={note}
          onChangeText={setNote}
          placeholder={t('faults.notePlaceholder')}
          multiline
        />
        <Button title={t('faults.addNote')} variant="soft" onPress={submitNote} loading={busy} disabled={!note.trim()} />
        {isCommittee && actions.length > 0 ? (
          <View style={styles.actionsRow}>
            {actions.map((a) => (
              <View key={a.next} style={styles.flex}>
                <Button title={t(a.key)} onPress={() => changeStatus(a.next)} loading={busy} />
              </View>
            ))}
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  glyph: { fontSize: 26 },
  flex: { flex: 1 },
  title: { ...typography.heading, fontSize: 18, textAlign: 'left' },
  meta: { ...typography.caption, marginTop: 2, textAlign: 'left' },
  description: { ...typography.body, marginTop: spacing.md, color: colors.inkSoft, textAlign: 'left' },
  update: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  updateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.periwinkle,
    marginTop: 6,
  },
  updateHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  updateAuthor: { fontWeight: '700', color: colors.ink, fontSize: 14, textAlign: 'left' },
  updateNote: { ...typography.body, fontSize: 14, marginTop: 2, textAlign: 'left' },
  updateTime: { ...typography.caption, fontSize: 11, marginTop: 2, color: colors.inkFaint, textAlign: 'left' },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
