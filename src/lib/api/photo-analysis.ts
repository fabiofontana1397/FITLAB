import { supabase } from '@/lib/supabase/client';

/** Calls the analyze-photo Edge Function — real Claude vision looking at the
 * actual photo pixels (posture, visible definition, symmetry, and a
 * comparison against the previous same-pose photo when given). On-demand
 * only: the client decides when to call this, never automatically on every
 * photo view, since it's a real per-call cost/latency unlike the
 * deterministic quick tip in lib/assistant/photo-insight.ts. Returns null on
 * any failure — callers must fall back to the deterministic insight. */
export async function analyzePhoto(photoId: string, previousPhotoId?: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('analyze-photo', {
      body: { photoId, previousPhotoId },
    });
    if (error) throw error;
    return (data?.observation as string) ?? null;
  } catch (err) {
    console.warn('analyze-photo unavailable', err);
    return null;
  }
}
