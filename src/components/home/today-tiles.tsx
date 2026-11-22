import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/pressable-scale';
import { useRevealedValue } from '@/components/motion/reveal';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Brand, OnBrand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const GAP = 10;
/** A macro's silo: horizontal segments stacked from the bottom, lit up to the share eaten. */
const SILO_SEGMENTS = 10;
const SILO_W = 28;
const SEG_H = 5;
const SEG_GAP = 3;

function withAlpha(hex: string, alpha: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex;
  return `${hex}${Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0')}`;
}

export type MacroProgress = { eaten: number; target: number };

export type TodayMacros = { protein: MacroProgress; carbs: MacroProgress; fats: MacroProgress };

/** What the plan holds for the day shown, already resolved by Home. */
export type TodayWorkout =
  | { kind: 'none' }
  | { kind: 'rest' }
  | { kind: 'cardio'; title: string }
  | {
      kind: 'workout';
      title: string;
      minutes: number;
      exercisesDone: number;
      exercisesTotal: number;
      /** A session left with the X: its clock so far ("12:34"). */
      resumeLabel?: string;
      /** Set only when the session can be started from here (today, not done yet). */
      onStart?: () => void;
    };

export type TodayTilesProps = {
  /** "oggi" wording when the day shown is today. */
  isToday: boolean;
  /** A day still to come: nothing eaten, nothing done. */
  inactive?: boolean;
  macros: TodayMacros;
  onMacrosPress: () => void;
  workout: TodayWorkout;
  onWorkoutPress: () => void;
};

/**
 * The day's progress in two square tiles, side by side under the calorie bars:
 * the three macros against the plan's targets, and what the training plan
 * holds for the day, with "Inizia" starting the guided session right from Home.
 */
export function TodayTiles({ isToday, inactive, macros, onMacrosPress, workout, onWorkoutPress }: TodayTilesProps) {
  // Square at rest: the row's width sets the tiles' minimum height, so larger text can still grow them.
  const [side, setSide] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round((e.nativeEvent.layout.width - GAP) / 2);
    setSide((prev) => (prev === next ? prev : next));
  };
  return (
    <View style={styles.row} onLayout={onLayout}>
      <MacroTile side={side} inactive={inactive} macros={macros} onPress={onMacrosPress} />
      <WorkoutTile side={side} isToday={isToday} workout={workout} onPress={onWorkoutPress} />
    </View>
  );
}

function TileHeader({ icon, color, title }: { icon: IconName; color: string; title: string }) {
  return (
    <View style={styles.header}>
      <View style={[styles.headerIcon, { backgroundColor: withAlpha(color, 0.16) }]}>
        <Icon name={icon} size={14} color={color} />
      </View>
      <ThemedText style={styles.headerTitle} numberOfLines={1}>
        {title}
      </ThemedText>
    </View>
  );
}

function SiloSegment({ value, index, color, track }: { value: SharedValue<number>; index: number; color: string; track: string }) {
  const style = useAnimatedStyle(() => ({ backgroundColor: value.value * SILO_SEGMENTS >= index + 0.5 ? color : track }));
  return <Animated.View style={[styles.siloSeg, style]} />;
}

/** Fills from the bottom, one segment at a time, when Home comes into view. */
function Silo({ progress, delay, color, track }: { progress: number; delay: number; color: string; track: string }) {
  const value = useRevealedValue(Math.min(Math.max(progress, 0), 1), delay);
  return (
    <View style={styles.silo}>
      {Array.from({ length: SILO_SEGMENTS }, (_, k) => SILO_SEGMENTS - 1 - k).map((index) => (
        <SiloSegment key={index} value={value} index={index} color={color} track={track} />
      ))}
    </View>
  );
}

function MacroTile({ side, inactive, macros, onPress }: { side: number; inactive?: boolean; macros: TodayMacros; onPress: () => void }) {
  const theme = useTheme();
  // Same colours as the Nutrizione tab, so a macro reads the same everywhere.
  const rows = [
    { key: 'protein', label: 'Proteine', short: 'P', color: theme.accent, ...macros.protein },
    { key: 'carbs', label: 'Carboidrati', short: 'C', color: theme.brandGreen, ...macros.carbs },
    { key: 'fats', label: 'Grassi', short: 'G', color: theme.brandYellow, ...macros.fats },
  ];
  const a11y = rows.map((r) => `${r.label} ${Math.round(inactive ? 0 : r.eaten)} di ${Math.round(r.target)} grammi`).join(', ');
  return (
    <PressableScale onPress={onPress} scaleTo={0.97} style={styles.cell} accessibilityRole="button" accessibilityLabel={`Macronutrienti. ${a11y}. Apri Nutrizione`}>
      <FlatCard radius={Radius.large} style={[styles.tile, { minHeight: side }]}>
        <TileHeader icon="nutrition" color={theme.accent} title="Macro" />
        <View style={styles.siloRow}>
          {rows.map((r, i) => {
            const eaten = inactive ? 0 : r.eaten;
            return (
              <View key={r.key} style={styles.siloCol}>
                <Silo progress={r.target > 0 ? eaten / r.target : 0} delay={120 + i * 90} color={r.color} track={withAlpha(r.color, 0.16)} />
                <ThemedText style={[styles.macroLetter, { color: r.color }]}>{r.short}</ThemedText>
                <ThemedText style={styles.macroValue} numberOfLines={1}>
                  {Math.round(eaten)}
                  <ThemedText style={styles.macroTarget} themeColor="textTertiary">
                    {' g'}
                  </ThemedText>
                </ThemedText>
              </View>
            );
          })}
        </View>
      </FlatCard>
    </PressableScale>
  );
}

function WorkoutTile({ side, isToday, workout, onPress }: { side: number; isToday: boolean; workout: TodayWorkout; onPress: () => void }) {
  const theme = useTheme();
  const title = isToday ? 'Oggi' : 'Allenamento';

  let body: React.ReactNode;
  let a11y: string;
  if (workout.kind === 'workout') {
    const done = workout.exercisesTotal > 0 && workout.exercisesDone >= workout.exercisesTotal;
    const meta = done
      ? `${workout.exercisesTotal} esercizi fatti`
      : workout.exercisesDone > 0
        ? `${workout.exercisesDone}/${workout.exercisesTotal} esercizi`
        : `${workout.exercisesTotal} esercizi · ${workout.minutes} min`;
    a11y = `Allenamento: ${workout.title}, ${meta}`;
    body = (
      <>
        <View style={styles.workoutText}>
          <ThemedText style={styles.workoutTitle} numberOfLines={2}>
            {workout.title}
          </ThemedText>
          <ThemedText style={styles.workoutMeta} themeColor="textSecondary" numberOfLines={1}>
            {meta}
          </ThemedText>
        </View>
        {done ? (
          <View style={[styles.pill, { backgroundColor: withAlpha(theme.brandGreen, 0.16) }]}>
            <Icon name="check" size={14} color={theme.brandGreen} />
            <ThemedText style={[styles.pillText, { color: theme.brandGreen }]}>Completato</ThemedText>
          </View>
        ) : workout.onStart ? (
          <PressableScale onPress={workout.onStart} haptic="press" accessibilityRole="button" accessibilityLabel={workout.resumeLabel ? `Riprendi allenamento, ${workout.resumeLabel}` : 'Inizia allenamento'} testID="home-start-workout">
            <LinearGradient colors={Brand.successGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pill}>
              <Icon name="play" size={13} color={OnBrand.text} />
              <ThemedText style={[styles.pillText, { color: OnBrand.text }]} numberOfLines={1}>
                {workout.resumeLabel ? `Riprendi · ${workout.resumeLabel}` : 'Inizia'}
              </ThemedText>
            </LinearGradient>
          </PressableScale>
        ) : (
          <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={[styles.pillText, { color: theme.text }]}>Vedi scheda</ThemedText>
            <Icon name="chevronRight" size={13} color={theme.textSecondary} />
          </View>
        )}
      </>
    );
  } else {
    const quiet =
      workout.kind === 'cardio'
        ? { icon: 'running' as IconName, color: theme.accent, title: workout.title, text: 'Sessione cardio', action: 'Vedi dettagli' }
        : workout.kind === 'rest'
          ? { icon: 'moon' as IconName, color: theme.textSecondary, title: 'Riposo', text: 'Il recupero fa parte del piano', action: null }
          : { icon: 'plans' as IconName, color: theme.textSecondary, title: 'Nessun piano', text: 'Crea il tuo programma', action: 'Vai ai piani' };
    a11y = `Allenamento: ${quiet.title}. ${quiet.text}`;
    body = (
      <>
        <View style={styles.workoutText}>
          <ThemedText style={styles.workoutTitle} numberOfLines={2}>
            {quiet.title}
          </ThemedText>
          <ThemedText style={styles.workoutMeta} themeColor="textSecondary" numberOfLines={2}>
            {quiet.text}
          </ThemedText>
        </View>
        {quiet.action ? (
          <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={[styles.pillText, { color: theme.text }]}>{quiet.action}</ThemedText>
            <Icon name="chevronRight" size={13} color={theme.textSecondary} />
          </View>
        ) : (
          <View style={[styles.restBadge, { backgroundColor: theme.backgroundElement }]}>
            <Icon name={quiet.icon} size={18} color={quiet.color} />
          </View>
        )}
      </>
    );
  }

  return (
    <PressableScale onPress={onPress} scaleTo={0.97} style={styles.cell} accessibilityRole="button" accessibilityLabel={a11y}>
      <FlatCard radius={Radius.large} style={[styles.tile, { minHeight: side }]}>
        <TileHeader icon="barbell" color={theme.brandGreen} title={title} />
        {body}
      </FlatCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: GAP, marginTop: 10 },
  cell: { flex: 1 },
  tile: { padding: 14, justifyContent: 'space-between', gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  siloRow: { flexDirection: 'row', justifyContent: 'space-around' },
  siloCol: { alignItems: 'center' },
  silo: { width: SILO_W, gap: SEG_GAP, marginBottom: 6 },
  siloSeg: { height: SEG_H, borderRadius: 2 },
  macroLetter: { fontSize: 12, lineHeight: 15, fontWeight: '800' },
  macroValue: { fontSize: 12, lineHeight: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  macroTarget: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  workoutText: { flex: 1, justifyContent: 'center', gap: 2 },
  workoutTitle: { fontSize: 18, lineHeight: 22, fontWeight: '800', letterSpacing: -0.3 },
  workoutMeta: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  pill: { height: 40, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  pillText: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  restBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
