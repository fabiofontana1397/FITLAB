import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { AppTextInput } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserContext } from '@/hooks/use-user-context';
import { hapticSuccess } from '@/lib/haptics';
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
            Scrivi o incolla la scheda: un esercizio per riga, con serie e ripetizioni (es. “Panca piana 4x8”) e, se vuoi,
            il recupero (“rec 90s”). Metti il giorno sopra gli esercizi: “Lunedì – Petto”. Un giorno di riposo è “Martedì –
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
  previewRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  previewDay: { width: 34 },
});
