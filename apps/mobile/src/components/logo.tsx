import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

export function Logo({ size = 56, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <View style={styles.row}>
      <Image
        source={require('../../assets/images/logo-mark.png')}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
      {withWordmark ? <Text style={[styles.wordmark, { fontSize: size * 0.62 }]}>ComOt</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { fontWeight: '900', color: colors.ink, letterSpacing: -0.5 },
});
