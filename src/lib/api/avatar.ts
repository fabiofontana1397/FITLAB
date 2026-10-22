// The profile photo lives in the private `progress-photos` bucket at
// `${userId}/avatar.jpg` — the bucket's policies already scope every user to their
// own folder, and it needs no database column. Photos in Progressi are named
// `${userId}/photo-<timestamp>.jpg`, so this file can never collide with one.
import { decode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase/client';

const BUCKET = 'progress-photos';
const avatarPath = (userId: string) => `${userId}/avatar.jpg`;

export type AvatarFetch = { status: 'found'; uri: string } | { status: 'none' } | { status: 'error' };

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Uploads the photo (a `data:` URI, as picked in Profilo). Anything else, such as a
 * local file path, has nothing portable to upload and is skipped. */
export async function uploadAvatar(userId: string, dataUri: string): Promise<void> {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUri);
  if (!match) return;
  const { error } = await supabase.storage.from(BUCKET).upload(avatarPath(userId), decode(match[2]), {
    contentType: match[1],
    upsert: true,
  });
  if (error) throw error;
}

/** Downloads the photo as a `data:` URI. "none" means the server has no photo (anymore); a failed
 * request is "error", so a network blip is never mistaken for "no photo". Goes through a fresh
 * signed URL fetched with `no-store`: a plain download can be answered from the browser's
 * HTTP cache and keep showing a photo that was replaced or removed on another device. */
export async function fetchAvatar(userId: string): Promise<AvatarFetch> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(avatarPath(userId), 60);
  if (error || !data?.signedUrl) return /not found/i.test(error?.message ?? '') ? { status: 'none' } : { status: 'error' };
  const response = await fetch(data.signedUrl, { cache: 'no-store' });
  if (response.status === 400 || response.status === 404) return { status: 'none' };
  if (!response.ok) return { status: 'error' };
  return { status: 'found', uri: await blobToDataUri(await response.blob()) };
}

export async function removeAvatar(userId: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([avatarPath(userId)]);
  if (error) throw error;
}
