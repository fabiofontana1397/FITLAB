import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserContext } from '@/hooks/use-user-context';
import { hapticSelection, hapticSuccess } from '@/lib/haptics';
import { useOnboardingStore } from '@/store/onboarding-store';
import { dietPlanSource, PLAN_SOURCE_ROUTE, trainingPlanSource, type PlanSource } from '@/lib/planning/plan-source';
import { usePlanStore } from '@/store/plan-store';

type Kind = 'training' | 'diet';

const COPY = {
  training: {
    restoreTitle: 'Riprendere il programma FitLab?',
    restoreBody: {
      file: 'La scheda che hai caricato viene sostituita dal programma creato da FitLab con le tue risposte al questionario.',
      own: 'Il programma che hai creato viene sostituito da quello di FitLab, costruito con le tue risposte al questionario.',
    },
    createBody: 'Il tuo percorso non prevede l’allenamento. Per creare il programma servono le tue risposte: rifai il questionario dal Profilo.',
  },
  diet: {
    restoreTitle: 'Riprendere il piano FitLab?',
    restoreBody: {
      file: 'La dieta che hai caricato viene sostituita dal piano alimentare creato da FitLab con le tue risposte al questionario.',
      own: 'I tuoi obiettivi di calorie e macro vengono sostituiti dal piano alimentare di FitLab, costruito con le tue risposte al questionario.',
    },
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

type Option = { source: PlanSource; icon: IconName; title: string; sub: string };

const OPTIONS: Record<Kind, Option[]> = {
  training: [
    { source: 'fitlab', icon: 'sparkle', title: 'FitLab', sub: 'Creato per te' },
    { source: 'file', icon: 'camera', title: 'Caricata', sub: 'Foto, file, testo' },
    { source: 'own', icon: 'edit', title: 'Fai da te', sub: 'Scegli gli esercizi' },
  ],
  diet: [
    { source: 'fitlab', icon: 'sparkle', title: 'FitLab', sub: 'Creato per te' },
    { source: 'file', icon: 'camera', title: 'Caricata', sub: 'Foto, file, testo' },
    { source: 'own', icon: 'edit', title: 'Fai da te', sub: 'Kcal e macro' },
  ],
};

/**
 * The three ways to have a plan, under the Allenamento / Nutrizione switch: the one FitLab builds from the
 * questionnaire, the person's own card or diet loaded from a photo, file or text, or one they build themselves
 * (exercises chosen one by one; calories and macros month by month). The one in use is highlighted; tapping FitLab
 * from another source brings the app's plan back, tapping the others opens their screen (to load, build or edit).
 */
export function PlanSourceBanner({ kind }: { kind: Kind }) {
  const theme = useTheme();
  const copy = COPY[kind];
  const answers = useOnboardingStore((s) => s.answers);
  const ctx = useUserContext();
  const current = usePlanStore((s) => (kind === 'training' ? trainingPlanSource(s.trainingPlan) : dietPlanSource(s.dietPlan)));
  const isGenerating = usePlanStore((s) => s.isGenerating);
  const restoreTraining = usePlanStore((s) => s.restoreGeneratedTraining);
  const restoreDiet = usePlanStore((s) => s.restoreGeneratedDiet);
  const neverRequested = usePlanNeverRequested(kind);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const choose = (source: PlanSource) => {
    hapticSelection();
    if (source === 'fitlab') {
      if (current === 'fitlab' || isGenerating) return;
      if (neverRequested) setCreateOpen(true);
      else if (current == null) return; // the app's plan is being prepared
      else setRestoreOpen(true);
      return;
    }
    router.push(PLAN_SOURCE_ROUTE[kind][source]);
  };
  const restore = () => {
    const weightKg = ctx.weightKg > 0 ? ctx.weightKg : undefined;
    setRestoreOpen(false);
    hapticSuccess();
    void (kind === 'training' ? restoreTraining(answers, weightKg) : restoreDiet(answers, weightKg));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.tiles} accessibilityRole="radiogroup" accessibilityLabel={kind === 'training' ? 'Come vuoi il programma di allenamento' : 'Come vuoi il piano alimentare'}>
        {OPTIONS[kind].map((o) => {
          const on = current === o.source;
          const busy = o.source === 'fitlab' && isGenerating;
          return (
            <Pressable
              key={o.source}
              onPress={() => choose(o.source)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, busy }}
              aria-checked={on}
              accessibilityLabel={`${o.title}, ${o.sub}${on ? ', in uso' : ''}`}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: on ? theme.accentSoft : theme.backgroundElement, borderColor: on ? theme.accent : 'transparent', opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={styles.tileHead}>
                {busy ? <ActivityIndicator size="small" color={theme.accent} /> : <Icon name={o.icon} size={18} color={on ? theme.accent : theme.textSecondary} />}
                {on ? <Icon name="checkCircle" size={16} color={theme.accent} /> : null}
              </View>
              <ThemedText style={[styles.tileTitle, on ? { color: theme.accent } : null]} numberOfLines={1}>
                {o.title}
              </ThemedText>
              <ThemedText style={styles.tileSub} themeColor="textSecondary" numberOfLines={1}>
                {on && o.source !== 'fitlab' ? 'In uso · modifica' : o.sub}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <GlassPopup visible={restoreOpen} onClose={() => setRestoreOpen(false)} style={styles.popup}>
        <ThemedText type="title" style={styles.center}>
          {copy.restoreTitle}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {copy.restoreBody[current === 'own' ? 'own' : 'file']}
        </ThemedText>
        <PrimaryButton label="Riprendi il piano FitLab" onPress={restore} />
        <PrimaryButton label="Annulla" variant="outline" onPress={() => setRestoreOpen(false)} />
      </GlassPopup>
      <CreatePlanPopup kind={kind} visible={createOpen} onClose={() => setCreateOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minWidth: 0, minHeight: 76, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 20, marginBottom: 4 },
  tileTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.2 },
  tileSub: { fontSize: 12, lineHeight: 16 },
  popup: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch' },
  center: { textAlign: 'center' },
});
