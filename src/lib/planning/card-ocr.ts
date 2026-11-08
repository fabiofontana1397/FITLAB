import type { WorkoutCardFile } from '@/lib/api/workout-card';

/** Free on-device reading of a card (no server, no credits). Only the web build can do it; elsewhere it returns null
 * and the caller falls back to the server. See card-ocr.web.ts. */
export async function readCardLocally(_file: WorkoutCardFile, _onProgress?: (label: string) => void): Promise<string | null> {
  return null;
}
