import { VENDOR_CATEGORIES, type VendorCategory } from '@comot/shared';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen, TextField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { registerVendor } from '@/lib/vendors';
import { colors, radius, spacing, typography } from '@/theme';

export default function VendorSignupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { refresh } = useAuth();

  const [businessName, setBusinessName] = useState('');
  const [categories, setCategories] = useState<VendorCategory[]>([]);
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (cat: VendorCategory) => {
    setCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const valid = businessName.trim().length >= 2 && city.trim().length >= 2 && categories.length >= 1;

  const submit = async () => {
    setBusy(true);
    try {
      await registerVendor({ businessName, categories, city, phone, about });
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('common.error');
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <Text style={styles.title}>{t('vendor.register')}</Text>
      <Text style={styles.subtitle}>{t('vendor.freeNote')}</Text>

      <Card>
        <TextField label={t('vendor.businessName')} value={businessName} onChangeText={setBusinessName} />

        <Text style={styles.label}>{t('vendor.categories')}</Text>
        <View style={styles.catGrid}>
          {VENDOR_CATEGORIES.map((cat) => {
            const active = categories.includes(cat);
            return (
              <Pressable key={cat} onPress={() => toggle(cat)} style={[styles.cat, active && styles.catActive]}>
                <Text style={[styles.catLabel, active && styles.catLabelActive]}>
                  {t(`faults.cat_${cat}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: spacing.md }} />
        <TextField label={t('vendor.city')} value={city} onChangeText={setCity} />
        <TextField label={t('vendor.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextField
          label={t('vendor.about')}
          value={about}
          onChangeText={setAbout}
          multiline
          style={styles.multiline}
        />

        <Button title={t('vendor.submit')} onPress={submit} loading={busy} disabled={!valid} />
      </Card>

      <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { ...typography.title, textAlign: 'left', marginBottom: 4 },
  subtitle: { ...typography.caption, textAlign: 'left', marginBottom: spacing.lg },
  label: { ...typography.label, marginBottom: spacing.sm, textAlign: 'left' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cat: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  catActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  catLabel: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  catLabelActive: { color: colors.primary },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
});
