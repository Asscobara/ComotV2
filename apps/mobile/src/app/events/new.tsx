import type { EventKind, EventRecurrence } from '@comot/shared';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen, Segmented, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { createEvent } from '@/lib/events';
import { spacing, typography } from '@/theme';

function parseDateTime(value: string): Date | null {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function NewEventScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { membership } = useAuth();

  const [kind, setKind] = useState<EventKind>('meeting');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [recurrence, setRecurrence] = useState<EventRecurrence>('none');
  const [busy, setBusy] = useState(false);

  const parsed = parseDateTime(startsAt);
  const valid = title.trim().length >= 2 && parsed !== null;

  const submit = async () => {
    if (!membership?.building || !parsed) return;
    setBusy(true);
    try {
      const id = await createEvent({
        buildingId: membership.building.id,
        kind,
        title,
        description,
        location,
        startsAt: parsed,
        recurrence,
      });
      router.replace({ pathname: '/events/[id]', params: { id } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('common.error');
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.label}>{t('events.kind')}</Text>
        <Segmented
          options={[
            { value: 'meeting', label: t('events.kind_meeting') },
            { value: 'maintenance', label: t('events.kind_maintenance') },
            { value: 'payment', label: t('events.kind_payment') },
            { value: 'other', label: t('events.kind_other') },
          ]}
          value={kind}
          onChange={setKind}
        />
        <View style={{ height: spacing.md }} />

        <TextField label={t('events.eventTitle')} value={title} onChangeText={setTitle} />
        <TextField
          label={t('events.startsAt')}
          value={startsAt}
          onChangeText={setStartsAt}
          placeholder={t('events.startsAtHint')}
          error={startsAt.length > 0 && !parsed ? t('events.badDate') : null}
        />
        <TextField label={t('events.location')} value={location} onChangeText={setLocation} />
        <TextField
          label={t('events.description')}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          style={styles.multiline}
        />

        <Text style={styles.label}>{t('events.recurrence')}</Text>
        <Segmented
          options={[
            { value: 'none', label: t('events.rec_none') },
            { value: 'weekly', label: t('events.rec_weekly') },
            { value: 'monthly', label: t('events.rec_monthly') },
            { value: 'yearly', label: t('events.rec_yearly') },
          ]}
          value={recurrence}
          onChange={setRecurrence}
        />

        <View style={{ height: spacing.lg }} />
        <Button title={t('events.create')} onPress={submit} loading={busy} disabled={!valid} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, marginBottom: 6, textAlign: 'left' },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
});
