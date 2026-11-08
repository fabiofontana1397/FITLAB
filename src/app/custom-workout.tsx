import { useMemo, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, Platform, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { AppTextInput } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserContext } from '@/hooks/use-user-context';
import { hapticSuccess } from '@/lib/haptics';
import { extractWorkoutCardText, type WorkoutCardFile } from '@/lib/api/workout-card';
import { parseCustomWorkout } from '@/lib/planning/custom-workout';
import { useOnboardingStore } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';

const EXAMPLE = `Lunedì - Petto e tricipiti
Panca piana 4x8 rec 90s
Croci ai cavi 3x12
Pushdown ai cavi 3x12

Martedì - Riposo

Mercoledì - Schiena
Trazioni alla sbarra 4x8
Rematore con bilanciere 4x10 rec 2 min`;

/** Insert a workout card the person already has: the app turns it into their training plan, whether or not one exists. */
export default function CustomWorkoutScreen() {
  const theme = useTheme();
  const answers = useOnboardingStore((s) => s.answers);
  const ctx = useUserContext();
  const current = usePlanStore((s) => s.trainingPlan);
  const importCustomTraining = usePlanStore((s) => s.importCustomTraining);
  const restoreGeneratedTraining = usePlanStore((s) => s.restoreGeneratedTraining);
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  // Photo or PDF → the app reads it and fills the text box, so the person can check and fix it before saving.
  const readFile = async (load: () => Promise<WorkoutCardFile | null>) => {
    setReadError(null);
    try {
      const file = await load();
      if (!file) return;
      setReading(true);
      const extracted = await extractWorkoutCardText(file);
      setText(extracted);
      setTouched(true);
    } catch (err) {
      setReadError(err instanceof Error ? err.message : 'Non riesco a leggere la scheda.');
    } finally {
      setReading(false);
    }
  };

  const pickImage = (source: 'camera' | 'library') =>
    readFile(async () => {
      const permission =
        source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Serve il permesso per usare ' + (source === 'camera' ? 'la fotocamera.' : 'le foto.'));
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, base64: true };
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return null;
      return { uri: asset.uri, base64: asset.base64, mediaType: asset.mimeType ?? 'image/jpeg' };
    });

  const pickPdf = () =>
    readFile(async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return null;
      const mediaType = asset.mimeType ?? (asset.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      return { uri: asset.uri, mediaType };
    });

  const parsed = useMemo(() => (text.trim() ? parseCustomWorkout(text) : null), [text]);
  const isCustom = current?.source === 'custom';

  const apply = (close: () => void) => {
    setTouched(true);
    if (!parsed || !parsed.ok) return;
    const commit = () => {
      importCustomTraining(answers, parsed.week, ctx.weightKg > 0 ? ctx.weightKg : undefined);
      hapticSuccess();
      close();
    };
    if (current) {
      Alert.alert(
        'Sostituire il programma?',
        'La tua scheda prenderà il posto del programma attuale. Dieta e calorie verranno adattate ai nuovi allenamenti.',
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Sostituisci', style: 'destructive', onPress: commit },
        ]
      );
    } else {
      commit();
    }
  };

  const restore = (close: () => void) => {
    Alert.alert('Tornare al programma dell’app?', 'La tua scheda verrà sostituita da un programma generato in base al questionario.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Torna al programma',
        onPress: () => {
          void restoreGeneratedTraining(answers, ctx.weightKg > 0 ? ctx.weightKg : undefined);
          close();
        },
      },
    ]);
  };

  return (
    <SheetScreen title="La tua scheda" eyebrow="Inseriscila e l’app la mette nel programma" fallbackHref="/training-plan">
      {(close) => (
        <>
          <ThemedText type="caption" themeColor="textSecondary">
            Scatta una foto, scegli un PDF o scrivi/incolla la scheda: un esercizio per riga, con serie e ripetizioni (es. “Panca
            piana 4x8”) e, se vuoi, il recupero (“rec 90s”) e il tempo di esecuzione (“tempo 3-1-1”). Metti il giorno sopra gli esercizi: “Lunedì – Petto”. Un giorno di riposo è “Martedì –
            Riposo”. Funziona anche se hai già un programma: lo sostituisce.
          </ThemedText>

          {isCustom ? (
            <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.three, gap: Spacing.one }}>
              <ThemedText type="smallBold">Stai già usando una tua scheda</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Inserendone un’altra sostituisci quella attuale.
              </ThemedText>
            </GlassSurface>
          ) : null}

          <View style={styles.sourceRow}>
            {Platform.OS !== 'web' ? <PrimaryButton label="Scatta foto" icon="camera" variant="ghost" dense disabled={reading} onPress={() => void pickImage('camera')} style={styles.sourceButton} /> : null}
            <PrimaryButton label="Da foto" icon="image" variant="ghost" dense disabled={reading} onPress={() => void pickImage('library')} style={styles.sourceButton} />
            <PrimaryButton label="Da PDF" icon="file" variant="ghost" dense disabled={reading} onPress={() => void pickPdf()} style={styles.sourceButton} />
          </View>

          {reading ? (
            <View style={styles.readingRow}>
              <ActivityIndicator color={theme.accent} />
              <ThemedText type="caption" themeColor="textSecondary">
                Leggo la scheda…
              </ThemedText>
            </View>
          ) : null}
          {readError ? (
            <ThemedText type="caption" style={{ color: theme.danger }}>
              {readError}
            </ThemedText>
          ) : null}
          {text && touched && !reading ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Controlla il testo qui sotto: puoi correggere quello che non è stato letto bene.
            </ThemedText>
          ) : null}

          <AppTextInput
            value={text}
            onChangeText={setText}
            multiline
            autoCapitalize="sentences"
            autoCorrect={false}
            placeholder={EXAMPLE}
            placeholderTextColor={theme.textTertiary}
            accessibilityLabel="Testo della scheda di allenamento"
            textAlignVertical="top"
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />

          {parsed && !parsed.ok && (touched || text.length > 30) ? (
            <ThemedText type="caption" style={{ color: theme.danger }}>
              {parsed.error}
            </ThemedText>
          ) : null}

          {parsed?.ok ? (
            <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.three, gap: Spacing.two }}>
              <ThemedText type="smallBold">Ecco cosa ho capito</ThemedText>
              {parsed.week.map((day) => (
                <View key={day.weekday} style={styles.previewRow}>
                  <ThemedText type="smallBold" style={styles.previewDay}>
                    {day.weekday}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary" style={{ flex: 1 }}>
                    {day.type === 'workout'
                      ? `${day.title} · ${(day.exercises ?? []).length} esercizi`
                      : day.type === 'cardio'
                        ? day.note ?? day.title
                        : 'Riposo'}
                  </ThemedText>
                </View>
              ))}
              {parsed.warnings.length > 0 ? (
                <ThemedText type="caption" themeColor="textTertiary">
                  {parsed.warnings.slice(0, 3).join('\n')}
                </ThemedText>
              ) : null}
            </GlassSurface>
          ) : null}

          <PrimaryButton
            label={current ? 'Sostituisci il programma con la mia scheda' : 'Inserisci nel programma'}
            icon="check"
            disabled={!parsed?.ok}
            onPress={() => apply(close)}
          />
          {isCustom ? <PrimaryButton label="Torna al programma dell’app" variant="ghost" onPress={() => restore(close)} /> : null}
          {!text ? (
            <PrimaryButton label="Usa un esempio" variant="outline" onPress={() => setText(EXAMPLE)} />
          ) : null}
        </>
      )}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 220,
    borderRadius: Radius.large,
    padding: Spacing.three,
    fontSize: 15,
    lineHeight: 21,
  },
  sourceRow: { flexDirection: 'row', gap: Spacing.two },
  sourceButton: { flex: 1 },
  readingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  previewRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  previewDay: { width: 34 },
});
