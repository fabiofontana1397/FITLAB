import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { BrandMark } from '@/components/ui/brand-mark';
import { Collapsible } from '@/components/ui/collapsible';
import { FlatCard } from '@/components/ui/flat-card';
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
      own: 'Il tuo piano di calorie e macro viene sostituito dal piano alimentare di FitLab, costruito con le tue risposte al questionario.',
    },
    createBody: 'Il tuo percorso non prevede l’alimentazione. Per creare il piano servono le tue risposte: rifai il questionario dal Profilo.',
  },
} as const;

/** The plan was never asked for in the questionnaire (a diet-only person has no training plan, and vice versa). */
export function usePlanNeverRequested(kind: Kind): boolean {
  const mode = useOnboardingStore((s) => s.answers.mode);
  return mode === (kind === 'training' ? 'diet' : 'training');
}

/** "Piano creato da FitLab" when the plan needs questionnaire answers the person never gave, so it sends them to redo it. */
export function CreatePlanPopup({ kind, visible, onClose }: { kind: Kind; visible: boolean; onClose: () => void }) {
  return (
    <GlassPopup visible={visible} onClose={onClose} style={styles.popup}>
      <ThemedText type="title" style={styles.center}>
        Piano creato da FitLab
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

/** `brand`: the FitLab mark, as in the page header. */
type Option = { source: PlanSource; icon: IconName | 'brand'; title: string; sub: string };

const OPTIONS: Record<Kind, Option[]> = {
  training: [
    { source: 'fitlab', icon: 'brand', title: 'Piano creato da FitLab', sub: 'Dalle tue risposte al questionario, adattato a ogni check-in' },
    { source: 'own', icon: 'edit', title: 'Crea il tuo piano', sub: 'Scegli giorni, esercizi, serie e ripetizioni' },
    { source: 'file', icon: 'camera', title: 'Carica il tuo piano', sub: 'Da una foto, un file o un testo' },
  ],
  diet: [
    { source: 'fitlab', icon: 'brand', title: 'Piano creato da FitLab', sub: 'Dalle tue risposte al questionario, adattato a ogni check-in' },
    { source: 'own', icon: 'edit', title: 'Crea il tuo piano', sub: 'Calorie e macro mese per mese, senza menù' },
    { source: 'file', icon: 'camera', title: 'Carica il tuo piano', sub: 'Da una foto, un file o un testo' },
  ],
};

/** What the button says for the plan in use: just where it comes from, on one line. */
const CURRENT: Record<Kind, Record<PlanSource, { title: string }>> = {
  training: {
    fitlab: { title: 'Piano creato da FitLab' },
    file: { title: 'Piano caricato da te' },
    own: { title: 'Piano creato da te' },
  },
  diet: {
    fitlab: { title: 'Piano creato da FitLab' },
    file: { title: 'Piano caricato da te' },
    own: { title: 'Piano creato da te' },
  },
};

/** Exit duration of a popup (TimingExit), with a little slack: the drop-down closes before a confirmation opens. */
const POPUP_SWAP_MS = 220;
/** Time for the dropdown to start closing before the next screen opens over it. */
const CLOSE_MS = 160;

/**
 * A long button under the Allenamento / Nutrizione switch with where the plan in use comes from; tapped, it opens
 * downwards like a drop-down menu with the three ways to have one — the plan FitLab builds from the questionnaire, the person's own card or diet loaded
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

  const line = current ? CURRENT[kind][current] : { title: neverRequested ? 'Nessun piano' : 'Piano in preparazione' };

  const choose = (source: PlanSource) => {
    hapticSelection();
    setMenuOpen(false);
    if (source === 'fitlab') {
      if (current === 'fitlab' || isGenerating || (current == null && !neverRequested)) return;
      setTimeout(() => (neverRequested ? setCreateOpen(true) : setRestoreOpen(true)), POPUP_SWAP_MS);
      return;
    }
    setTimeout(() => router.push(PLAN_SOURCE_ROUTE[kind][source]), CLOSE_MS);
  };
  const restore = () => {
    const weightKg = ctx.weightKg > 0 ? ctx.weightKg : undefined;
    setRestoreOpen(false);
    hapticSuccess();
    void (kind === 'training' ? restoreTraining(answers, weightKg) : restoreDiet(answers, weightKg));
  };

  const currentOption = OPTIONS[kind].find((o) => o.source === current);
  const iconColor = theme.accent;

  return (
    <View>
      <FlatCard radius={22} style={styles.dropdown}>
        <Pressable
          onPress={() => {
            hapticTap();
            setMenuOpen((v) => !v);
          }}
          disabled={isGenerating}
          accessibilityRole="button"
          accessibilityState={{ expanded: menuOpen, busy: isGenerating }}
          aria-expanded={menuOpen}
          accessibilityLabel={`${line.title}. ${kind === 'training' ? 'Cambia il tipo di programma' : 'Cambia il tipo di piano'}`}
          style={({ pressed }) => [styles.head, { opacity: pressed ? 0.6 : 1 }]}
        >
          <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
            {isGenerating ? (
              <ActivityIndicator size="small" color={iconColor} />
            ) : currentOption?.icon === 'brand' || !currentOption ? (
              <BrandMark height={12} color={iconColor} />
            ) : (
              <Icon name={currentOption.icon} size={16} color={iconColor} />
            )}
          </View>
          <ThemedText style={[styles.flex, styles.title]} numberOfLines={1}>
            {line.title}
          </ThemedText>
          <Icon name={menuOpen ? 'chevronUp' : 'chevronDown'} size={18} color={theme.textSecondary} />
        </Pressable>

        <Collapsible open={menuOpen}>
          {/* The plan in use is already on the button: the list holds only the other ways. */}
          <View>
            {OPTIONS[kind]
              .filter((o) => o.source !== current)
              .map((o) => (
                <Pressable
                  key={o.source}
                  onPress={() => choose(o.source)}
                  accessibilityRole="button"
                  accessibilityLabel={`${o.title}. ${o.sub}`}
                  style={({ pressed }) => [styles.option, { borderTopColor: theme.border, opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={styles.optionIcon}>
                    {o.icon === 'brand' ? <BrandMark height={13} color={theme.textSecondary} /> : <Icon name={o.icon} size={18} color={theme.textSecondary} />}
                  </View>
                  <View style={styles.flex}>
                    <ThemedText style={styles.optionTitle}>{o.title}</ThemedText>
                    <ThemedText style={styles.optionSub} themeColor="textSecondary">
                      {o.sub}
                    </ThemedText>
                  </View>
                  <Icon name="chevronRight" size={16} color={theme.textTertiary} />
                </Pressable>
              ))}
          </View>
        </Collapsible>
      </FlatCard>

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
  dropdown: { overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 12, paddingVertical: 6 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.2 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  optionIcon: { width: 36, alignItems: 'center' },
  optionTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  optionSub: { fontSize: 13, lineHeight: 18 },
  popup: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch' },
  center: { textAlign: 'center' },
});
