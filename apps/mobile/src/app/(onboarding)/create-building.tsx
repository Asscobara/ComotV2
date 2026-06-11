import type { FeeFrequency } from '@comot/shared';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen, Segmented, TextField } from '@/components/ui';
import { createBuilding } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { spacing, typography } from '@/theme';

export default function CreateBuildingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { refresh } = useAuth();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [floors, setFloors] = useState('');
  const [apartments, setApartments] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeDueDay, setFeeDueDay] = useState('1');
  const [frequency, setFrequency] = useState<FeeFrequency>('monthly');
  const [busy, setBusy] = useState(false);

  const valid =
    address.trim().length > 1 &&
    city.trim().length > 1 &&
    Number(floors) >= 1 &&
    Number(apartments) >= 1 &&
    Number(feeDueDay) >= 1 &&
    Number(feeDueDay) <= 28;

  const submit = async () => {
    setBusy(true);
    try {
      await createBuilding({
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        floors: Number(floors),
        apartmentsCount: Number(apartments),
        feeAmount: Number(feeAmount) || 0,
        feeDueDay: Number(feeDueDay),
        feeFrequency: frequency,
      });
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : undefined;
      if (Platform.OS === 'web') window.alert(msg ?? t('common.error'));
      else Alert.alert(t('common.error'), msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <Text style={styles.title}>{t('onboarding.createTitle')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.createBody')}</Text>

      <Card>
        <TextField label={t('onboarding.address')} value={address} onChangeText={setAddress} />
        <TextField label={t('onboarding.city')} value={city} onChangeText={setCity} />
        <TextField label={t('onboarding.buildingName')} value={name} onChangeText={setName} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label={t('onboarding.floors')}
              value={floors}
              onChangeText={setFloors}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label={t('onboarding.apartments')}
              value={apartments}
              onChangeText={setApartments}
              keyboardType="number-pad"
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label={t('onboarding.feeAmount')}
              value={feeAmount}
              onChangeText={setFeeAmount}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label={t('onboarding.feeDueDay')}
              value={feeDueDay}
              onChangeText={setFeeDueDay}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <Text style={styles.label}>{t('onboarding.feeFrequency')}</Text>
        <Segmented
          options={[
            { value: 'monthly', label: t('onboarding.freq_monthly') },
            { value: 'bimonthly', label: t('onboarding.freq_bimonthly') },
            { value: 'quarterly', label: t('onboarding.freq_quarterly') },
            { value: 'yearly', label: t('onboarding.freq_yearly') },
          ]}
          value={frequency}
          onChange={setFrequency}
        />

        <View style={{ height: spacing.lg }} />
        <Button title={t('onboarding.createBuilding')} onPress={submit} loading={busy} disabled={!valid} />
      </Card>

      <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { ...typography.title, textAlign: 'left', marginBottom: 4 },
  subtitle: { ...typography.caption, textAlign: 'left', marginBottom: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  label: { ...typography.label, marginBottom: 6, textAlign: 'left' },
});
