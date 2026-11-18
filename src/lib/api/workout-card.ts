import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

import { readCardLocally } from '@/lib/planning/card-ocr';
import { supabase } from '@/lib/supabase/client';

export type WorkoutCardFile = { uri: string; mediaType: string; base64?: string | null };

async function toBase64(file: WorkoutCardFile): Promise<string> {
  if (file.base64) return file.base64;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
  return FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
}

export type ExtractedCard = {
  text: string;
  /** Shown under the text when the reading needs a check (e.g. only the raw text could be read). */
  note?: string;
};

/**
 * Sends a photo or PDF of a workout card or a diet to the extract-workout-card Edge Function and returns its
 * transcription, or throws an Error whose message is shown to the person.
 *
 * On the web the file is read first in the browser, for free. That raw text is used only when `accept` says the
 * app can follow it: a diet laid out as a table, or with the dietitian's notes mixed in, goes to the server, which
 * rewrites it in the expected shape. If the server is not reachable, the raw text still comes back to be fixed by hand.
 */
export async function extractWorkoutCardText(
  file: WorkoutCardFile,
  onProgress?: (label: string) => void,
  kind: 'training' | 'diet' = 'training',
  accept?: (text: string) => boolean,
): Promise<ExtractedCard> {
  const what = kind === 'diet' ? 'la dieta' : 'la scheda';
  const local = await readCardLocally(file, onProgress);
  if (local && (!accept || accept(local))) return { text: local };
  try {
    return { text: await readOnServer(file, kind, what, onProgress) };
  } catch (err) {
    if (!local) throw err;
    const reason = err instanceof Error ? err.message : '';
    return {
      text: local,
      note: `Ho letto il testo del file ma non riesco a riordinarlo da solo${reason ? ` (${reason.replace(/\.$/, '')})` : ''}. Sistemalo qui sotto seguendo l’esempio.`,
    };
  }
}

async function readOnServer(file: WorkoutCardFile, kind: 'training' | 'diet', what: string, onProgress?: (label: string) => void): Promise<string> {
  onProgress?.(`Leggo ${what}…`);
  const base64 = await toBase64(file);
  if (!base64) throw new Error('Non riesco a leggere il file.');
  const { data, error } = await supabase.functions.invoke('extract-workout-card', { body: { base64, mediaType: file.mediaType, kind } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    let detail = '';
    try {
      const body = await (error as { context?: Response }).context?.json?.();
      detail = typeof body?.error === 'string' ? body.error : '';
    } catch {
      /* no readable body */
    }
    if (status === 404) throw new Error('La lettura da foto non è ancora attiva sul server (funzione extract-workout-card non pubblicata).');
    if (status === 401) throw new Error('Sessione scaduta: esci e rientra, poi riprova.');
    if (/ANTHROPIC_API_KEY/i.test(detail)) throw new Error(`Sul server manca la chiave ANTHROPIC_API_KEY per leggere ${what}.`);
    if (detail) throw new Error(`Non riesco a leggere ${what}: ${detail}`);
    throw new Error(`Non riesco a leggere ${what}${status ? ` (errore ${status})` : ''}. Riprova, oppure incolla il testo.`);
  }
  const text = (data?.text as string | undefined)?.trim();
  if (!text) throw new Error(`Non ho trovato ${kind === 'diet' ? 'una dieta' : 'una scheda di allenamento'} nel file. Prova con una foto più nitida.`);
  return text;
}
