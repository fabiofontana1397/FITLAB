// Repository module for the body-store.ts reference migration: plain
// async functions operating on the app's existing types (BodyMetricSnapshot,
// BodyPhoto), not raw DB rows — snake_case<->camelCase mapping happens
// here, at this one boundary, so the store and every component above it
// (body.tsx, measurement-trend-modal.tsx, photo-detail-modal.tsx, ...)
// never has to know the difference. This is the pattern each fast-follow
// domain (nutrition, training, plans, onboarding) repeats later.
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';

import { supabase } from '@/lib/supabase/client';
import type { BodyMetricSnapshot } from '@/lib/mock/types';
import type { BodyPhoto, BodyPhotoPose } from '@/store/body-store';

type BodyMetricRow = {
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  shoulders_cm: number | null;
  chest_cm: number | null;
  biceps_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  thigh_cm: number | null;
  resting_heart_rate: number | null;
  sleep_hours: number | null;
  source: string | null;
  is_baseline: boolean | null;
};

function fromRow(row: BodyMetricRow): BodyMetricSnapshot {
  return {
    date: row.date,
    weightKg: row.weight_kg ?? 0,
    bodyFatPct: row.body_fat_pct ?? 0,
    muscleMassKg: row.muscle_mass_kg ?? 0,
    shouldersCm: row.shoulders_cm ?? 0,
    chestCm: row.chest_cm ?? 0,
    bicepsCm: row.biceps_cm ?? 0,
    waistCm: row.waist_cm ?? 0,
    hipsCm: row.hips_cm ?? 0,
    thighCm: row.thigh_cm ?? 0,
    restingHeartRate: row.resting_heart_rate ?? 0,
    sleepHours: row.sleep_hours ?? 0,
    source: (row.source as BodyMetricSnapshot['source']) ?? undefined,
    isBaseline: row.is_baseline ?? undefined,
  };
}

function toRow(userId: string, snapshot: BodyMetricSnapshot) {
  return {
    user_id: userId,
    date: snapshot.date,
    weight_kg: snapshot.weightKg,
    body_fat_pct: snapshot.bodyFatPct,
    muscle_mass_kg: snapshot.muscleMassKg,
    shoulders_cm: snapshot.shouldersCm,
    chest_cm: snapshot.chestCm,
    biceps_cm: snapshot.bicepsCm,
    waist_cm: snapshot.waistCm,
    hips_cm: snapshot.hipsCm,
    thigh_cm: snapshot.thighCm,
    resting_heart_rate: snapshot.restingHeartRate,
    sleep_hours: snapshot.sleepHours,
    source: snapshot.source ?? 'manual',
    is_baseline: snapshot.isBaseline ?? false,
  };
}

export async function fetchBodyMetrics(userId: string): Promise<BodyMetricSnapshot[]> {
  const { data, error } = await supabase
    .from('body_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

/** Covers both addWeightEntry (weight_kg only) and addMeasurement (a
 * partial merge) — the caller has already computed the full merged
 * snapshot (mirroring today's client-side upsert-by-date logic), so this
 * is always a single upsert on the (user_id, date) primary key. */
export async function upsertBodyMetric(userId: string, snapshot: BodyMetricSnapshot): Promise<void> {
  const { error } = await supabase.from('body_metrics').upsert(toRow(userId, snapshot), { onConflict: 'user_id,date' });
  if (error) throw error;
}


type BodyPhotoRow = { id: string; date: string; pose: BodyPhotoPose; storage_path: string };

const BUCKET = 'progress-photos';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function fetchBodyPhotos(userId: string): Promise<BodyPhoto[]> {
  const { data, error } = await supabase
    .from('body_photos')
    .select('id, date, pose, storage_path')
    .eq('user_id', userId)
    .order('date', { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as BodyPhotoRow[];
  if (rows.length === 0) return [];

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      SIGNED_URL_TTL_SECONDS
    );
  if (signError) throw signError;

  return rows.map((row, i) => ({
    id: row.id,
    uri: signed?.[i]?.signedUrl ?? '',
    date: row.date,
    pose: row.pose,
  }));
}

/** Reads the picked photo's local file:// URI via expo-file-system (a
 * naive fetch(uri).blob() is a known-flaky pattern on RN) and uploads the
 * decoded bytes to the private `progress-photos` bucket at
 * `${userId}/${photoId}.jpg`. Returns the photo with its resolved signed
 * URL, ready to replace the optimistic local entry the store already
 * rendered. */
export async function uploadBodyPhoto(userId: string, localUri: string, pose: BodyPhotoPose, date: string): Promise<BodyPhoto> {
  const photoId = `photo-${Date.now()}`;
  const storagePath = `${userId}/${photoId}.jpg`;

  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, decode(base64), {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase
    .from('body_photos')
    .insert({ id: photoId, user_id: userId, date, pose, storage_path: storagePath });
  if (insertError) throw insertError;

  const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (signError) throw signError;

  return { id: photoId, uri: signed.signedUrl, date, pose };
}

export async function deleteBodyPhoto(userId: string, photoId: string, storagePath?: string): Promise<void> {
  const { error } = await supabase.from('body_photos').delete().eq('user_id', userId).eq('id', photoId);
  if (error) throw error;
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  }
}
