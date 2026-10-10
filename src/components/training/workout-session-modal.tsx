import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Vibration, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { getExerciseMedia } from '@/lib/exercise-media/exercise-media';
import { roundLoad } from '@/lib/planning/exercise-library';
import type { TrainingExerciseEntry } from '@/lib/planning/types';
import {
  isExerciseCompleted,
  setsForExerciseOnDate,
  suggestedNextLoadForExercise,
  useTrainingProgressStore,
} from '@/store/training-progress-store';

// Always dark, like a workout app on the gym floor: black canvas, graphite
// tiles, neon green for done/go, orange for the countdown.
const C = {
  bg: '#000000',
  card: '#1C1C1E',
  cardHigh: '#2C2C2E',
  text: '#FFFFFF',
  muted: '#8E8E93',
  green: '#3DF56B',
  greenDim: 'rgba(61,245,107,0.16)',
  orange: '#FF7A00',
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Phase = 'countdown' | 'ready' | 'resting' | 'done';

export type WorkoutSessionModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  exercises: TrainingExerciseEntry[];
  /** Day the sets are logged against. */
  date: string;
};

function topReps(reps: string): number {
  const match = reps.match(/(\d+)(?:\s*-\s*(\d+))?/);
  return match ? Number(match[2] ?? match[1]) : 8;
}

const isTimed = (ex: TrainingExerciseEntry) => /\bs\b/.test(ex.reps);

function clock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Full-screen guided session ("Inizia allenamento"): a 3-2-1 countdown,
 * then one exercise at a time — GIF, sets, reps, tempo, load — and a rest
 * countdown after every set. Every completed set is logged and an exercise
 * is ticked once all its sets are done, so closing halfway resumes where the
 * user stopped. */
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
  /** The exercise + set number the running rest follows, for the "Serie 2 fatta" label. */
  const [restAfter, setRestAfter] = useState<{ name: string; set: number } | null>(null);
  const restBuzzed = useRef(false);

  const exercise = exercises[exIndex];
  const setsDone = doneMap[exercise.id] ?? 0;
  const exerciseDone = setsDone >= exercise.sets;
  const timed = isTimed(exercise);
  const load = loads[exercise.id] ?? null;
  const media = getExerciseMedia(exercise.id);

  useEffect(() => {
    if (phase !== 'resting') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase]);

  const restLeft = pausedLeft ?? (restEndsAt ? Math.max(0, (restEndsAt - now) / 1000) : 0);
  // Once the rest runs out the screen falls back to "ready" for the next set.
  const restOver = phase === 'resting' && pausedLeft == null && restEndsAt != null && now >= restEndsAt;
  const view: Phase = restOver ? 'ready' : phase;

  // One buzz when the rest ends.
  useEffect(() => {
    if (restOver && !restBuzzed.current) {
      restBuzzed.current = true;
      Vibration.vibrate(400);
    }
  }, [restOver]);

  const startRest = (seconds: number) => {
    restBuzzed.current = false;
    setRestTotal(seconds);
    setRestEndsAt(Date.now() + seconds * 1000);
    setPausedLeft(null);
    setNow(Date.now());
    setPhase('resting');
  };

  const go = (index: number) => {
    setExIndex(index);
    setEditingLoad(false);
  };

  const completeSet = () => {
    if (!timed && load != null && load > 0) logSet(exercise.id, exercise.name, topReps(exercise.reps), load, date);
    Vibration.vibrate(60);
    const doneNow = setsDone + 1;
    const nextMap = { ...doneMap, [exercise.id]: doneNow };
    setDoneMap(nextMap);
    setRestAfter({ name: exercise.name, set: doneNow });
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

          {media ? (
            <View style={styles.gifBox}>
              <Image source={{ uri: media.gifUrl }} style={styles.gif} resizeMode="contain" accessibilityLabel={`Esecuzione: ${exercise.name}`} />
            </View>
          ) : null}

          <View style={{ alignSelf: 'stretch', gap: 10 }}>
            <View style={styles.infoRow}>
              <Info label="Serie" value={String(exercise.sets)} />
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

          {view === 'resting' ? (
            <Pressable onPress={togglePause} accessibilityLabel={pausedLeft != null ? 'Riprendi recupero' : 'Metti in pausa il recupero'}>
              <CountdownRing fraction={restTotal > 0 ? restLeft / restTotal : 0}>
                {restAfter ? (
                  <View style={styles.doneBadge}>
                    <Icon name="check" size={13} color={C.green} />
                    <ThemedText style={styles.doneBadgeText}>Serie {restAfter.set} fatta</ThemedText>
                  </View>
                ) : null}
                <ThemedText style={styles.ringTime}>{clock(restLeft)}</ThemedText>
                <ThemedText style={styles.ringHint}>{pausedLeft != null ? 'in pausa · tocca per riprendere' : 'recupero · tocca per la pausa'}</ThemedText>
              </CountdownRing>
            </Pressable>
          ) : (
            <SetsRing total={exercise.sets} done={setsDone}>
              {exerciseDone ? (
                <>
                  <Icon name="check" size={58} color={C.green} />
                  <ThemedText style={[styles.ringLabel, { color: C.green }]}>Completato</ThemedText>
                </>
              ) : (
                <>
                  <ThemedText style={styles.ringLabel}>Serie</ThemedText>
                  <ThemedText style={styles.ringTime}>
                    {setsDone + 1}
                    <ThemedText style={styles.ringTimeSmall}>/{exercise.sets}</ThemedText>
                  </ThemedText>
                  <ThemedText style={styles.ringHint}>
                    {exercise.sets - setsDone === 1 ? 'ultima serie' : `${setsDone} ${setsDone === 1 ? 'fatta' : 'fatte'} · ${exercise.sets - setsDone} da fare`}
                  </ThemedText>
                </>
              )}
            </SetsRing>
          )}

          {view === 'resting' ? (
            <PrimaryAction icon="play" label="Salta recupero" onPress={skipRest} />
          ) : exerciseDone ? (
            <PrimaryAction
              icon="chevronRight"
              label={isLast ? 'Termina' : 'Esercizio successivo'}
              onPress={() => (isLast ? setPhase('done') : go(exIndex + 1))}
            />
          ) : (
            <PrimaryAction icon="check" label={`Serie ${setsDone + 1} fatta`} onPress={completeSet} />
          )}
        </View>
      )}
    </View>
  );
}

const RING = 220;
const RING_STROKE = 14;
const RING_R = (RING - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_R;

/** One arc per set: done sets glow green, the next one is outlined, and the
 * arc that just got completed pops in. */
function SetsRing({ total, done, children }: { total: number; done: number; children: React.ReactNode }) {
  // round caps grow each arc by half a stroke per end, so the gap must exceed one stroke
  const gap = total > 1 ? RING_STROKE + 10 : 0;
  const seg = RING_CIRC / total;
  const pop = useSharedValue(1);
  const prevDone = useRef(done);

  useEffect(() => {
    if (done > prevDone.current) pop.value = withSequence(withTiming(1.06, { duration: 140 }), withSpring(1, { damping: 10, stiffness: 200 }));
    prevDone.current = done;
  }, [done, pop]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Animated.View style={[{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }, popStyle]}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        {Array.from({ length: total }, (_, i) => {
          const isDone = i < done;
          const isNext = i === done;
          return (
            <Circle
              key={i}
              cx={RING / 2}
              cy={RING / 2}
              r={RING_R}
              stroke={isDone ? C.green : isNext ? C.cardHigh : C.card}
              strokeWidth={isNext ? RING_STROKE + 2 : RING_STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${Math.max(seg - gap, 1)} ${RING_CIRC}`}
              strokeDashoffset={-(i * seg + gap / 2)}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          );
        })}
      </Svg>
      {done >= total ? <View style={[StyleSheet.absoluteFill, styles.glow]} pointerEvents="none" /> : null}
      <View style={{ alignItems: 'center' }}>{children}</View>
    </Animated.View>
  );
}

function CountdownRing({ fraction, children }: { fraction: number; children: React.ReactNode }) {
  const f = Math.min(Math.max(fraction, 0), 1);
  return (
    <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={RING_R} stroke={C.card} strokeWidth={RING_STROKE} fill="none" />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RING_R}
          stroke={C.green}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${RING_CIRC} ${RING_CIRC}`}
          strokeDashoffset={RING_CIRC * (1 - f)}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <View style={{ alignItems: 'center', gap: 2 }}>{children}</View>
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
      <SetsRing total={1} done={1}>
        <Icon name="trophy" size={56} color={C.green} />
      </SetsRing>
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
    gap: 14,
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
    fontSize: 26,
    lineHeight: 31,
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
  gifBox: {
    width: 128,
    height: 128,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  gif: {
    width: '100%',
    height: '100%',
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
  glow: {
    borderRadius: RING / 2,
    backgroundColor: C.greenDim,
    margin: RING_STROKE + 6,
  },
  ringLabel: {
    color: C.muted,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600',
  },
  ringTime: {
    color: C.text,
    fontSize: 56,
    lineHeight: 64,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  ringTimeSmall: {
    color: C.muted,
    fontSize: 28,
    fontWeight: '700',
  },
  ringHint: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: C.greenDim,
  },
  doneBadgeText: {
    color: C.green,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
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
