import type { Session } from '@supabase/supabase-js';
import type { Building, Membership, Profile, Vendor } from '@comot/shared';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { fetchMyMembership, fetchMyProfile } from './api';
import { supabase } from './supabase';
import { fetchMyVendorProfile } from './vendors';

WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = 'google' | 'apple' | 'facebook';

type MembershipWithBuilding = Membership & { building: Building | null };

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  membership: MembershipWithBuilding | null;
  vendor: Vendor | null;
  refresh: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>;
  signInWithProvider: (provider: SocialProvider) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<MembershipWithBuilding | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);

  const loadAccount = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setMembership(null);
      setVendor(null);
      return;
    }
    try {
      const [p, m, v] = await Promise.all([
        fetchMyProfile(),
        fetchMyMembership(),
        fetchMyVendorProfile().catch(() => null),
      ]);
      setProfile(p);
      setMembership(m);
      setVendor(v);
    } catch {
      setProfile(null);
      setMembership(null);
      setVendor(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadAccount(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return;
      setSession(s);
      await loadAccount(s);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadAccount]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await loadAccount(data.session);
  }, [loadAccount]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (error) throw error;
    return { needsConfirmation: !data.session };
  }, []);

  const signInWithProvider = useCallback(async (provider: SocialProvider) => {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({ provider });
      if (error) throw error;
      return;
    }

    const redirectTo = AuthSession.makeRedirectUri();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) throw error ?? new Error('OAuth failed');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
      const code = new URL(result.url).searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      loading,
      session,
      profile,
      membership,
      vendor,
      refresh,
      signInWithPassword,
      signUpWithPassword,
      signInWithProvider,
      signOut,
    }),
    [loading, session, profile, membership, vendor, refresh, signInWithPassword, signUpWithPassword, signInWithProvider, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
