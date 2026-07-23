import { supabase, TENANT_ID } from '@/integrations/supabase/client';

// Client half of the Web Push feature — registers the push-sw.js service
// worker, requests notification permission, subscribes with the browser's
// Push API, and persists the subscription to push_subscriptions so the
// send-push-notification edge function can find it later.

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}

/** Current permission + whether this device already has a stored subscription. */
export async function getPushStatus(): Promise<{ permission: NotificationPermission | 'unsupported'; subscribed: boolean }> {
  if (!isPushSupported()) return { permission: 'unsupported', subscribed: false };
  const registration = await navigator.serviceWorker.getRegistration('/push-sw.js');
  const subscription = await registration?.pushManager.getSubscription();
  return { permission: Notification.permission, subscribed: !!subscription };
}

/** Requests permission (if needed), subscribes, and stores the subscription for this user. */
export async function subscribeToPush(userId: string): Promise<{ error?: string }> {
  if (!isPushSupported()) return { error: 'Push notifications are not supported in this browser.' };

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return { error: 'Push notifications are not configured for this deployment.' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { error: 'Notification permission was not granted.' };

  const registration = await navigator.serviceWorker.register('/push-sw.js');
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const keyBuffer = subscription.getKey('p256dh');
  const authBuffer = subscription.getKey('auth');
  if (!keyBuffer || !authBuffer) return { error: 'Failed to read subscription keys.' };

  const toBase64Url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const { error } = await supabase.from('push_subscriptions').upsert({
    tenant_id: TENANT_ID,
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: toBase64Url(keyBuffer),
    auth_key: toBase64Url(authBuffer),
    user_agent: navigator.userAgent,
    last_used_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });

  if (error) return { error: error.message };
  return {};
}

/** Unsubscribes this device and removes its stored subscription row. */
export async function unsubscribeFromPush(): Promise<{ error?: string }> {
  if (!isPushSupported()) return {};
  const registration = await navigator.serviceWorker.getRegistration('/push-sw.js');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return {};

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) return { error: error.message };
  return {};
}
