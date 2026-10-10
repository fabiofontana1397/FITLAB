import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Vibration, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { roundLoad } from '@/lib/planning/exercise-library';
import type { TrainingExerciseEntry } from '@/lib/planning/types';
import {
  isExerciseCompleted,
  setsForExerciseOnDate,
  suggestedNextLoadForExercise,
  useTrainingProgressStore,
} from '@/store/training-progress-store';

// Always dark, like a workout app on the gym floor: black canvas, graphite
// tiles, neon green for "go", orange for a set in progress.
const C = {
  bg: '#000000',
  card: '#1C1C1E',
  cardHigh: '#2C2C2E',
  text: '#FFFFFF',
  muted: '#8E8E93',
  green: '#3DF56B',
  orange: '#FF7A00',
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Phase = 'countdown' | 'ready' | 'working' | 'resting' | 'done';

export type WorkoutSessionModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  exercises: TrainingExerciseEntry[];
  /** Day the sets are logged against. */
  date: string;
};

function repRange(reps: string): [number, number] {
  const match = reps.match(/(\d+)(?:\s*-\s*(\d+))?/);
  if (!match) return [8, 8];
  return [Number(match[1]), Number(match[2] ?? match[1])];
}

const isTimed = (ex: TrainingExerciseEntry) => /\bs\b/.test(ex.reps);

function clock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Full-screen guided session ("Inizia allenamento"): a 3-2-1 countdown,
 * then one exercise at a time — sets, reps, tempo, load and a timer that
 * runs the set and the rest after it. Every completed set is logged and an
 * exercise is ticked once all its sets are done, so closing halfway resumes
 * where the user stopped. */
export function WorkoutSessionModal({ visible, onClose, title, exercises, date }: WorkoutSessionModalProps) {
  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      {/* Mounted only while open, so every opening starts from a fresh session state. */}
      {visible && exercises.length > 0 ? <SessionView onClose={onClose} title={title} exercises={exercises} date={date} /> : null}
    </Modal>
  );
}

function SessionView({ onClose, title, exercises, date }: Omit<WorkoutSessionModalProps, 'visible'>) {
  const insets = useSafeAreaInsets();
  const progressSets = useTrainingProgressStore((s) => s.sets);
  const completed = useTrainingProgressStore((s) => s.completed);
  const logSet = useTrainingProgressStore((s) => s.logSet);
  const toggleCompleted = useTrainingProgressStore((s) => s.toggleCompleted);

  // Sets done per exercise today, seeded from what is already logged/ticked;
  // the session opens on the first exercise not finished yet.
  const [initial] = useState(() => {
    const done: Record<string, number> = {};
    for (const ex of exercises) {
      done[ex.id] = isExerciseCompleted(completed, ex.id, date) ? ex.sets : Math.min(setsForExerciseOnDate(progressSets, ex.id, date).length, ex.sets);
    }
    const start = Math.max(0, exercises.findIndex((ex) => done[ex.id] < ex.sets));
    const allDone = exercises.every((ex) => done[ex.id] >= ex.sets);
    return { done, start, allDone, startedAt: Date.now() };
  });
  const [doneMap, setDoneMap] = useState(initial.done);
  const [exIndex, setExIndex] = useState(initial.start);
  const [phase, setPhase] = useState<Phase>(initial.allDone ? 'done' : 'countdown');
  const [loads, setLoads] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(
      exercises.map((ex) => {
        const load = suggestedNextLoadForExercise(progressSets, ex.id, ex.reps, ex.suggestedKg).suggestedKg;
        return [ex.id, ex.suggestedKg == null && !load ? null : load || ex.suggestedKg];
      })
    )
  );
  const [editingLoad, setEditingLoad] = useState(false);
  const [now, setNow] = useState(initial.startedAt);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(60);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [workStartedAt, setWorkStartedAt] = useState<number | null>(null);
  const restBuzzed = useRef(false);
  const holdBuzzed = useRef(false);

  const exercise = exercises[exIndex];
  const setsDone = doneMap[exercise.id] ?? 0;
  const exerciseDone = setsDone >= exercise.sets;
  const timed = isTimed(exercise);
  const load = loads[exercise.id] ?? null;

  useEffect(() => {
    if (phase !== 'resting' && phase !== 'working') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase]);

  const restLeft = pausedLeft ?? (restEndsAt ? Math.max(0, (restEndsAt - now) / 1000) : 0);
  const workElapsed = workStartedAt ? (now - workStartedAt) / 1000 : 0;
  const holdTarget = timed ? repRange(exercise.reps)[1] : 0;
  // Once the rest runs out the screen falls back to "ready" for the next set.
  const restOver = phase === 'resting' && pausedLeft == null && restEndsAt != null && now >= restEndsAt;
  const view: Phase = restOver ? 'ready' : phase;
  const holdOver = phase === 'working' && timed && workElapsed >= holdTarget;

  // One buzz when the rest ends or a timed hold reaches its target.
  useEffect(() => {
    if (restOver && !restBuzzed.current) {
      restBuzzed.current = true;
      Vibration.vibrate(400);
    }
    if (holdOver && !holdBuzzed.current) {
      holdBuzzed.current = true;
      Vibration.vibrate(400);
    }
  }, [restOver, holdOver]);

  const startRest = (seconds: number) => {
    restBuzzed.current = false;
    setRestTotal(seconds);
    setRestEndsAt(Date.now() + seconds * 1000);
    setPausedLeft(null);
    setNow(Date.now());
    setPhase('resting');
  };

  const startSet = () => {
    holdBuzzed.current = false;
    setRestEndsAt(null);
    setPausedLeft(null);
    setWorkStartedAt(Date.now());
    setNow(Date.now());
    setPhase('working');
  };

  const go = (index: number) => {
    setExIndex(index);
    setEditingLoad(false);
    setWorkStartedAt(null);
    // a running rest keeps counting across exercises
    if (phase === 'working') setPhase('ready');
  };

  const completeSet = () => {
    const reps = timed ? Math.round(workElapsed) : repRange(exercise.reps)[1];
    if (!timed && load != null && load > 0) logSet(exercise.id, exercise.name, reps, load, date);
    setWorkStartedAt(null);
    const doneNow = setsDone + 1;
    const nextMap = { ...doneMap, [exercise.id]: doneNow };
    setDoneMap(nextMap);
    if (doneNow < exercise.sets) {
      startRest(exercise.restSec);
      return;
    }
    if (!isExerciseCompleted(completed, exercise.id, date)) toggleCompleted(exercise.id, date);
    if (!exercises.some((ex) => (nextMap[ex.id] ?? 0) < ex.sets)) {
      setPhase('done');
      return;
    }
    const nextIndex = exercises.findIndex((ex, i) => i > exIndex && (nextMap[ex.id] ?? 0) < ex.sets);
    if (nextIndex !== -1) setExIndex(nextIndex);
    startRest(exercise.restSec);
  };

  const togglePause = () => {
    if (pausedLeft != null) {
      setRestEndsAt(Date.now() + pausedLeft * 1000);
      setPausedLeft(null);
      setNow(Date.now());
    } else {
      setPausedLeft(restLeft);
    }
  };

  const skipRest = () => {
    setRestEndsAt(null);
    setPausedLeft(null);
    setPhase('ready');
  };

  const loadStep = load != null && load >= 20 ? 2.5 : 1;
  const changeLoad = (delta: number) =>
    setLoads((l) => ({ ...l, [exercise.id]: Math.max(0, roundLoad((l[exercise.id] ?? 0) + delta)) }));

  if (phase === 'countdown') {
    return (
      <View style={[styles.root, styles.center]}>
        <Countdown onDone={() => setPhase('ready')} />
      </View>
    );
  }

  const isLast = exIndex === exercises.length - 1;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Chiudi allenamento" style={styles.close}>
          <Icon name="close" size={20} color={C.text} />
        </Pressable>
        <ThemedText style={styles.workoutTitle} numberOfLines={1}>
          {title}
        </ThemedText>
        <View style={styles.closeSpacer} />
      </View>

      {view === 'done' ? (
        <DoneView exercises={exercises} doneMap={doneMap} startedAt={initial.startedAt} onClose={onClose} />
      ) : (
        <View style={styles.content}>
          <View style={styles.selector}>
            <NavButton icon="arrowBack" disabled={exIndex === 0} onPress={() => go(exIndex - 1)} label="Esercizio precedente" />
            <View style={styles.selectorText}>
              <ThemedText style={styles.counter}>
                Esercizio {exIndex + 1} di {exercises.length}
              </ThemedText>
              <ThemedText style={styles.exerciseName} numberOfLines={2}>
                {exercise.name}
              </ThemedText>
            </View>
            <NavButton icon="chevronRight" disabled={isLast} onPress={() => go(exIndex + 1)} label="Esercizio successivo" />
          </View>

          <View style={{ alignSelf: 'stretch', gap: 10 }}>
            <View style={styles.infoRow}>
              <Info label="Serie" value={`${Math.min(setsDone + (exerciseDone ? 0 : 1), exercise.sets)}/${exercise.sets}`} />
              <Info label={timed ? 'Durata' : 'Ripetizioni'} value={exercise.reps} />
              <Info label="Modalità" value={exercise.tempo === 'isometria' ? 'Tenuta' : exercise.tempo} />
              <Info
                label="Carico"
                value={load == null ? '—' : `${load} kg`}
                active={editingLoad}
                onPress={load == null ? undefined : () => setEditingLoad((e) => !e)}
              />
            </View>
            {editingLoad && load != null ? (
              <View style={styles.loadEditor}>
                <Pressable onPress={() => changeLoad(-loadStep)} style={styles.loadBtn} accessibilityLabel="Diminuisci carico">
                  <Icon name="trendFlat" size={18} color={C.text} />
                </Pressable>
                <ThemedText style={styles.loadValue}>{load} kg</ThemedText>
                <Pressable onPress={() => changeLoad(loadStep)} style={styles.loadBtn} accessibilityLabel="Aumenta carico">
                  <Icon name="plus" size={18} color={C.text} />
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.timerWrap}>
            {view === 'resting' ? (
              <Pressable onPress={togglePause} accessibilityLabel={pausedLeft != null ? 'Riprendi recupero' : 'Metti in pausa il recupero'}>
                <Ring fraction={restTotal > 0 ? restLeft / restTotal : 0} color={C.green}>
                  <ThemedText style={styles.ringLabel}>{pausedLeft != null ? 'In pausa' : 'Recupero'}</ThemedText>
                  <ThemedText style={styles.ringTime}>{clock(restLeft)}</ThemedText>
                  <ThemedText style={styles.ringHint}>{pausedLeft != null ? 'tocca per riprendere' : 'tocca per mettere in pausa'}</ThemedText>
                </Ring>
              </Pressable>
            ) : view === 'working' ? (
              <Ring fraction={timed ? Math.min(workElapsed / Math.max(holdTarget, 1), 1) : 1} color={C.orange}>
                <ThemedText style={styles.ringLabel}>{timed ? 'Tieni la posizione' : `Serie ${setsDone + 1} in corso`}</ThemedText>
                <ThemedText style={styles.ringTime}>{clock(timed ? Math.max(holdTarget - workElapsed, 0) : workElapsed)}</ThemedText>
              </Ring>
            ) : exerciseDone ? (
              <Ring fraction={1} color={C.green}>
                <Icon name="check" size={64} color={C.green} />
                <ThemedText style={styles.ringLabel}>Completato</ThemedText>
              </Ring>
            ) : (
              <Ring fraction={setsDone / exercise.sets} color={C.orange}>
                <ThemedText style={styles.ringLabel}>Serie</ThemedText>
                <ThemedText style={styles.ringTime}>
                  {setsDone + 1}
                  <ThemedText style={styles.ringTimeSmall}>/{exercise.sets}</ThemedText>
                </ThemedText>
              </Ring>
            )}
          </View>

          <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: 14 }}>
            {view === 'working' ? (
              <PrimaryAction icon="check" label="Serie fatta" onPress={completeSet} />
            ) : exerciseDone && view !== 'resting' ? (
              <PrimaryAction
                icon="chevronRight"
                label={isLast ? 'Termina' : 'Esercizio successivo'}
                onPress={() => (isLast ? setPhase('done') : go(exIndex + 1))}
              />
            ) : (
              <PrimaryAction icon="play" label="Inizia serie" onPress={startSet} />
            )}
            {view === 'resting' ? (
              <Pressable onPress={skipRest} hitSlop={8}>
                <ThemedText style={styles.secondary}>Salta recupero</ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

const COUNT_SIZE = 240;
const COUNT_STROKE = 18;
const COUNT_R = (COUNT_SIZE - COUNT_STROKE) / 2;
const COUNT_CIRC = 2 * Math.PI * COUNT_R;

/** Apple-Watch-style 3-2-1: each second a ring closes around the number. */
function Countdown({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(3);
  const progress = useSharedValue(0);
  const pop = useSharedValue(0.6);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 950 });
    pop.value = 0.6;
    pop.value = withSpring(1, { damping: 12, stiffness: 180 });
    const id = setTimeout(() => {
      if (count > 1) setCount(count - 1);
      else onDone();
    }, 1000);
    return () => clearTimeout(id);
  }, [count, onDone, progress, pop]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: COUNT_CIRC * (1 - progress.value) }));
  const numberStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const color = count === 1 ? C.green : C.orange;

  return (
    <View style={{ alignItems: 'center', gap: 28 }}>
      <View style={{ width: COUNT_SIZE, height: COUNT_SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={COUNT_SIZE} height={COUNT_SIZE} style={StyleSheet.absoluteFill}>
          <Circle cx={COUNT_SIZE / 2} cy={COUNT_SIZE / 2} r={COUNT_R} stroke={C.card} strokeWidth={COUNT_STROKE} fill="none" />
          <AnimatedCircle
            cx={COUNT_SIZE / 2}
            cy={COUNT_SIZE / 2}
            r={COUNT_R}
            stroke={color}
            strokeWidth={COUNT_STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${COUNT_CIRC} ${COUNT_CIRC}`}
            animatedProps={ringProps}
            transform={`rotate(-90 ${COUNT_SIZE / 2} ${COUNT_SIZE / 2})`}
          />
        </Svg>
        <Animated.View style={numberStyle}>
          <ThemedText style={[styles.countNumber, { color }]}>{count}</ThemedText>
        </Animated.View>
      </View>
      <ThemedText style={styles.countLabel}>Preparati</ThemedText>
    </View>
  );
}

function DoneView({
  exercises,
  doneMap,
  startedAt,
  onClose,
}: {
  exercises: TrainingExerciseEntry[];
  doneMap: Record<string, number>;
  startedAt: number;
  onClose: () => void;
}) {
  const [endedAt] = useState(() => Date.now());
  const sets = exercises.reduce((sum, ex) => sum + Math.min(doneMap[ex.id] ?? 0, ex.sets), 0);
  const total = exercises.reduce((sum, ex) => sum + ex.sets, 0);
  return (
    <View style={styles.content}>
      <Ring fraction={1} color={C.green}>
        <Icon name="trophy" size={56} color={C.green} />
      </Ring>
      <ThemedText style={styles.doneTitle}>Allenamento completato</ThemedText>
      <View style={styles.infoRow}>
        <Info label="Durata" value={`${Math.max(1, Math.round((endedAt - startedAt) / 60000))} min`} />
        <Info label="Serie" value={`${sets}/${total}`} />
        <Info label="Esercizi" value={String(exercises.length)} />
      </View>
      <PrimaryAction icon="check" label="Fine" onPress={onClose} />
    </View>
  );
}

function Ring({ fraction, color, children }: { fraction: number; color: string; children: React.ReactNode }) {
  const size = 250;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const f = Math.min(Math.max(fraction, 0), 1);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.card} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - f)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>{children}</View>
    </View>
  );
}

function Info({ label, value, active, onPress }: { label: string; value: string; active?: boolean; onPress?: () => void }) {
  const body = (
    <>
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={[styles.infoValue, active && { color: C.green }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={styles.info} accessibilityLabel={`${label}: ${value}, tocca per modificare`}>
      {body}
    </Pressable>
  ) : (
    <View style={styles.info}>{body}</View>
  );
}

function NavButton({ icon, disabled, onPress, label }: { icon: IconName; disabled: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityLabel={label} style={[styles.nav, { opacity: disabled ? 0.25 : 1 }]}>
      <Icon name={icon} size={22} color={C.text} />
    </Pressable>
  );
}

function PrimaryAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.85 : 1 }]}>
      <Icon name={icon} size={20} color="#000" />
      <ThemedText style={styles.primaryText}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 20,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeSpacer: {
    width: 40,
    height: 40,
  },
  workoutTitle: {
    flex: 1,
    textAlign: 'center',
    color: C.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    gap: 18,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 8,
  },
  selectorText: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  counter: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  exerciseName: {
    color: C.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  nav: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 8,
  },
  info: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: C.card,
  },
  infoLabel: {
    color: C.muted,
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '600',
  },
  infoValue: {
    color: C.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    paddingHorizontal: 4,
  },
  loadEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  loadBtn: {
    width: 44,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.cardHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadValue: {
    color: C.green,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    minWidth: 80,
    textAlign: 'center',
  },
  timerWrap: {
    alignItems: 'center',
  },
  ringLabel: {
    color: C.muted,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600',
  },
  ringTime: {
    color: C.text,
    fontSize: 60,
    lineHeight: 68,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  ringTimeSmall: {
    color: C.muted,
    fontSize: 30,
    fontWeight: '700',
  },
  ringHint: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  primary: {
    alignSelf: 'stretch',
    height: 60,
    borderRadius: 30,
    backgroundColor: C.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: {
    color: '#000',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  secondary: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  countNumber: {
    fontSize: 120,
    lineHeight: 130,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  countLabel: {
    color: C.muted,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
  doneTitle: {
    color: C.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
});
