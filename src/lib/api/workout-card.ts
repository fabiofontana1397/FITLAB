import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

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

/** Sends a photo or PDF of a workout card to the extract-workout-card Edge Function and returns its transcription
 * (one exercise per line), or throws an Error whose message is shown to the person. */
export async function extractWorkoutCardText(file: WorkoutCardFile): Promise<string> {
  const base64 = await toBase64(file);
  if (!base64) throw new Error('Non riesco a leggere il file.');
  const { data, error } = await supabase.functions.invoke('extract-workout-card', { body: { base64, mediaType: file.mediaType } });
  if (error) throw new Error('Non riesco a leggere la scheda in questo momento. Riprova, oppure incolla il testo.');
  const text = (data?.text as string | undefined)?.trim();
  if (!text) throw new Error('Non ho trovato una scheda di allenamento nel file. Prova con una foto più nitida.');
  return text;
}
