import { useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Reveal } from '@/components/motion/reveal';
import { ThemedText } from '@/components/themed-text';
import { ExerciseInfoModal } from '@/components/training/exercise-info-modal';
import { SwipeToStart } from '@/components/training/swipe-to-start';
import { WorkoutSessionModal } from '@/components/training/workout-session-modal';
import { Icon, type IconName } from '@/components/ui/icon';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useTheme } from '@/hooks/use-theme';
import { useUserContext } from '@/hooks/use-user-context';
import { getExerciseMedia } from '@/lib/exercise-media/exercise-media';
import { daysAgoISO } from '@/lib/mock/dates';
import type { Level } from '@/lib/planning/training/profile';
import { SPOT_FOCUS, spotWorkoutOfDay, type SpotFocus, type SpotPlace } from '@/lib/planning/training/spot-workouts';
import type { TrainingExerciseEntry } from '@/lib/planning/types';
import { useActivityLogStore } from '@/store/activity-log-store';

const FOCUS_ICON: Record<SpotFocus, IconName> = {
  glutes: 'body',
  legs: 'footsteps',
  chest: 'barbell',
  back: 'gym',
  shoulders: 'dumbbellLine',
  arms: 'armFlex',
  core: 'target',
  total: 'bolt',
};

const LEVEL_OF: Record<string, Level> = { beginner: 'beginner', intermediate: 'intermediate', expert: 'advanced' };

function restText(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')} min`;
}

/**
 * Allenamento spot: pick what to train (and where), get the workout of the day for it — exercises with their GIF,
 * sets, reps, rest and starting load, duration and estimated calories — run it in the guided session, and at the end
 * it is logged to today's calories as an activity.
 */
export function SpotWorkoutView() {
  const theme = useTheme();
  const ctx = useUserContext();
  const addActivity = useActivityLogStore((s) => s.addEntry);
  const today = daysAgoISO(0);
  const [focus, setFocus] = useState<SpotFocus>('glutes');
  const [place, setPlace] = useState<SpotPlace>(ctx.training?.location === 'home' ? 'home' : 'gym');
  const [running, setRunning] = useState(false);
  const [info, setInfo] = useState<TrainingExerciseEntry | null>(null);
  // Workouts finished today (by id): minutes and kcal logged.
  const [doneToday, setDoneToday] = useState<Record<string, { minutes: number; kcal: number }>>({});

  const level = LEVEL_OF[ctx.training?.gym?.skill ?? ''] ?? 'intermediate';
  const workout = useMemo(
    () => spotWorkoutOfDay(focus, place, today, { weightKg: ctx.weightKg, sex: ctx.sex, age: ctx.age, level }),
    [focus, place, today, ctx.weightKg, ctx.sex, ctx.age, level]
  );
  const done = doneToday[workout.id];

  return (
    <>
      <Reveal index={0}>
        <View style={styles.headRow}>
          <ThemedText style={styles.sectionTitle} accessibilityRole="header">
            Cosa alleni oggi?
          </ThemedText>
        </View>
        <View style={styles.place}>
          <SegmentedControl
            options={[
              { value: 'gym', label: 'Palestra' },
              { value: 'home', label: 'Casa' },
            ]}
            value={place}
            onChange={(v) => setPlace(v as SpotPlace)}
          />
        </View>
      </Reveal>

      <Reveal index={1}>
        <View style={styles.grid}>
          {SPOT_FOCUS.map((f) => {
            const active = f.value === focus;
            return (
              <PressableScale
                key={f.value}
                onPress={() => setFocus(f.value)}
                haptic="tap"
                scaleTo={0.95}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${f.label}: ${f.blurb}`}
                style={[styles.tile, { backgroundColor: active ? theme.text : theme.backgroundElevated, borderColor: active ? theme.text : theme.boxEdge }]}>
                <View style={[styles.tileIcon, { backgroundColor: active ? 'rgba(255,255,255,0.14)' : theme.backgroundElement }]}>
                  <Icon name={FOCUS_ICON[f.value]} size={18} color={active ? theme.background : theme.text} />
                </View>
                <ThemedText style={[styles.tileLabel, { color: active ? theme.background : theme.text }]} numberOfLines={1}>
                  {f.label}
                </ThemedText>
              </PressableScale>
            );
          })}
        </View>
      </Reveal>

      <Reveal index={2}>
        <View style={[styles.card, { backgroundColor: theme.backgroundElevated, borderColor: theme.boxEdge }]}>
          <View style={styles.cardHead}>
            <ThemedText style={[styles.eyebrow, { color: theme.accent }]}>Allenamento del giorno · {workout.focusLabel}</ThemedText>
            <ThemedText style={styles.title}>{workout.title}</ThemedText>
            <ThemedText style={styles.note} themeColor="textSecondary">
              {workout.note}
            </ThemedText>
          </View>

          <View style={[styles.stats, { backgroundColor: theme.backgroundElement }]}>
            <Stat icon="clock" value={`${workout.minutes}`} unit="min" label="Durata" />
            <Stat icon="flame" value={`${workout.kcal}`} unit="kcal" label="Calorie" divider />
            <Stat icon="dumbbellLine" value={`${workout.exercises.length}`} label="Esercizi" divider />
            <Stat icon="repsHash" value={`${workout.totalSets}`} label="Serie" divider />
          </View>

          <View style={styles.chips}>
            {workout.muscles.map((m) => (
              <View key={`m-${m}`} style={[styles.chip, { backgroundColor: theme.accentSoft }]}>
                <ThemedText style={[styles.chipText, { color: theme.accent }]}>{m}</ThemedText>
              </View>
            ))}
            {workout.equipment.map((e) => (
              <View key={`e-${e}`} style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={styles.chipText} themeColor="textSecondary">
                  {e}
                </ThemedText>
              </View>
            ))}
          </View>

          <View style={styles.list}>
            {workout.exercises.map((ex, i) => (
              <ExerciseRow key={ex.id} index={i} exercise={ex} first={i === 0} onPress={() => setInfo(ex)} />
            ))}
          </View>

          {done ? (
            <View style={[styles.doneBanner, { backgroundColor: theme.successSoft }]}>
              <Icon name="checkCircle" size={20} color={theme.brandGreen} />
              <ThemedText style={styles.doneText}>
                Fatto oggi · {done.minutes} min · {done.kcal} kcal registrate
              </ThemedText>
            </View>
          ) : null}

          <SwipeToStart
            key={`${workout.id}-${done ? 'again' : 'new'}`}
            onStart={() => setRunning(true)}
            accessibilityLabel={`Avvia ${workout.title}`}
            label={done ? 'Scorri per rifarlo' : 'Scorri per iniziare'}
          />
        </View>
      </Reveal>

      <Reveal index={3}>
        <ThemedText style={styles.footnote} themeColor="textTertiary">
          Durata e calorie sono stime sul tuo peso. I carichi indicati sono un punto di partenza da calibrare: dalla seconda volta l’app usa le serie che registri. Al termine l’allenamento viene aggiunto alle calorie di oggi.
        </ThemedText>
      </Reveal>

      <WorkoutSessionModal
        visible={running}
        onClose={() => setRunning(false)}
        title={workout.title}
        exercises={workout.exercises}
        date={today}
        spot={{
          onFinish: (ms) => {
            const minutes = Math.max(1, Math.round(ms / 60000));
            addActivity(workout.activity, workout.intensity, minutes, ctx.weightKg, today);
            const entry = useActivityLogStore.getState().entries.at(-1);
            const kcal = entry?.estimatedKcal ?? 0;
            setDoneToday((d) => ({ ...d, [workout.id]: { minutes, kcal } }));
            return kcal;
          },
        }}
      />

      {info ? (
        <ExerciseInfoModal
          visible
          exerciseName={info.name}
          media={getExerciseMedia(info.id, info.name)}
          sets={info.sets}
          reps={info.reps}
          tempo={info.tempo}
          restLabel={restText(info.restSec)}
          onClose={() => setInfo(null)}
        />
      ) : null}
    </>
  );
}

function Stat({ icon, value, unit, label, divider }: { icon: IconName; value: string; unit?: string; label: string; divider?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, divider && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.border }]}>
      <Icon name={icon} size={15} color={theme.textSecondary} />
      <ThemedText style={styles.statValue} numberOfLines={1}>
        {value}
        {unit ? (
          <ThemedText style={styles.statUnit} themeColor="textSecondary">
            {' '}
            {unit}
          </ThemedText>
        ) : null}
      </ThemedText>
      <ThemedText style={styles.statLabel} themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function ExerciseRow({ exercise, index, first, onPress }: { exercise: TrainingExerciseEntry; index: number; first: boolean; onPress: () => void }) {
  const theme = useTheme();
  const media = getExerciseMedia(exercise.id, exercise.name);
  const load = exercise.suggestedKg != null && exercise.suggestedKg > 0 ? ` · ${String(exercise.suggestedKg).replace('.', ',')} kg` : '';
  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${exercise.name}, ${exercise.sets} serie da ${exercise.reps}. Dettagli`}
      style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
      <View style={styles.thumb}>
        {media ? (
          <Image source={{ uri: media.gifUrl }} style={styles.thumbImage} resizeMode="contain" accessibilityIgnoresInvertColors />
        ) : (
          <Icon name="dumbbellLine" size={22} color={theme.textTertiary} />
        )}
        <View style={[styles.thumbIndex, { backgroundColor: theme.text }]}>
          <ThemedText style={[styles.thumbIndexText, { color: theme.background }]}>{index + 1}</ThemedText>
        </View>
      </View>
      <View style={styles.rowText}>
        <ThemedText style={styles.rowTitle}>{exercise.name}</ThemedText>
        <ThemedText style={styles.rowMeta} themeColor="textSecondary">
          {exercise.sets} × {exercise.reps} · rec. {restText(exercise.restSec)}
          {load}
        </ThemedText>
        {exercise.primaryMuscle ? (
          <ThemedText style={styles.rowMuscle} themeColor="textTertiary">
            {exercise.primaryMuscle}
          </ThemedText>
        ) : null}
      </View>
      <Icon name="chevronRight" size={16} color={theme.textTertiary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.2 },
  place: {},
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexBasis: '23%',
    flexGrow: 1,
    minWidth: 72,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 8,
  },
  tileIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
  card: { borderRadius: 30, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 16 },
  cardHead: { gap: 5 },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
  note: { fontSize: 15, lineHeight: 21 },
  stats: { flexDirection: 'row', borderRadius: 20, borderCurve: 'continuous', paddingVertical: 12 },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 18, lineHeight: 23, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  statLabel: { fontSize: 11, lineHeight: 14, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, height: 26, borderRadius: 13, justifyContent: 'center' },
  chipText: { fontSize: 12, lineHeight: 15, fontWeight: '600' },
  list: { marginTop: -4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  thumb: { width: 60, height: 60, borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImage: { width: 60, height: 60 },
  thumbIndex: { position: 'absolute', top: 4, left: 4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  thumbIndexText: { fontSize: 10, lineHeight: 12, fontWeight: '800' },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  rowMeta: { fontSize: 13, lineHeight: 17, fontVariant: ['tabular-nums'] },
  rowMuscle: { fontSize: 12, lineHeight: 15 },
  doneBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11 },
  doneText: { flexShrink: 1, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  footnote: { fontSize: 12, lineHeight: 17, paddingHorizontal: 4 },
});
