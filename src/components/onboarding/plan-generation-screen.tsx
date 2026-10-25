import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TimingQuick } from '@/constants/motion';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The steps `plan-store.generatePlans` actually performs, in order. The first
 * two have already run by the time this screen can appear (the summary screen
 * builds the user context and the initial targets from the same engine), the
 * third is the slow one — the AI strategy call — and the last two run on its
 * result. Nothing here is a decorative stage: when a step is shown as done,
 * it is done.
 */
const PHASES = [
  { id: 'answers', label: 'Analisi delle risposte', icon: 'checkCircle' as const },
  { id: 'energy', label: 'Calcolo di calorie e macro', icon: 'flame' as const },
  { id: 'strategy', label: 'Strategia del coach su misura', icon: 'sparkle' as const },
  { id: 'build', label: 'Costruzione di dieta e allenamento', icon: 'barbell' as const },
  { id: 'save', label: 'Salvataggio del piano', icon: 'download' as const },
];

/** How many phases are complete: 2 while the AI call is in flight, all of
 * them once generatePlans has returned with a plan. Never interpolated. */
const PHASES_DONE_WHILE_GENERATING = 2;

export type PlanGenerationScreenProps = {
  isGenerating: boolean;
  /** generatePlans returned without producing the expected plan. */
  failed?: boolean;
  onRetry?: () => void;
  /** Lets the user into the app anyway; their answers are already saved. */
  onContinueAnyway?: () => void;
};

export function PlanGenerationScreen({ isGenerating, failed = false, onRetry, onContinueAnyway }: PlanGenerationScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // A failed run stops where the AI strategy call did: the two phases that
  // genuinely completed before it stay complete, the rest never ran.
  const done = isGenerating || failed ? PHASES_DONE_WHILE_GENERATING : PHASES.length;
  const activeIndex = isGenerating ? PHASES_DONE_WHILE_GENERATING : -1;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.root,
        { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
      ]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <OrbitBadge failed={failed} />
        <View style={styles.heading}>
          <ThemedText type="display" style={styles.centered}>
            {failed ? 'Non siamo riusciti a completare il piano' : 'Prepariamo il tuo piano personalizzato'}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={[styles.centered, styles.subtitle]}>
            {failed
              ? 'Le tue risposte sono salvate: puoi riprovare subito oppure entrare e generare il piano più tardi dal tuo profilo.'
              : 'Stiamo trasformando le tue risposte in calorie, macro e sedute di allenamento.'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.phases}>
        <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.trackFill, { width: `${(done / PHASES.length) * 100}%`, backgroundColor: failed ? theme.danger : theme.accent }]} />
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          {done}/{PHASES.length} fasi completate
        </ThemedText>
        {PHASES.map((phase, index) => (
          <PhaseRow
            key={phase.id}
            label={phase.label}
            icon={phase.icon}
            state={failed && index === PHASES_DONE_WHILE_GENERATING ? 'failed' : index < done ? 'done' : index === activeIndex ? 'active' : 'pending'}
          />
        ))}
      </View>

      {failed ? (
        <View style={styles.actions}>
          {onRetry ? <PrimaryButton label="Riprova" icon="refresh" onPress={onRetry} /> : null}
          {onContinueAnyway ? <PrimaryButton label="Entra comunque" variant="ghost" onPress={onContinueAnyway} /> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function PhaseRow({ label, icon, state }: { label: string; icon: 'checkCircle' | 'flame' | 'sparkle' | 'barbell' | 'download'; state: 'done' | 'active' | 'pending' | 'failed' }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (state !== 'active' || reduceMotion) return;
    spin.value = 0;
    spin.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
  }, [state, reduceMotion, spin]);

  const opacity = useDerivedValue(
    () => (reduceMotion ? (state === 'pending' ? 0.4 : 1) : withTiming(state === 'pending' ? 0.4 : 1, TimingQuick)),
    [state, reduceMotion]
  );

  const rowStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  const color = state === 'failed' ? theme.danger : state === 'pending' ? theme.textTertiary : theme.accent;

  return (
    <Animated.View style={[styles.phaseRow, rowStyle]} accessibilityRole="text">
      <View style={[styles.phaseIcon, { backgroundColor: state === 'pending' ? theme.backgroundElement : theme.accentSoft }]}>
        {state === 'active' ? (
          <Animated.View style={spinStyle}>
            <Icon name="refresh" size={16} color={color} />
          </Animated.View>
        ) : (
          <Icon name={state === 'failed' ? 'alert' : icon} size={16} color={color} />
        )}
      </View>
      <ThemedText type="small" themeColor={state === 'pending' ? 'textTertiary' : 'text'} style={{ flex: 1 }}>
        {label}
      </ThemedText>
      {state === 'done' ? <Icon name="check" size={14} color={theme.success} /> : null}
    </Animated.View>
  );
}

/** Accent dots orbiting the FITLAB spark while the plan is being built. */
function OrbitBadge({ failed }: { failed: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || failed) return;
    rotation.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.linear }), -1, false);
  }, [reduceMotion, failed, rotation]);

  const orbitStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value * 360}deg` }] }));

  return (
    <View style={styles.badge}>
      {!failed ? (
        <Animated.View style={[StyleSheet.absoluteFill, orbitStyle]}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i / 6) * Math.PI * 2;
            return (
              <View
                key={i}
                style={[
                  styles.orbitDot,
                  {
                    backgroundColor: theme.accent,
                    opacity: 0.25 + (i / 6) * 0.6,
                    transform: [{ translateX: Math.cos(angle) * 52 }, { translateY: Math.sin(angle) * 52 }],
                  },
                ]}
              />
            );
          })}
        </Animated.View>
      ) : null}
      <View style={[styles.badgeDisc, { backgroundColor: failed ? theme.backgroundElement : theme.accentSoft }]}>
        <Icon name={failed ? 'alert' : 'sparkle'} size={30} color={failed ? theme.danger : theme.accent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingHorizontal: Spacing.four, justifyContent: 'center', gap: Spacing.four },
  hero: { alignItems: 'center', gap: Spacing.three },
  heading: { gap: Spacing.two, alignItems: 'center' },
  centered: { textAlign: 'center' },
  subtitle: { maxWidth: 340 },
  badge: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  badgeDisc: { width: 80, height: 80, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  orbitDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    left: '50%',
    top: '50%',
    marginLeft: -5,
    marginTop: -5,
  },
  phases: { gap: Spacing.two, width: '100%', maxWidth: 420, alignSelf: 'center' },
  track: { height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: Radius.pill },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 4 },
  phaseIcon: { width: 30, height: 30, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: Spacing.two, width: '100%', maxWidth: 420, alignSelf: 'center' },
});
