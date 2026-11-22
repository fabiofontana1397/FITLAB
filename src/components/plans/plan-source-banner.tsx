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
import { hapticSelection, hapticSuccess, hapticTap } from '@/lib/haptics';
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
    { source: 'fitlab', icon: 'sparkle', title: 'Creato da FitLab', sub: 'Dalle tue risposte al questionario, adattato a ogni check-in' },
    { source: 'file', icon: 'camera', title: 'Carica la tua scheda', sub: 'Da una foto, un file o un testo' },
    { source: 'own', icon: 'edit', title: 'Crealo tu', sub: 'Scegli giorni, esercizi, serie e ripetizioni' },
  ],
  diet: [
    { source: 'fitlab', icon: 'sparkle', title: 'Creato da FitLab', sub: 'Dalle tue risposte al questionario, adattato a ogni check-in' },
    { source: 'file', icon: 'camera', title: 'Carica la tua dieta', sub: 'Da una foto, un file o un testo' },
    { source: 'own', icon: 'edit', title: 'Crealo tu', sub: 'Calorie e macro mese per mese, senza menù' },
  ],
};

/** What the line says for the plan in use: the source and, for the person's own plans, the way to change them. */
const CURRENT: Record<Kind, Record<PlanSource, { title: string; sub: string }>> = {
  training: {
    fitlab: { title: 'Creato da FitLab', sub: 'Puoi anche caricare la tua scheda o crearla' },
    file: { title: 'La tua scheda caricata', sub: 'L’app la segue così com’è' },
    own: { title: 'Creato da te', sub: 'L’app lo segue così com’è' },
  },
  diet: {
    fitlab: { title: 'Creato da FitLab', sub: 'Puoi anche caricare la tua dieta o crearla' },
    file: { title: 'La tua dieta caricata', sub: 'L’app la segue così com’è' },
    own: { title: 'Creato da te', sub: 'Calorie e macro scelti da te' },
  },
};

/** Exit duration of a popup (TimingExit), with a little slack, before the next one opens. */
const POPUP_SWAP_MS = 220;

/**
 * The line under the Allenamento / Nutrizione switch: where the plan in use comes from, and "Cambia", which opens
 * the three ways to have one — the plan FitLab builds from the questionnaire, the person's own card or diet loaded
 * from a photo, file or text, or one they build themselves (exercises one by one; calories and macros per month).
 * Choosing FitLab from another source brings the app's plan back; the others open their screen. Editing the plan in use
 * stays in its own box below ("Modifica programma", the pencil of the targets).
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const line = current ? CURRENT[kind][current] : { title: neverRequested ? 'Nessun piano' : 'Piano in preparazione', sub: 'Puoi caricarne uno o crearlo tu' };

  const choose = (source: PlanSource) => {
    hapticSelection();
    setMenuOpen(false);
    if (source === 'fitlab') {
      if (current === 'fitlab' || isGenerating || (current == null && !neverRequested)) return;
      setTimeout(() => (neverRequested ? setCreateOpen(true) : setRestoreOpen(true)), POPUP_SWAP_MS);
      return;
    }
    setTimeout(() => router.push(PLAN_SOURCE_ROUTE[kind][source]), POPUP_SWAP_MS);
  };
  const restore = () => {
    const weightKg = ctx.weightKg > 0 ? ctx.weightKg : undefined;
    setRestoreOpen(false);
    hapticSuccess();
    void (kind === 'training' ? restoreTraining(answers, weightKg) : restoreDiet(answers, weightKg));
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          hapticTap();
          setMenuOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${line.title}. ${line.sub}`}
        style={({ pressed }) => [styles.texts, { opacity: pressed ? 0.6 : 1 }]}
      >
        <ThemedText style={styles.title} numberOfLines={1}>
          {line.title}
        </ThemedText>
        <ThemedText style={styles.sub} themeColor="textSecondary" numberOfLines={1}>
          {line.sub}
        </ThemedText>
      </Pressable>

      <Pressable
        onPress={() => {
          hapticTap();
          setMenuOpen(true);
        }}
        disabled={isGenerating}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={kind === 'training' ? 'Cambia il tipo di programma' : 'Cambia il tipo di piano'}
        accessibilityState={{ disabled: isGenerating, busy: isGenerating }}
        style={({ pressed }) => [styles.button, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 }]}
      >
        {isGenerating ? <ActivityIndicator size="small" color={theme.textSecondary} /> : null}
        <ThemedText style={styles.buttonLabel}>Cambia</ThemedText>
        <Icon name="chevronDown" size={14} color={theme.textSecondary} />
      </Pressable>

      <GlassPopup visible={menuOpen} onClose={() => setMenuOpen(false)} style={styles.menu}>
        <ThemedText type="title" style={styles.menuTitle}>
          {kind === 'training' ? 'Il tuo allenamento' : 'La tua alimentazione'}
        </ThemedText>
        <View style={[styles.list, { backgroundColor: theme.backgroundElement }]} accessibilityRole="radiogroup">
          {OPTIONS[kind].map((o, i) => {
            const on = current === o.source;
            return (
              <Pressable
                key={o.source}
                onPress={() => choose(o.source)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                aria-checked={on}
                accessibilityLabel={`${o.title}. ${o.sub}`}
                style={({ pressed }) => [styles.option, i > 0 && [styles.optionDivided, { borderTopColor: theme.border }], { opacity: pressed ? 0.6 : 1 }]}
              >
                <Icon name={o.icon} size={20} color={on ? theme.accent : theme.textSecondary} />
                <View style={styles.flex}>
                  <ThemedText style={styles.optionTitle}>{o.title}</ThemedText>
                  <ThemedText style={styles.optionSub} themeColor="textSecondary">
                    {o.sub}
                  </ThemedText>
                </View>
                {on ? <Icon name="check" size={18} color={theme.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      </GlassPopup>

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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 4 },
  texts: { flex: 1, minWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.2 },
  sub: { fontSize: 13, lineHeight: 18 },
  button: { minHeight: 36, borderRadius: 18, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  buttonLabel: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  menu: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch' },
  menuTitle: { textAlign: 'center' },
  list: { borderRadius: 18, borderCurve: 'continuous', overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingHorizontal: Spacing.three, paddingVertical: 10 },
  optionDivided: { borderTopWidth: StyleSheet.hairlineWidth },
  optionTitle: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  optionSub: { fontSize: 13, lineHeight: 18 },
  popup: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch' },
  center: { textAlign: 'center' },
});
