import { VENDOR_CATEGORIES, type FaultCategory } from '@comot/shared';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_GLYPHS } from '@/components/fault-bits';
import { Button, Card, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { reportFault } from '@/lib/faults';
import { colors, radius, spacing, typography } from '@/theme';

export default function ReportFaultScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { membership } = useAuth();

  const [category, setCategory] = useState<FaultCategory>('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!membership?.building) return;
    setBusy(true);
    try {
      const id = await reportFault({
        buildingId: membership.building.id,
        category,
        title,
        description,
        location,
      });
      if (Platform.OS === 'web') window.alert(t('faults.reportedOk'));
      else Alert.alert(t('faults.reportedOk'));
      router.replace({ pathname: '/faults/[id]', params: { id } });
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
        <Text style={styles.label}>{t('faults.category')}</Text>
        <View style={styles.catGrid}>
          {VENDOR_CATEGORIES.map((cat) => {
            const active = category === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[styles.cat, active && styles.catActive]}
              >
                <Text style={styles.catGlyph}>{CATEGORY_GLYPHS[cat]}</Text>
                <Text style={[styles.catLabel, active && styles.catLabelActive]}>
                  {t(`faults.cat_${cat}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: spacing.md }} />
        <TextField label={t('faults.faultTitle')} value={title} onChangeText={setTitle} />
        <TextField
          label={t('faults.description')}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={styles.multiline}
        />
        <TextField label={t('faults.location')} value={location} onChangeText={setLocation} />

        <Button
          title={t('faults.submit')}
          onPress={submit}
          loading={busy}
          disabled={title.trim().length < 2}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, marginBottom: spacing.sm, textAlign: 'left' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  catActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  catGlyph: { fontSize: 16 },
  catLabel: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  catLabelActive: { color: colors.primary },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
});
