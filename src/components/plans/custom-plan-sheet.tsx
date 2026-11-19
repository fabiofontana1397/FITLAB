import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { AppTextInput } from '@/components/ui/app-text';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserContext } from '@/hooks/use-user-context';
import { hapticSuccess, hapticTap } from '@/lib/haptics';
import { extractWorkoutCardText, type WorkoutCardFile } from '@/lib/api/workout-card';
import { parseCustomDiet } from '@/lib/planning/custom-diet';
import { parseCustomWorkout } from '@/lib/planning/custom-workout';
import { useOnboardingStore } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';

export type CustomPlanKind = 'training' | 'diet';

/** Exit durations of the confirmation popup and of the sheet (TimingExit, 240 ms), with a little slack. */
const POPUP_EXIT_MS = 200;
const SHEET_EXIT_MS = 280;

const COPY = {
  training: {
    title: 'La tua scheda',
    eyebrow: 'Caricala e seguila al posto del programma',
    textHeader: 'Testo della scheda',
    textFooter: 'Un esercizio per riga con serie e ripetizioni (“Panca piana 4x8”); il giorno sopra i suoi esercizi (“Lunedì – Petto”). Recupero e tempo sono facoltativi (“rec 90s”, “tempo 3-1-1”).',
    inputLabel: 'Testo della scheda di allenamento',
    reading: 'Leggo la scheda…',
    readError: 'Non riesco a leggere la scheda.',
    apply: 'Usa questa scheda',
    replaceTitle: 'Sostituire il programma?',
    replaceBody: 'La tua scheda prende il posto del programma attuale. Dieta e calorie si adattano ai nuovi allenamenti.',
    example: `Lunedì - Petto e tricipiti
Panca piana 4x8 rec 90s
Croci ai cavi 3x12
Pushdown ai cavi 3x12

Martedì - Riposo

Mercoledì - Schiena
Trazioni alla sbarra 4x8
Rematore con bilanciere 4x10 rec 2 min`,
  },
  diet: {
    title: 'La tua dieta',
    eyebrow: 'Caricala e seguila al posto del piano alimentare',
    textHeader: 'Testo della dieta',
    textFooter: 'Il nome del pasto su una riga (“Colazione”, “Pranzo”…) e sotto un alimento per riga con la quantità (“Riso basmati 80g”). Se i giorni sono diversi, metti il giorno sopra i suoi pasti (“Lunedì”).',
    inputLabel: 'Testo della dieta',
    reading: 'Leggo la dieta…',
    readError: 'Non riesco a leggere la dieta.',
    apply: 'Usa questa dieta',
    replaceTitle: 'Sostituire il piano alimentare?',
    replaceBody: 'La tua dieta prende il posto del piano attuale e viene seguita così com’è.',
    example: `Colazione
Yogurt greco 200g
Fiocchi d'avena 50g
1 banana

Pranzo
Riso basmati 80g
Petto di pollo 150g
Zucchine 200g
1 cucchiaio olio evo

Spuntino
Mandorle 30g

Cena
Salmone 150g
Patate 250g
Insalata a piacere`,
  },
} as const;

/**
 * Loading a card or a diet the person already has: from a photo, a PDF or typed text. The text is always shown for
 * review, with what the app understood right under it, and only then put in place of the current plan.
 */
export function CustomPlanSheet({ kind }: { kind: CustomPlanKind }) {
  const theme = useTheme();
  const copy = COPY[kind];
  const answers = useOnboardingStore((s) => s.answers);
  const ctx = useUserContext();
  const current = usePlanStore((s) => (kind === 'training' ? s.trainingPlan : s.dietPlan));
  const importCustomTraining = usePlanStore((s) => s.importCustomTraining);
  const importCustomDiet = usePlanStore((s) => s.importCustomDiet);
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const [reading, setReading] = useState(false);
  const [readingLabel, setReadingLabel] = useState<string>(copy.reading);
  const [readError, setReadError] = useState<string | null>(null);
  const [readNote, setReadNote] = useState<string | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  // Measured (padding included), so long lines that wrap are counted too: the box never cuts the first lines off.
  const [contentHeight, setContentHeight] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Photo or PDF → the app reads it and fills the text box, so the person can check and fix it before saving.
  const readFile = async (load: () => Promise<WorkoutCardFile | null>) => {
    setReadError(null);
    setReadNote(null);
    try {
      const file = await load();
      if (!file) return;
      setReading(true);
      setReadingLabel(copy.reading);
      // The text read on the device is kept only if the app can follow it; otherwise the server rewrites it.
      const accept = (raw: string) => (kind === 'diet' ? parseCustomDiet(raw).ok : parseCustomWorkout(raw).ok);
      const extracted = await extractWorkoutCardText(file, setReadingLabel, kind, accept);
      setText(extracted.text);
      setReadNote(extracted.note ?? null);
      setDayIndex(0);
      setTouched(true);
    } catch (err) {
      setReadError(err instanceof Error ? err.message : copy.readError);
    } finally {
      setReading(false);
    }
  };

  const pickImage = (source: 'camera' | 'library') =>
    readFile(async () => {
      const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
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

  const workout = useMemo(() => (kind === 'training' && text.trim() ? parseCustomWorkout(text) : null), [kind, text]);
  const diet = useMemo(() => (kind === 'diet' && text.trim() ? parseCustomDiet(text) : null), [kind, text]);
  const parsed = workout ?? diet;
  const weightKg = ctx.weightKg > 0 ? ctx.weightKg : undefined;

  // One movement at a time: the confirmation popup slides away, then the sheet, and only once both are gone is the
  // plan rebuilt. Rebuilding (and re-rendering the Piani page under the sheet) while they moved was the stutter.
  const commit = (close: () => void) => {
    const importPlan = workout?.ok
      ? () => importCustomTraining(answers, workout.week, weightKg)
      : diet?.ok
        ? () => importCustomDiet(answers, diet.week, weightKg)
        : null;
    if (!importPlan) return;
    hapticSuccess();
    const fromPopup = confirmOpen;
    setConfirmOpen(false);
    setTimeout(close, fromPopup ? POPUP_EXIT_MS : 0);
    setTimeout(importPlan, (fromPopup ? POPUP_EXIT_MS : 0) + SHEET_EXIT_MS);
  };

  const apply = (close: () => void) => {
    setTouched(true);
    if (!parsed?.ok) return;
    // Replacing a plan in progress asks first; a first plan goes straight in.
    if (current) setConfirmOpen(true);
    else commit(close);
  };

  // The diet's distinct menus: one when every day is the same, otherwise one per weekday.
  const dietDays = diet?.ok ? diet.week : [];
  const sameEveryDay = dietDays.length > 0 && dietDays.every((d) => menuKey(d.meals) === menuKey(dietDays[0].meals));
  const shownDay = dietDays[Math.min(dayIndex, Math.max(0, dietDays.length - 1))];

  const preview: { day: string; summary: string; value?: string }[] = workout?.ok
    ? workout.week.map((day) => ({
        day: day.weekday,
        summary: day.type === 'workout' ? day.title || 'Allenamento' : day.type === 'cardio' ? (day.note ?? day.title) : 'Riposo',
        value: day.type === 'workout' ? `${(day.exercises ?? []).length} esercizi` : undefined,
      }))
    : [];
  const notes = parsed?.ok
    ? [
        ...(diet?.ok && diet.unknownFoods.length > 0
          ? [`Senza calorie, perché non sono nel catalogo: ${diet.unknownFoods.slice(0, 6).join(', ')}${diet.unknownFoods.length > 6 ? '…' : ''}. Restano nel piano così come li hai scritti.`]
          : []),
        ...parsed.warnings.slice(0, 3),
      ]
    : [];
  const showError = parsed && !parsed.ok && (touched || text.length > 30);

  return (
    <SheetScreen title={copy.title} eyebrow={copy.eyebrow} fallbackHref="/plans" contentContainerStyle={styles.content}>
      {(close) => (
        <>
          <ListGroup header="Importa" insetSeparators footer="La foto o il PDF vengono letti e trascritti qui sotto: controlla il testo prima di usarlo.">
            {Platform.OS !== 'web' ? <ListRow key="camera" title="Scatta una foto" icon="camera" iconColor={theme.accent} onPress={reading ? undefined : () => void pickImage('camera')} /> : null}
            <ListRow key="library" title="Scegli dalle foto" icon="image" iconColor={theme.accent} onPress={reading ? undefined : () => void pickImage('library')} />
            <ListRow key="pdf" title="Importa un PDF" icon="file" iconColor={theme.accent} onPress={reading ? undefined : () => void pickPdf()} />
          </ListGroup>

          {reading ? (
            <View style={styles.status} accessibilityLiveRegion="polite">
              <ActivityIndicator color={theme.accent} />
              <ThemedText type="small" themeColor="textSecondary">
                {readingLabel}
              </ThemedText>
            </View>
          ) : null}
          {readNote ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.inset} accessibilityLiveRegion="polite">
              {readNote}
            </ThemedText>
          ) : null}
          {readError ? (
            <ThemedText type="small" style={[styles.inset, { color: theme.danger }]} accessibilityRole="alert">
              {readError}
            </ThemedText>
          ) : null}

          <View style={styles.group}>
            <View style={styles.headerRow}>
              <ThemedText type="label" themeColor="textSecondary" accessibilityRole="header">
                {copy.textHeader}
              </ThemedText>
              {text ? (
                <Pressable
                  onPress={() => {
                    hapticTap();
                    setText('');
                    setTouched(false);
                    setReadNote(null);
                    setDayIndex(0);
                  }}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Cancella il testo"
                >
                  <ThemedText type="small" style={{ color: theme.accent, fontWeight: '600' }}>
                    Cancella
                  </ThemedText>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    hapticTap();
                    setText(copy.example);
                  }}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Riempi con un esempio"
                >
                  <ThemedText type="small" style={{ color: theme.accent, fontWeight: '600' }}>
                    Usa un esempio
                  </ThemedText>
                </Pressable>
              )}
            </View>
            <AppTextInput
              value={text}
              onChangeText={setText}
              onBlur={() => setTouched(true)}
              multiline
              autoCapitalize="sentences"
              autoCorrect={false}
              placeholder={copy.example}
              placeholderTextColor={theme.textTertiary}
              accessibilityLabel={copy.inputLabel}
              textAlignVertical="top"
              onContentSizeChange={(e) => {
                const next = Math.ceil(e.nativeEvent.contentSize.height);
                setContentHeight((prev) => (Math.abs(prev - next) > 1 ? next : prev));
              }}
              // Grows with the text, so the whole card is read by scrolling the sheet and not a box inside it.
              style={[styles.input, { height: Math.max(200, text.split('\n').length * 22 + 34, text ? contentHeight + 2 : 0), color: theme.text, backgroundColor: theme.backgroundElement, borderColor: showError ? theme.danger : 'transparent' }]}
            />
            {showError ? (
              <ThemedText type="caption" style={[styles.inset, { color: theme.danger }]} accessibilityRole="alert">
                {parsed.error}
              </ThemedText>
            ) : (
              <ThemedText type="caption" themeColor="textSecondary" style={styles.inset}>
                {copy.textFooter}
              </ThemedText>
            )}
          </View>

          {preview.length > 0 ? (
            <ListGroup header="Ecco cosa ho capito" footer={notes.length > 0 ? notes.join('\n') : undefined}>
              {preview.map((row) => (
                <View key={row.day} style={styles.previewRow}>
                  <ThemedText type="smallBold" style={styles.previewDay}>
                    {row.day}
                  </ThemedText>
                  <ThemedText type="small" numberOfLines={1} style={styles.previewSummary}>
                    {row.summary}
                  </ThemedText>
                  {row.value ? (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.previewValue}>
                      {row.value}
                    </ThemedText>
                  ) : null}
                </View>
              ))}
            </ListGroup>
          ) : null}

          {shownDay ? (
            <View style={styles.group}>
              {!sameEveryDay ? (
                <View style={styles.dayStrip} accessibilityRole="tablist">
                  {dietDays.map((d, i) => {
                    const selected = d === shownDay;
                    return (
                      <Pressable
                        key={d.weekday}
                        onPress={() => {
                          hapticTap();
                          setDayIndex(i);
                        }}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        style={[styles.dayChip, { backgroundColor: selected ? theme.text : theme.backgroundElement }]}
                      >
                        <ThemedText type="smallBold" style={{ color: selected ? theme.background : theme.text }}>
                          {d.weekday}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <ListGroup
                header={sameEveryDay ? 'Ecco cosa ho capito · ogni giorno' : `Ecco cosa ho capito · ${shownDay.weekday}`}
                footer={[shownDay.calorieTarget ? `Totale ${shownDay.calorieTarget.toLocaleString('it-IT')} kcal.` : 'Totale non calcolabile: alcuni alimenti non hanno calorie.', ...notes].join('\n')}
              >
                {shownDay.meals.map((meal) => (
                  <View key={meal.slotId} style={styles.mealRow}>
                    <View style={styles.mealHead}>
                      <ThemedText type="smallBold">{meal.label}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.previewValue}>
                        {meal.time}
                        {meal.totalKcal > 0 ? ` · ${meal.totalKcal.toLocaleString('it-IT')} kcal` : ''}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {meal.items.map((item) => `${item.name} ${item.quantityLabel}`).join(' · ')}
                    </ThemedText>
                  </View>
                ))}
              </ListGroup>
            </View>
          ) : null}

          <PrimaryButton label={copy.apply} icon="check" disabled={!parsed?.ok || reading} onPress={() => apply(close)} />

          <GlassPopup visible={confirmOpen} onClose={() => setConfirmOpen(false)} style={styles.popup}>
            <ThemedText type="title" style={styles.center}>
              {copy.replaceTitle}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              {copy.replaceBody} Puoi tornare al piano dell’app quando vuoi.
            </ThemedText>
            <PrimaryButton label="Sostituisci" onPress={() => commit(close)} />
            <PrimaryButton label="Annulla" variant="outline" onPress={() => setConfirmOpen(false)} />
          </GlassPopup>
        </>
      )}
    </SheetScreen>
  );
}

/** Two days with the same meals and foods read as one menu. */
function menuKey(meals: { slotId: string; items: { name: string; quantityLabel: string }[] }[]): string {
  return meals.map((m) => `${m.slotId}:${m.items.map((i) => `${i.name}|${i.quantityLabel}`).join(',')}`).join(';');
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four },
  group: { gap: Spacing.two },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.four },
  inset: { paddingHorizontal: Spacing.four },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four },
  input: { borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, padding: Spacing.three, fontSize: 16, lineHeight: 22 },
  previewRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: 10 },
  previewDay: { width: 36 },
  previewSummary: { flex: 1, minWidth: 0 },
  previewValue: { fontVariant: ['tabular-nums'] },
  dayStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.four },
  dayChip: { minWidth: 44, minHeight: 36, paddingHorizontal: Spacing.three, borderRadius: 18, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  mealRow: { gap: 2, paddingHorizontal: Spacing.four, paddingVertical: 10 },
  mealHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.three },
  popup: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch' },
  center: { textAlign: 'center' },
});
