import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { createPoll } from '@/lib/events';
import { colors, spacing, typography } from '@/theme';

export default function NewPollScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { membership } = useAuth();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [anonymous, setAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const valid = question.trim().length >= 2 && filled.length >= 2;

  const setOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  const submit = async () => {
    if (!membership?.building) return;
    setBusy(true);
    try {
      await createPoll({
        buildingId: membership.building.id,
        question,
        options: filled,
        eventId: eventId ?? null,
        isAnonymous: anonymous,
      });
      router.back();
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
        <TextField
          label={t('polls.question')}
          value={question}
          onChangeText={setQuestion}
          multiline
          style={styles.multiline}
        />

        {options.map((option, i) => (
          <TextField
            key={i}
            label={t('polls.option', { n: i + 1 })}
            value={option}
            onChangeText={(v) => setOption(i, v)}
          />
        ))}
        {options.length < 6 ? (
          <Button
            title={`+ ${t('polls.addOption')}`}
            variant="ghost"
            onPress={() => setOptions((prev) => [...prev, ''])}
          />
        ) : null}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('polls.anonymous')}</Text>
          <Switch
            value={anonymous}
            onValueChange={setAnonymous}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>

        <Button title={t('polls.create')} onPress={submit} loading={busy} disabled={!valid} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.md,
  },
  switchLabel: { ...typography.label, textAlign: 'left' },
});
