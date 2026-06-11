import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth';
import { initI18n } from '@/lib/i18n';
import { colors } from '@/theme';

function RootNavigator() {
  const { loading, session, membership, vendor } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgSoft }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const signedIn = !!session;
  const isActiveMember = signedIn && membership?.status === 'active';
  const isVendor = signedIn && !isActiveMember && !!vendor;
  const needsOnboarding = signedIn && !isActiveMember && !isVendor;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={isVendor}>
        <Stack.Screen name="(vendor)" />
      </Stack.Protected>
      <Stack.Protected guard={isActiveMember}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tenants" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="faults" />
        <Stack.Screen name="events" />
        <Stack.Screen name="budget" />
        <Stack.Screen name="reports" />
      </Stack.Protected>
      {/* registered after the home groups so it never becomes the initial screen */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="notifications" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  if (!i18nReady) {
    return <View style={{ flex: 1, backgroundColor: colors.bgSoft }} />;
  }

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
