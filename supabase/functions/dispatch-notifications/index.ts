import webpush from 'npm:web-push@3.6.7';
import { createServiceRoleClient } from '../_shared/supabase-client.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

function localClock(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}`, weekday: values.weekday };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  const secret = Deno.env.get('NOTIFICATION_CRON_SECRET');
  if (!secret || request.headers.get('Authorization') !== `Bearer ${secret}`) return json({ error: 'Unauthorized' }, 401);

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) return json({ error: 'VAPID keys are not configured' }, 503);
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@fitlab-training.vercel.app', publicKey, privateKey);

  const db = createServiceRoleClient();
  const { data: preferences, error } = await db.from('notification_preferences').select('*');
  if (error) return json({ error: error.message }, 500);
  const now = new Date();
  let sent = 0;
  let failed = 0;
  const issues: string[] = [];

  for (const preference of preferences ?? []) {
    const clock = localClock(now, preference.timezone || 'Europe/Rome');
    const due: { key: string; title: string; body: string; url: string }[] = [];
    if (preference.meal_enabled) {
      const meals = [
        ['breakfast', preference.breakfast_time, 'Colazione', 'È il momento di dare un’occhiata alla colazione prevista nel tuo piano.', '/nutrition'],
        ['lunch', preference.lunch_time, 'Pranzo', 'La pausa pranzo è un buon momento per seguire il tuo piano FitLab.', '/nutrition'],
        ['dinner', preference.dinner_time, 'Cena', 'Dai un’occhiata alla cena prevista nel tuo piano FitLab.', '/nutrition'],
      ] as const;
      for (const [id, time, label, body, url] of meals) {
        if (time === clock.time) due.push({ key: `meal:${id}:${clock.date}`, title: `Promemoria ${label.toLowerCase()}`, body, url });
      }
    }
    const { data: plan } = await db.from('training_plans').select('generated_at,duration_months,plan').eq('user_id', preference.user_id).maybeSingle();
    const elapsedDays = plan ? Math.floor((new Date(`${clock.date}T00:00:00Z`).getTime() - new Date(plan.generated_at).getTime()) / 86_400_000) : -1;
    if (preference.training_enabled && preference.training_time === clock.time && plan && elapsedDays >= 0) {
      const monthIndex = Math.max(1, Math.floor(elapsedDays / 30) + 1);
      const months = plan.plan as { monthIndex: number; weeklySplit: { type: string }[] }[];
      const month = months.find((item) => item.monthIndex === Math.min(monthIndex, plan.duration_months));
      const weekdayIndex = (new Date(`${clock.date}T00:00:00Z`).getUTCDay() + 6) % 7;
      if (month?.weeklySplit?.[weekdayIndex]?.type !== undefined && month.weeklySplit[weekdayIndex].type !== 'rest') {
        due.push({ key: `training:${clock.date}`, title: 'Allenamento FitLab', body: 'La sessione di oggi ti aspetta. Apri il programma e parti con calma.', url: '/training' });
      }
    }
    if (preference.weekly_enabled && clock.weekday === 'Sun' && clock.time === '19:00') {
      due.push({ key: `weekly:${clock.date}`, title: 'La tua settimana FitLab', body: 'Il riepilogo settimanale è pronto: guarda i progressi e scegli il prossimo piccolo passo.', url: '/weekly-summary' });
    }
    if (preference.monthly_enabled && clock.time === '10:00' && plan && elapsedDays > 0 && elapsedDays % 30 === 0) {
      const monthIndex = Math.floor(elapsedDays / 30);
      const { data: checkin } = await db.from('monthly_checkins').select('month_index').eq('user_id', preference.user_id).eq('month_index', monthIndex).maybeSingle();
      if (!checkin) due.push({ key: `monthly:${monthIndex}`, title: 'Check-in FitLab', body: 'Raccontaci com’è andato il mese: useremo i tuoi dati per ricalibrare il prossimo piano.', url: '/monthly-checkin' });
    }
    if (!due.length) continue;

    const { data: subscriptions } = await db.from('push_subscriptions').select('*').eq('user_id', preference.user_id);
    if (!subscriptions?.length) {
      issues.push('no push subscription');
      continue;
    }
    for (const item of due) {
      const { data: prior } = await db.from('notification_dispatches').select('dispatch_key').eq('user_id', preference.user_id).eq('dispatch_key', item.key).maybeSingle();
      if (prior) continue;
      let allSucceeded = true;
      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(item), { TTL: 60 });
        } catch (pushError) {
          allSucceeded = false;
          const statusCode = (pushError as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) await db.from('push_subscriptions').delete().eq('id', subscription.id);
          else {
            console.error('Push delivery failed', preference.user_id, item.key, pushError);
            issues.push(`push ${statusCode ?? ''} ${String((pushError as Error).message ?? pushError).slice(0, 160)}`);
          }
        }
      }
      if (allSucceeded) {
        const { error: insertError } = await db.from('notification_dispatches').insert({ user_id: preference.user_id, dispatch_key: item.key });
        if (!insertError) sent += subscriptions.length;
        else issues.push(`dispatch log: ${insertError.message}`);
      } else failed++;
    }
  }
  return json({ sent, failed, checked: preferences?.length ?? 0, issues: issues.slice(0, 10) });
});
