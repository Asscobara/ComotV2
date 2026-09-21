import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

import type { DateTimeFieldProps } from './date-time-field.types';

/**
 * `<input type="datetime-local">` gives every browser's own calendar and clock
 * widget for free, including on mobile Safari, which is what the home-screen
 * install runs. The native counterpart in date-time-field.tsx uses the platform
 * pickers instead; @expo/ui's picker renders nothing at all on web.
 */

/** datetime-local speaks local wall-clock time as `YYYY-MM-DDTHH:mm`, never UTC. */
function toInputValue(date: Date | null): string {
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function fromInputValue(value: string): Date | null {
  if (!value) return null;
  // Parsed field by field: `new Date(string)` treats some of these as UTC.
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function DateTimeField({
  label,
  value,
  onChange,
  error,
  minimumDate,
  testID,
}: DateTimeFieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <input
        type="datetime-local"
        data-testid={testID}
        value={toInputValue(value)}
        min={minimumDate ? toInputValue(minimumDate) : undefined}
        onChange={(event) => onChange(fromInputValue(event.target.value))}
        // Dates stay left-to-right even when the surrounding page is RTL;
        // browsers otherwise reorder the day/month/year segments.
        dir="ltr"
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderStyle: 'solid',
          borderColor: error ? colors.danger : colors.border,
          borderRadius: radius.sm,
          padding: '11px 14px',
          fontSize: 16,
          fontFamily: 'inherit',
          color: colors.ink,
          width: '100%',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...typography.label, marginBottom: 6, textAlign: 'left' },
  error: { color: colors.danger, fontSize: 13, marginTop: 4, textAlign: 'left' },
});
