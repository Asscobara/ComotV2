import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform } from 'react-native';

/**
 * True when the request never reached the backend: no connectivity, DNS
 * failure, or a Supabase project that has been paused (free projects pause
 * after a week of inactivity and stop resolving). Worth separating from
 * server-side rejections because the user's remedy is completely different,
 * and because the raw message — "Failed to fetch" — explains nothing.
 */
export function isOfflineError(e: unknown): boolean {
  // The fetch spec rejects with a TypeError when a request cannot be made.
  if (e instanceof TypeError) return true;
  const message = e instanceof Error ? e.message : String(e);
  return /failed to fetch|fetch failed|network request failed|load failed|networkerror|err_name_not_resolved|err_internet_disconnected|err_connection/i.test(
    message,
  );
}

/** Platform-appropriate modal message; React Native has no window.alert. */
export function alertBox(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

/** Reports a caught error to the user, naming the unreachable-backend case. */
export function useErrorAlert() {
  const { t } = useTranslation();
  return useCallback(
    (e: unknown, fallbackTitle?: string) => {
      if (isOfflineError(e)) {
        alertBox(t('common.offlineTitle'), t('common.offlineBody'));
        return;
      }
      alertBox(fallbackTitle ?? t('common.error'), e instanceof Error ? e.message : undefined);
    },
    [t],
  );
}
