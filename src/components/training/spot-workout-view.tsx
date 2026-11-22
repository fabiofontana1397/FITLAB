import { useMemo, useRef, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ExerciseInfoModal } from '@/components/training/exercise-info-modal';
import { SwipeToStart } from '@/components/training/swipe-to-start';
import { WorkoutSessionModal } from '@/components/training/workout-session-modal';
import { Icon, type IconName } from '@/components/ui/icon';
import { ListGroup } from '@/components/ui/list-group';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { SwipeDeck, SwipeDeckKeepDrag } from '@/components/ui/swipe-deck';
import { HorizontalScrollDefaults } from '@/constants/scroll';
import { useTheme } from '@/hooks/use-theme';
import { useUserContext } from '@/hooks/use-user-context';
import { getExerciseMedia } from '@/lib/exercise-media/exercise-media';
import { daysAgoISO } from '@/lib/mock/dates';
import { openPopup } from '@/lib/open-popup';
import type { Level } from '@/lib/planning/training/profile';
import { SPOT_FOCUS, spotProposals, type SpotFocus, type SpotPlace, type SpotWorkout } from '@/lib/planning/training/spot-workouts';
import type { TrainingExerciseEntry } from '@/lib/planning/types';
import { useActivityLogStore } from '@/store/activity-log-store';

const FOCUS_ICON: Record<SpotFocus, IconName> = {
  glutes: 'muscleGlutes',
  legs: 'muscleLegs',
  chest: 'muscleChest',
  back: 'muscleBack',
  shoulders: 'muscleShoulders',
  arms: 'bicepsLine',
  core: 'muscleCore',
  total: 'personLine',
  functional: 'kettlebellLine',
  cross: 'barbellLine',
  hiit: 'timerLine',
};

const PLACE_LABEL: Record<SpotPlace, string> = { gym: 'Palestra', home: 'Casa' };

const LEVEL_OF: Record<string, Level> = { beginner: 'beginner', intermediate: 'intermediate', expert: 'advanced' };

/** Height of one exercise row in the card's preview: as many as fit are shown, the rest are in "Vedi allenamento". */
const PREVIEW_ROW = 52;
/** The GIF strip shown instead when the list does not fit. */
const STRIP_THUMB = 52;
const STRIP_GAP = 8;
const STRIP_MIN_H = STRIP_THUMB + 4;
/** Card heights under which the description, then the numbers' box, are left out. */
const NOTE_MIN_H = 430;
const STATS_MIN_H = 370;

function restText(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')} min`;
}

/**
 * Allenamento veloce, on one screen with no scrolling: what to train (one row of small goals, from glutes to HIIT),
 * where (Palestra / Casa), then the proposals for it as a stack of cards that fills the rest of the page, with the
 * selector to move through them under it, as in Ricette. Each card shows duration, calories and the exercises that
 * fit; "Vedi allenamento" opens the whole workout in a sheet, and the slider starts it. At the end the session is
 * logged to today's calories as an activity.
 */
export function SpotWorkoutView() {
  const theme = useTheme();
  const ctx = useUserContext();
  const addActivity = useActivityLogStore((s) => s.addEntry);
  const today = daysAgoISO(0);
  const [focus, setFocus] = useState<SpotFocus>('glutes');
  const [place, setPlace] = useState<SpotPlace>(ctx.training?.location === 'home' ? 'home' : 'gym');
  const [running, setRunning] = useState<SpotWorkout | null>(null);
  const [detail, setDetail] = useState<SpotWorkout | null>(null);
  const [info, setInfo] = useState<TrainingExerciseEntry | null>(null);
  // Workouts finished today (by id): minutes and kcal logged.
  const [doneToday, setDoneToday] = useState<Record<string, { minutes: number; kcal: number }>>({});

  const level = LEVEL_OF[ctx.training?.gym?.skill ?? ''] ?? 'intermediate';
  const proposals = useMemo(
    () => spotProposals(focus, place, today, { weightKg: ctx.weightKg, sex: ctx.sex, age: ctx.age, level }),
    [focus, place, today, ctx.weightKg, ctx.sex, ctx.age, level]
  );

  return (
    <View style={styles.root}>
      {/* Every goal on one row that scrolls sideways. */}
      <ScrollView {...HorizontalScrollDefaults} style={styles.goalsScroll} contentContainerStyle={styles.goals}>
        {SPOT_FOCUS.map((f) => {
          const active = f.value === focus;
          const fg = active ? theme.background : theme.text;
          return (
            <PressableScale
              key={f.value}
              onPress={() => setFocus(f.value)}
              haptic="tap"
              scaleTo={0.94}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${f.label}: ${f.blurb}`}
              style={[styles.goal, { backgroundColor: active ? theme.text : theme.backgroundElevated, borderColor: active ? theme.text : theme.boxEdge }]}>
              <Icon name={FOCUS_ICON[f.value]} size={17} color={fg} strokeWidth={1.8} />
              <ThemedText style={[styles.goalLabel, { color: fg }]} numberOfLines={1}>
                {f.label}
              </ThemedText>
            </PressableScale>
          );
        })}
      </ScrollView>

      <SegmentedControl
        options={[
          { value: 'gym', label: 'Palestra' },
          { value: 'home', label: 'Casa' },
        ]}
        value={place}
        onChange={(v) => setPlace(v as SpotPlace)}
      />

      <View style={styles.deckArea}>
        <SwipeDeck
          fill
          items={proposals}
          keyOf={(w) => w.id}
          resetKey={`${focus}-${place}`}
          hint="Scorri per cambiare proposta"
          prevLabel="Proposta precedente"
          nextLabel="Proposta successiva"
          renderCard={(w, top) => (
            <WorkoutCard
              workout={w}
              placeLabel={PLACE_LABEL[place]}
              done={doneToday[w.id]}
              onStart={() => {
                if (top) setRunning(w);
              }}
              onOpen={() => {
                if (top) openPopup(() => setDetail(w));
              }}
              onExercise={(ex) => {
                if (top) setInfo(ex);
              }}
            />
          )}
        />
      </View>

      <WorkoutDetailSheet
        workout={detail}
        placeLabel={PLACE_LABEL[place]}
        done={detail ? doneToday[detail.id] : undefined}
        onClose={() => setDetail(null)}
        onStart={(w) => setRunning(w)}
      />

      {running ? (
        <WorkoutSessionModal
          visible
          onClose={() => setRunning(null)}
          title={running.title}
          exercises={running.exercises}
          date={today}
          spot={{
            onFinish: (ms) => {
              const minutes = Math.max(1, Math.round(ms / 60000));
              addActivity(running.activity, running.intensity, minutes, ctx.weightKg, today);
              const entry = useActivityLogStore.getState().entries.at(-1);
              const kcal = entry?.estimatedKcal ?? 0;
              setDoneToday((d) => ({ ...d, [running.id]: { minutes, kcal } }));
              return kcal;
            },
          }}
        />
      ) : null}

      {info ? <ExerciseInfo exercise={info} onClose={() => setInfo(null)} /> : null}
    </View>
  );
}

function ExerciseInfo({ exercise, onClose }: { exercise: TrainingExerciseEntry; onClose: () => void }) {
  return (
    <ExerciseInfoModal
      visible
      exerciseName={exercise.name}
      media={getExerciseMedia(exercise.id, exercise.name)}
      sets={exercise.sets}
      reps={exercise.reps}
      tempo={exercise.tempo}
      restLabel={restText(exercise.restSec)}
      onClose={onClose}
    />
  );
}

/** One proposal: the card of the deck, as tall as the space left on the page. */
function WorkoutCard({
  workout,
  placeLabel,
  done,
  onStart,
  onOpen,
  onExercise,
}: {
  workout: SpotWorkout;
  placeLabel: string;
  done?: { minutes: number; kcal: number };
  onStart: () => void;
  onOpen: () => void;
  onExercise: (ex: TrainingExerciseEntry) => void;
}) {
  const theme = useTheme();
  // The space between the numbers and the buttons: the list of exercises when it all fits, otherwise a strip of
  // their GIFs (the names are in "Vedi allenamento").
  const [area, setArea] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  // On a short screen the card gives up its description first, then the numbers' box (they move to one line).
  const [cardH, setCardH] = useState(0);
  const withNote = cardH === 0 || cardH >= NOTE_MIN_H;
  const withStats = cardH === 0 || cardH >= STATS_MIN_H;
  const total = workout.exercises.length;
  const asList = area.h >= total * PREVIEW_ROW;
  const thumbsFit = Math.max(Math.floor((area.w + STRIP_GAP) / (STRIP_THUMB + STRIP_GAP)), 1);
  const thumbs = thumbsFit >= total ? total : thumbsFit - 1;
  const more = total - thumbs;

  return (
    <View
      style={[styles.card, { backgroundColor: theme.backgroundElevated, borderColor: theme.boxEdge }]}
      onLayout={(e: LayoutChangeEvent) => {
        const h = Math.round(e.nativeEvent.layout.height);
        setCardH((prev) => (prev === h ? prev : h));
      }}>
      <View style={styles.cardHead}>
        <ThemedText style={[styles.eyebrow, { color: theme.accent }]}>
          {workout.focusLabel} · {placeLabel}
        </ThemedText>
        <ThemedText style={styles.title} numberOfLines={1}>
          {workout.title}
        </ThemedText>
        {withStats ? null : (
          <ThemedText style={styles.note} themeColor="textSecondary" numberOfLines={1}>
            {workout.minutes} min · {workout.kcal} kcal · {total} esercizi · {workout.totalSets} serie
          </ThemedText>
        )}
        {withNote ? (
          <ThemedText style={styles.note} themeColor="textSecondary" numberOfLines={2}>
            {workout.note}
          </ThemedText>
        ) : null}
      </View>

      {withStats ? <Stats workout={workout} /> : null}

      <View
        style={styles.preview}
        onLayout={(e: LayoutChangeEvent) => {
          const w = Math.round(e.nativeEvent.layout.width);
          const h = Math.round(e.nativeEvent.layout.height);
          setArea((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
        }}>
        {area.h < STRIP_MIN_H ? null : asList ? (
          workout.exercises.map((ex, i) => <ExerciseRow key={ex.id} exercise={ex} first={i === 0} compact onPress={() => onExercise(ex)} />)
        ) : (
          <View style={styles.strip}>
            <ThemedText style={styles.stripLabel} themeColor="textSecondary" numberOfLines={1}>
              {total} esercizi · {workout.exercises.map((ex) => ex.name).join(', ')}
            </ThemedText>
            <View style={styles.stripRow}>
              {workout.exercises.slice(0, thumbs).map((ex) => (
                <ExerciseThumb key={ex.id} exercise={ex} onPress={() => onExercise(ex)} />
              ))}
              {more > 0 ? (
                <PressableScale
                  onPress={onOpen}
                  haptic="tap"
                  scaleTo={0.94}
                  accessibilityRole="button"
                  accessibilityLabel={`Altri ${more} esercizi: vedi allenamento`}
                  style={[styles.stripThumb, styles.stripMore, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={styles.stripMoreText} themeColor="textSecondary">
                    +{more}
                  </ThemedText>
                </PressableScale>
              ) : null}
            </View>
          </View>
        )}
      </View>

      {done ? (
        <View style={[styles.doneBanner, { backgroundColor: theme.successSoft }]}>
          <Icon name="checkCircle" size={18} color={theme.brandGreen} />
          <ThemedText style={styles.doneText} numberOfLines={1}>
            Fatto oggi · {done.minutes} min · {done.kcal} kcal
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.actions}>
        <PressableScale
          onPress={onOpen}
          haptic="tap"
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel={`Vedi allenamento ${workout.title}`}
          style={[styles.viewButton, { backgroundColor: theme.backgroundElement }]}>
          <Icon name="list" size={17} color={theme.text} />
          <ThemedText style={styles.viewText}>Vedi allenamento</ThemedText>
        </PressableScale>

        <SwipeDeckKeepDrag>
          <SwipeToStart
            key={done ? 'again' : 'new'}
            onStart={onStart}
            accessibilityLabel={`Avvia ${workout.title}`}
            label={done ? 'Scorri per rifarlo' : 'Scorri per iniziare'}
          />
        </SwipeDeckKeepDrag>
      </View>
    </View>
  );
}

/** One exercise in the card's strip: its GIF, a tap for the details. */
function ExerciseThumb({ exercise, onPress }: { exercise: TrainingExerciseEntry; onPress: () => void }) {
  const theme = useTheme();
  const media = getExerciseMedia(exercise.id, exercise.name);
  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={`${exercise.name}, ${exercise.sets} serie da ${exercise.reps}. Dettagli`}
      style={[styles.thumb, styles.stripThumb]}>
      {media ? (
        <Image source={{ uri: media.gifUrl }} style={styles.stripImage} resizeMode="contain" accessibilityIgnoresInvertColors />
      ) : (
        <Icon name="dumbbellLine" size={20} color={theme.textTertiary} />
      )}
    </PressableScale>
  );
}

/** "Vedi allenamento": the whole workout in a sheet, every exercise with its GIF, and the slider to start it. */
function WorkoutDetailSheet({
  workout,
  ...rest
}: {
  workout: SpotWorkout | null;
  placeLabel: string;
  done?: { minutes: number; kcal: number };
  onClose: () => void;
  onStart: (w: SpotWorkout) => void;
}) {
  return (
    // The sheet animates itself, so the Modal only has to be transparent.
    <Modal visible={workout != null} transparent animationType="none" statusBarTranslucent onRequestClose={rest.onClose}>
      {workout ? <WorkoutDetail key={workout.id} workout={workout} {...rest} /> : null}
    </Modal>
  );
}

function WorkoutDetail({
  workout,
  placeLabel,
  done,
  onClose,
  onStart,
}: {
  workout: SpotWorkout;
  placeLabel: string;
  done?: { minutes: number; kcal: number };
  onClose: () => void;
  onStart: (w: SpotWorkout) => void;
}) {
  const theme = useTheme();
  const [info, setInfo] = useState<TrainingExerciseEntry | null>(null);
  // Set by the slider: the session starts once the sheet has gone.
  const startAfterClose = useRef(false);

  return (
    <SheetScreen
      title={workout.title}
      eyebrow={`${workout.focusLabel} · ${placeLabel}`}
      onClose={() => {
        onClose();
        if (startAfterClose.current) onStart(workout);
      }}
      contentContainerStyle={styles.sheetContent}
      footer={(close) => (
        <SwipeToStart
          key={done ? 'again' : 'new'}
          onStart={() => {
            startAfterClose.current = true;
            close();
          }}
          accessibilityLabel={`Avvia ${workout.title}`}
          label={done ? 'Scorri per rifarlo' : 'Scorri per iniziare'}
        />
      )}>
      <ThemedText style={styles.sheetNote} themeColor="textSecondary">
        {workout.note}
      </ThemedText>

      <Stats workout={workout} />

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

      {done ? (
        <View style={[styles.doneBanner, { backgroundColor: theme.successSoft }]}>
          <Icon name="checkCircle" size={18} color={theme.brandGreen} />
          <ThemedText style={styles.doneText}>
            Fatto oggi · {done.minutes} min · {done.kcal} kcal registrate
          </ThemedText>
        </View>
      ) : null}

      <ListGroup header={`${workout.exercises.length} esercizi · ${workout.totalSets} serie`}>
        {workout.exercises.map((ex, i) => (
          <View key={ex.id} style={styles.sheetRow}>
            <ExerciseRow exercise={ex} first={i === 0} onPress={() => setInfo(ex)} plain />
          </View>
        ))}
      </ListGroup>

      <ThemedText style={styles.footnote} themeColor="textTertiary">
        Durata e calorie sono stime sul tuo peso. I carichi indicati sono un punto di partenza da calibrare: dalla seconda volta l’app usa le serie che registri. Al termine l’allenamento viene aggiunto alle calorie di oggi.
      </ThemedText>

      {info ? <ExerciseInfo exercise={info} onClose={() => setInfo(null)} /> : null}
    </SheetScreen>
  );
}

function Stats({ workout }: { workout: SpotWorkout }) {
  const theme = useTheme();
  return (
    <View style={[styles.stats, { backgroundColor: theme.backgroundElement }]}>
      <Stat icon="clock" value={`${workout.minutes}`} unit="min" label="Durata" />
      <Stat icon="flame" value={`${workout.kcal}`} unit="kcal" label="Calorie" divider />
      <Stat icon="dumbbellLine" value={`${workout.exercises.length}`} label="Esercizi" divider />
      <Stat icon="repsHash" value={`${workout.totalSets}`} label="Serie" divider />
    </View>
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

function ExerciseRow({
  exercise,
  first,
  onPress,
  compact,
  plain,
}: {
  exercise: TrainingExerciseEntry;
  first: boolean;
  onPress: () => void;
  /** The card's preview: a smaller GIF and no muscle line, so more rows fit. */
  compact?: boolean;
  /** Inside a grouped list, which draws its own separators. */
  plain?: boolean;
}) {
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
      style={[styles.row, compact && styles.rowCompact, !first && !plain && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
      <View style={[styles.thumb, compact && styles.thumbCompact]}>
        {media ? (
          <Image source={{ uri: media.gifUrl }} style={compact ? styles.thumbImageCompact : styles.thumbImage} resizeMode="contain" accessibilityIgnoresInvertColors />
        ) : (
          <Icon name="dumbbellLine" size={compact ? 18 : 22} color={theme.textTertiary} />
        )}
      </View>
      <View style={styles.rowText}>
        <ThemedText style={styles.rowTitle} numberOfLines={1}>
          {exercise.name}
        </ThemedText>
        <ThemedText style={styles.rowMeta} themeColor="textSecondary">
          {exercise.sets} × {exercise.reps} · rec. {restText(exercise.restSec)}
          {load}
        </ThemedText>
        {exercise.primaryMuscle && !compact ? (
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
  // The page does not scroll: the deck takes the height left under the two selectors.
  root: { flex: 1, gap: 12 },
  goalsScroll: { marginHorizontal: -16, flexGrow: 0 },
  goals: { paddingHorizontal: 16, gap: 6 },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingLeft: 11,
    paddingRight: 13,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  goalLabel: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
  deckArea: { flex: 1, minHeight: 0, marginTop: -6 },
  card: { flex: 1, borderRadius: 30, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12, overflow: 'hidden' },
  cardHead: { gap: 3 },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  title: { fontSize: 21, lineHeight: 26, fontWeight: '700', letterSpacing: -0.4 },
  note: { fontSize: 14, lineHeight: 19 },
  stats: { flexDirection: 'row', borderRadius: 20, borderCurve: 'continuous', paddingVertical: 10 },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 17, lineHeight: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  statLabel: { fontSize: 11, lineHeight: 14, fontWeight: '500' },
  preview: { flex: 1, minHeight: 0, overflow: 'hidden' },
  strip: { flex: 1, justifyContent: 'center', gap: 8 },
  stripLabel: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  stripRow: { flexDirection: 'row', gap: STRIP_GAP },
  stripThumb: { width: STRIP_THUMB, height: STRIP_THUMB, borderRadius: 14 },
  stripImage: { width: STRIP_THUMB, height: STRIP_THUMB },
  stripMore: { alignItems: 'center', justifyContent: 'center' },
  stripMoreText: { fontSize: 15, lineHeight: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  actions: { gap: 8 },
  viewButton: { height: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  viewText: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, height: 26, borderRadius: 13, justifyContent: 'center' },
  chipText: { fontSize: 12, lineHeight: 15, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowCompact: { height: PREVIEW_ROW, paddingVertical: 0, gap: 10 },
  thumb: { width: 60, height: 60, borderRadius: 16, borderCurve: 'continuous', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbCompact: { width: 42, height: 42, borderRadius: 12 },
  thumbImage: { width: 60, height: 60 },
  thumbImageCompact: { width: 42, height: 42 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  rowMeta: { fontSize: 13, lineHeight: 17, fontVariant: ['tabular-nums'] },
  rowMuscle: { fontSize: 12, lineHeight: 15 },
  doneBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  doneText: { flexShrink: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  sheetContent: { gap: 16 },
  sheetNote: { fontSize: 15, lineHeight: 21 },
  sheetRow: { paddingHorizontal: 14 },
  footnote: { fontSize: 12, lineHeight: 17, paddingHorizontal: 4 },
});
