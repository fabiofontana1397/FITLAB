import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase/client';

export type NotificationPreferences = {
  meal_enabled: boolean;
  breakfast_time: string;
  lunch_time: string;
  dinner_time: string;
  training_enabled: boolean;
  training_time: string;
  weekly_enabled: boolean;
  monthly_enabled: boolean;
  timezone: string;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  meal_enabled: true,
  breakfast_time: '08:00',
  lunch_time: '13:00',
  dinner_time: '20:00',
  training_enabled: true,
  training_time: '18:00',
  weekly_enabled: true,
  monthly_enabled: true,
  timezone: 'Europe/Rome',
};

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(data ?? {}) };
}

export async function saveNotificationPreferences(userId: string, preferences: NotificationPreferences) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome';
  const { error } = await supabase.from('notification_preferences').upsert(
    { user_id: userId, ...preferences, timezone, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

function decodeVapidKey(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
  const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
  return bytes.buffer as ArrayBuffer;
}

export async function enableWebPush(userId: string): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Le notifiche push sono disponibili nella PWA installata su iPhone o in un browser compatibile.');
  }
  const vapidKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) throw new Error('Configurazione push non completata: manca la chiave pubblica VAPID.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permesso notifiche non concesso. Puoi abilitarlo dalle impostazioni di iPhone.');

  // register() resolves while the worker is still installing; subscribing before it is
  // active fails with "Subscribing for push requires an active service worker". `ready`
  // resolves only once a worker is active, so wait for it (with a limit, in case it never starts).
  await navigator.serviceWorker.register('/service-worker.js');
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Il servizio notifiche non si è avviato. Chiudi e riapri l’app, poi riprova.')), 15000)
    ),
  ]);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeVapidKey(vapidKey),
  });
  const json = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  if (error) throw error;
}

