import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

import type { DateTimeFieldProps } from './date-time-field.types';
import { Button } from './ui';

/**
 * Date and time are collected in two steps rather than one combined picker:
 * @expo/ui maps mode="datetime" to date only on Android, which would silently
 * drop the time. Two steps behave the same on both platforms.
 *
 * On Android each step is a modal dialog; on iOS the picker renders inline, so
 * a confirm button is needed there to advance and to finish.
 */
type Step = 'idle' | 'date' | 'time';

function startOfNextHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function withDatePart(base: Date, picked: Date): Date {
  const d = new Date(base);
  d.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  return d;
}

function withTimePart(base: Date, picked: Date): Date {
  const d = new Date(base);
  d.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return d;
}

export function DateTimeField({
  label,
  value,
  onChange,
  error,
  minimumDate,
  placeholder,
  testID,
}: DateTimeFieldProps) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<Step>('idle');
  // What the picker starts on before the user has chosen anything.
  const [draft, setDraft] = useState<Date>(() => value ?? startOfNextHour());

  const open = () => {
    setDraft(value ?? startOfNextHour());
    setStep('date');
  };

  const handlePicked = (picked: Date) => {
    const next = step === 'date' ? withDatePart(draft, picked) : withTimePart(draft, picked);
    setDraft(next);
    onChange(next);
    // Android closes its dialog on confirm, so it drives the steps itself.
    // On iOS the picker stays inline and the confirm button below advances it.
    if (Platform.OS === 'android') setStep(step === 'date' ? 'time' : 'idle');
  };

  const advance = () => {
    if (step === 'date') setStep('time');
    else setStep('idle');
  };

  const formatted = value
    ? new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-GB' : 'he-IL', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(value)
    : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        testID={testID}
        onPress={open}
        style={[styles.field, error ? styles.fieldInvalid : null]}
      >
        <Text style={formatted ? styles.value : styles.placeholder}>
          {formatted ?? placeholder ?? ''}
        </Text>
        <Text style={styles.glyph}>🗓️</Text>
      </Pressable>

      {step !== 'idle' ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={draft}
            mode={step === 'date' ? 'date' : 'time'}
            minimumDate={step === 'date' ? minimumDate : undefined}
            is24Hour
            accentColor={colors.primary}
            onValueChange={(_event, date) => handlePicked(date)}
            onDismiss={() => setStep('idle')}
          />
          {Platform.OS === 'ios' ? (
            <Button
              title={step === 'date' ? t('common.continue') : t('common.save')}
              variant="soft"
              onPress={advance}
            />
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...typography.label, marginBottom: 6, textAlign: 'left' },
  field: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  fieldInvalid: { borderColor: colors.danger },
  value: { fontSize: 16, color: colors.ink, textAlign: 'left' },
  placeholder: { fontSize: 16, color: colors.inkFaint, textAlign: 'left' },
  glyph: { fontSize: 16 },
  pickerWrap: { marginTop: spacing.sm, gap: spacing.sm },
  error: { color: colors.danger, fontSize: 13, marginTop: 4, textAlign: 'left' },
});
