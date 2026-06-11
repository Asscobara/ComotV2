import type { FaultWithReporter } from '@comot/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_GLYPHS, FaultStatusTag } from '@/components/fault-bits';
import { Button, Card, EmptyState, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { fetchFaults } from '@/lib/faults';
import { colors, radius, spacing, typography } from '@/theme';

export default function FaultsListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { membership } = useAuth();

  const [faults, setFaults] = useState<FaultWithReporter[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!membership?.building) return;
        try {
          const data = await fetchFaults(membership.building.id);
          if (active) setFaults(data);
        } catch {
          // empty state shown
        }
      })();
      return () => {
        active = false;
      };
    }, [membership]),
  );

  return (
    <Screen>
      <Button title={t('faults.report')} onPress={() => router.push('/faults/new')} />
      <View style={{ height: spacing.lg }} />

      {faults.length === 0 ? (
        <EmptyState icon="✅" title={t('faults.empty')} />
      ) : (
        faults.map((f) => (
          <Pressable key={f.id} onPress={() => router.push({ pathname: '/faults/[id]', params: { id: f.id } })}>
            <Card style={styles.row}>
              <View style={styles.glyphWrap}>
                <Text style={styles.glyph}>{CATEGORY_GLYPHS[f.category]}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.faultTitle}>{f.title}</Text>
                <Text style={styles.meta}>
                  {t('faults.reportedBy', { name: f.reporter?.full_name || '—' })}
                  {' · '}
                  {new Date(f.created_at).toLocaleDateString()}
                </Text>
              </View>
              <FaultStatusTag status={f.status} />
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  flex: { flex: 1 },
  faultTitle: { ...typography.body, fontWeight: '700', textAlign: 'left' },
  meta: { ...typography.caption, marginTop: 1, textAlign: 'left' },
});
