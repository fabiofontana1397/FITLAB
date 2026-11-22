import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserContext } from '@/hooks/use-user-context';
import { hapticSuccess, hapticTap } from '@/lib/haptics';
import { useOnboardingStore } from '@/store/onboarding-store';
import { isTargetsPlan } from '@/lib/planning/targets-plan';
import { usePlanStore } from '@/store/plan-store';

type Kind = 'training' | 'diet';

const COPY = {
  training: {
    ask: 'Hai già una scheda?',
    askSub: 'Caricala e seguila qui.',
    active: 'Stai seguendo la tua scheda',
    replace: 'Sostituiscila',
    route: '/custom-workout',
    restoreTitle: 'Tornare al programma dell’app?',
    restoreBody: 'La tua scheda viene sostituita dal programma creato dalle tue risposte al questionario.',
    createBody: 'Il tuo percorso non prevede l’allenamento. Per creare il programma servono le tue risposte: rifai il questionario dal Profilo.',
  },
  diet: {
    ask: 'Hai già una dieta?',
    askSub: 'Caricala o imposta i macro.',
    active: 'Stai seguendo la tua dieta',
    replace: 'Sostituiscila',
    route: '/custom-diet',
    restoreTitle: 'Tornare al piano dell’app?',
    restoreBody: 'La tua dieta viene sostituita dal piano alimentare creato dalle tue risposte al questionario.',
    createBody: 'Il tuo percorso non prevede l’alimentazione. Per creare il piano servono le tue risposte: rifai il questionario dal Profilo.',
  },
} as const;

/** The plan was never asked for in the questionnaire (a diet-only person has no training plan, and vice versa). */
export function usePlanNeverRequested(kind: Kind): boolean {
  const mode = useOnboardingStore((s) => s.answers.mode);
  return mode === (kind === 'training' ? 'diet' : 'training');
}

/** "Crea il tuo piano": the plan needs questionnaire answers the person never gave, so it sends them to redo it. */
export function CreatePlanPopup({ kind, visible, onClose }: { kind: Kind; visible: boolean; onClose: () => void }) {
  return (
    <GlassPopup visible={visible} onClose={onClose} style={styles.popup}>
      <ThemedText type="title" style={styles.center}>
        Crea il tuo piano
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        {COPY[kind].createBody}
      </ThemedText>
      <PrimaryButton
        label="Apri il Profilo"
        onPress={() => {
          onClose();
          router.push('/profile');
        }}
      />
      <PrimaryButton label="Annulla" variant="outline" onPress={onClose} />
    </GlassPopup>
  );
}

/**
 * The line under the Allenamento / Nutrizione switch: an invitation to load a card or diet the person already has
 * and, once one is in place, the way back to the app's own plan (or to creating it, when it never existed).
 */
export function PlanSourceBanner({ kind }: { kind: Kind }) {
  const theme = useTheme();
  const copy = COPY[kind];
  const answers = useOnboardingStore((s) => s.answers);
  const ctx = useUserContext();
  const isCustom = usePlanStore((s) => (kind === 'training' ? s.trainingPlan?.source : s.dietPlan?.source) === 'custom');
  // the person's own calorie and macro targets (no menu): tapping the line edits them instead of loading a diet
  const ownTargets = usePlanStore((s) => kind === 'diet' && isTargetsPlan(s.dietPlan));
  const isGenerating = usePlanStore((s) => s.isGenerating);
  const restoreTraining = usePlanStore((s) => s.restoreGeneratedTraining);
  const restoreDiet = usePlanStore((s) => s.restoreGeneratedDiet);
  const neverRequested = usePlanNeverRequested(kind);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const openSheet = () => {
    hapticTap();
    router.push(ownTargets ? '/custom-targets' : copy.route);
  };
  const openTargets = () => {
    hapticTap();
    router.push('/custom-targets');
  };
  const restore = () => {
    const weightKg = ctx.weightKg > 0 ? ctx.weightKg : undefined;
    setRestoreOpen(false);
    hapticSuccess();
    void (kind === 'training' ? restoreTraining(answers, weightKg) : restoreDiet(answers, weightKg));
  };

  return (
    <View style={styles.row}>
      {isCustom ? (
        <Pressable
          onPress={openSheet}
          accessibilityRole="button"
          accessibilityLabel={ownTargets ? 'Stai seguendo i tuoi obiettivi. Modificali' : `${copy.active}. ${copy.replace}`}
          style={({ pressed }) => [styles.texts, { opacity: pressed ? 0.6 : 1 }]}
        >
          <ThemedText style={styles.title} numberOfLines={1}>
            {ownTargets ? 'Stai seguendo i tuoi obiettivi' : copy.active}
          </ThemedText>
          <ThemedText style={[styles.sub, { color: theme.accent, fontWeight: '600' }]} numberOfLines={1}>
            {ownTargets ? 'Modificali' : copy.replace}
          </ThemedText>
        </Pressable>
      ) : (
        <View style={styles.texts}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {copy.ask}
          </ThemedText>
          <ThemedText style={styles.sub} themeColor="textSecondary" numberOfLines={1}>
            {copy.askSub}
          </ThemedText>
        </View>
      )}

      {isCustom ? (
        <Pressable
          onPress={() => {
            hapticTap();
            if (neverRequested) setCreateOpen(true);
            else setRestoreOpen(true);
          }}
          disabled={isGenerating}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityState={{ disabled: isGenerating, busy: isGenerating }}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 }]}
        >
          {isGenerating ? <ActivityIndicator size="small" color={theme.textSecondary} /> : null}
          <ThemedText style={styles.buttonLabel}>{neverRequested ? 'Crea il tuo piano' : 'Piano originale'}</ThemedText>
        </Pressable>
      ) : (
        <View style={styles.buttons}>
          {kind === 'diet' ? (
            <Pressable onPress={openTargets} hitSlop={4} accessibilityRole="button" accessibilityLabel="Imposta calorie e macro del tuo piano" style={({ pressed }) => [styles.button, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 }]}>
              <ThemedText style={styles.buttonLabel}>Imposta</ThemedText>
            </Pressable>
          ) : null}
          <Pressable onPress={openSheet} hitSlop={4} accessibilityRole="button" accessibilityLabel={`${copy.ask} Carica`} style={({ pressed }) => [styles.button, { backgroundColor: theme.accentSoft, opacity: pressed ? 0.6 : 1 }]}>
            <ThemedText style={[styles.buttonLabel, { color: theme.accent }]}>Carica</ThemedText>
          </Pressable>
        </View>
      )}

      <GlassPopup visible={restoreOpen} onClose={() => setRestoreOpen(false)} style={styles.popup}>
        <ThemedText type="title" style={styles.center}>
          {copy.restoreTitle}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {ownTargets ? 'I tuoi obiettivi di calorie e macro vengono sostituiti dal piano alimentare creato dalle tue risposte al questionario.' : copy.restoreBody}
        </ThemedText>
        <PrimaryButton label="Torna al piano originale" onPress={restore} />
        <PrimaryButton label="Annulla" variant="outline" onPress={() => setRestoreOpen(false)} />
      </GlassPopup>
      <CreatePlanPopup kind={kind} visible={createOpen} onClose={() => setCreateOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 4 },
  texts: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.2 },
  sub: { fontSize: 13, lineHeight: 18 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: { minHeight: 36, borderRadius: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  buttonLabel: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  popup: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch' },
  center: { textAlign: 'center' },
});
