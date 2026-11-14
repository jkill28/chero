import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Settings } from '../types';
import { t } from './i18n';

export const DAILY_REMINDER_ID = 1001;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') return true;
      const result = await Notification.requestPermission();
      return result === 'granted';
    }
    return true;
  }

  try {
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display === 'granted') {
      return true;
    }
    const requested = await LocalNotifications.requestPermissions();
    return requested.display === 'granted';
  } catch (error) {
    console.error('Failed to check/request notification permissions', error);
    return false;
  }
}

export async function syncDailyNotification(settings: Settings): Promise<boolean> {
  const enabled = !!settings.dailyNotificationEnabled;
  const timeStr = settings.dailyNotificationTime || '20:00';
  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = Number.isFinite(parseInt(hourStr, 10)) ? parseInt(hourStr, 10) : 20;
  const minute = Number.isFinite(parseInt(minuteStr, 10)) ? parseInt(minuteStr, 10) : 0;

  if (!Capacitor.isNativePlatform()) {
    return true;
  }

  try {
    // Always cancel any existing daily notification before re-scheduling
    await LocalNotifications.cancel({
      notifications: [{ id: DAILY_REMINDER_ID }],
    });

    if (!enabled) {
      return true;
    }

    const hasPermission = await ensureNotificationPermission();
    if (!hasPermission) {
      return false;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: DAILY_REMINDER_ID,
          title: t(settings.language, 'notificationTitle'),
          body: t(settings.language, 'notificationBody'),
          schedule: {
            on: {
              hour,
              minute,
            },
            repeats: true,
            allowWhileIdle: true,
          },
          extra: {
            type: 'daily_transaction_reminder',
          },
        },
      ],
    });

    return true;
  } catch (error) {
    console.error('Failed to sync daily notification schedule', error);
    return false;
  }
}

export function registerNotificationTapListener(onTap: () => void): () => void {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  const listenerPromise = LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (notificationAction) => {
      if (notificationAction.notification.id === DAILY_REMINDER_ID) {
        onTap();
      }
    }
  );

  return () => {
    listenerPromise.then((handle) => handle.remove()).catch(console.error);
  };
}
