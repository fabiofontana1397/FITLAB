import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Vibration, View } from 'react-native';
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

import { SpringCountPop, TimingCountdown, TimingTap } from '@/constants/motion';
import { useMotionPreference } from '@/hooks/use-motion-preference';
import { useUserContext } from '@/hooks/use-user-context';
import { bmr, gymSessionKcal } from '@/domain/energy';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { SessionColors } from '@/constants/theme';
import { getExerciseMedia } from '@/lib/exercise-media/exercise-media';
import { roundLoad } from '@/lib/planning/exercise-library';
import type { TrainingExerciseEntry } from '@/lib/planning/types';
import {
  isExerciseCompleted,
  setsForExerciseOnDate,
  suggestedNextLoadForExercise,
  useTrainingProgressStore,
} from '@/store/training-progress-store';
import { hapticHeavy, hapticPress, hapticSelection, hapticTap } from '@/lib/haptics';
import { savedElapsedMs, useWorkoutSessionStore } from '@/store/workout-session-store';

// A white canvas with light grey tiles, green for done/go, orange for the
// countdown and the watch's yellow for the running clock. The palette lives in
// constants/theme.ts (SessionColors) with the rest of the tokens.
const C = {
  bg: SessionColors.background,
  card: SessionColors.card,
  cardHigh: SessionColors.cardHigh,
  text: SessionColors.text,
  muted: SessionColors.muted,
  green: SessionColors.go,
  greenDim: SessionColors.goSoft,
  onGreen: SessionColors.onGo,
  orange: SessionColors.accent,
  clock: SessionColors.clock,
  danger: SessionColors.danger,
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
  const { modalAnimation } = useMotionPreference();
  return (
    <Modal visible={visible} animationType={modalAnimation('fade')} presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      {/* Mounted only while open, so every opening starts from a fresh session state. */}
      {visible && exercises.length > 0 ? <SessionView onClose={onClose} title={title} exercises={exercises} date={date} /> : null}
    </Modal>
  );
}

/** The watch's clock: "00:03,58" (mm:ss,cc), with the hour in front once it passes 60 min. */
function watchClock(ms: number): string {
  const total = Math.max(0, ms);
  const cc = Math.floor((total % 1000) / 10);
  const sec = Math.floor(total / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${h > 0 ? `${h}:` : ''}${mm}:${ss},${String(cc).padStart(2, '0')}`;
}

/** kcal burned `ms` into the workout: the active ones (the net cost of lifting) and the total, which adds the body's resting burn over the same time. */
function sessionKcalAt(ms: number, weightKg: number, bmrPerDay: number): { active: number; total: number } {
  const active = gymSessionKcal(weightKg, ms / 60000);
  return { active, total: active + Math.round((bmrPerDay * ms) / 86400000) };
}

function SessionView({ onClose, title, exercises, date }: Omit<WorkoutSessionModalProps, 'visible'>) {
  const insets = useSafeAreaInsets();
  const ctx = useUserContext();
  const bmrPerDay = bmr(ctx);
  const progressSets = useTrainingProgressStore((s) => s.sets);
  const completed = useTrainingProgressStore((s) => s.completed);
  const logSet = useTrainingProgressStore((s) => s.logSet);
  const toggleCompleted = useTrainingProgressStore((s) => s.toggleCompleted);
  const saveSession = useWorkoutSessionStore((s) => s.save);
  const clearSession = useWorkoutSessionStore((s) => s.clear);

  // A session left with the X for this same day (and still matching the plan) reopens where it stopped,
  // with no countdown; otherwise it starts fresh. Sets done per exercise are seeded from what is already
  // logged/ticked, and the session opens on the first exercise not finished yet.
  const [initial] = useState(() => {
    const saved = useWorkoutSessionStore.getState().active;
    const resume = saved && saved.date === date && saved.exIndex < exercises.length && exercises.every((ex) => ex.id in saved.doneMap) ? saved : null;
    const done: Record<string, number> = {};
    for (const ex of exercises) {
      done[ex.id] = isExerciseCompleted(completed, ex.id, date) ? ex.sets : Math.min(setsForExerciseOnDate(progressSets, ex.id, date).length, ex.sets);
    }
    const start = Math.max(0, exercises.findIndex((ex) => done[ex.id] < ex.sets));
    const allDone = exercises.every((ex) => done[ex.id] >= ex.sets);
    const t = Date.now();
    if (resume && !allDone) {
      const doneResumed = { ...done, ...resume.doneMap };
      return {
        resumed: true,
        done: doneResumed,
        start: resume.exIndex,
        allDone: false,
        startedAt: resume.startedAt,
        bankMs: savedElapsedMs(resume),
        phase: resume.phase as Phase,
        restTotal: resume.restTotal,
        // the rest that was frozen when the session was left picks up where it stopped
        restEndsAt: resume.phase === 'resting' ? t + (resume.pausedLeft ?? Math.max(0, ((resume.restEndsAt ?? t) - t) / 1000)) * 1000 : null,
        restAfter: resume.restAfter,
        loads: resume.loads,
        t,
      };
    }
    return { resumed: false, done, start, allDone, startedAt: t, bankMs: 0, phase: (allDone ? 'done' : 'countdown') as Phase, restTotal: 60, restEndsAt: null as number | null, restAfter: null, loads: null, t };
  });
  const [doneMap, setDoneMap] = useState(initial.done);
  const [exIndex, setExIndex] = useState(initial.start);
  const [phase, setPhase] = useState<Phase>(initial.phase);
  const [loads, setLoads] = useState<Record<string, number | null>>(
    () =>
      initial.loads ??
      Object.fromEntries(
        exercises.map((ex) => {
          const load = suggestedNextLoadForExercise(progressSets, ex.id, ex.reps, ex.suggestedKg).suggestedKg;
          return [ex.id, ex.suggestedKg == null && !load ? null : load || ex.suggestedKg];
        })
      )
  );
  const [editingLoad, setEditingLoad] = useState(false);
  const [now, setNow] = useState(initial.t);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(initial.restEndsAt);
  const [restTotal, setRestTotal] = useState(initial.restTotal);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  /** The exercise + set number the running rest follows, for the "Serie 2 fatta" label. */
  const [restAfter, setRestAfter] = useState<{ name: string; set: number } | null>(initial.restAfter);
  const restBuzzed = useRef(false);
  // The workout clock: time banked before this run segment, and when the segment began (null = paused).
  const [bankMs, setBankMs] = useState(initial.bankMs);
  const [runSince, setRunSince] = useState<number | null>(initial.resumed ? initial.t : null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [finalMs, setFinalMs] = useState(0);

  const exercise = exercises[exIndex];
  const setsDone = doneMap[exercise.id] ?? 0;
  const exerciseDone = setsDone >= exercise.sets;
  const timed = isTimed(exercise);
  const load = loads[exercise.id] ?? null;
  const media = getExerciseMedia(exercise.id);
  const paused = runSince == null && phase !== 'countdown' && phase !== 'done';

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

  /** The workout's time so far, banked + the running segment. */
  const elapsedAt = (t: number) => bankMs + (runSince != null ? Math.max(0, t - runSince) : 0);

  // Keep the session saved as it changes, so "Riprendi" always has the latest point.
  useEffect(() => {
    if (phase === 'countdown' || phase === 'done') return;
    saveSession({
      date,
      title,
      startedAt: initial.startedAt,
      elapsedMs: bankMs,
      runSince,
      savedAt: Date.now(),
      exIndex,
      doneMap,
      loads,
      phase,
      restTotal,
      restEndsAt,
      pausedLeft,
      restAfter,
    });
  }, [phase, exIndex, doneMap, loads, bankMs, runSince, restEndsAt, pausedLeft, restTotal, restAfter, date, title, initial.startedAt, saveSession]);

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

  /** Ends the workout (all sets done, or "Fine"): freezes the clock and clears the saved session. */
  const finishWorkout = () => {
    setFinalMs(elapsedAt(Date.now()));
    setRunSince(null);
    setConfirmEnd(false);
    clearSession();
    setPhase('done');
  };

  const completeSet = () => {
    if (!timed && load != null && load > 0) logSet(exercise.id, exercise.name, topReps(exercise.reps), load, date);
    Vibration.vibrate(60);
    hapticPress();
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
      // The whole workout is done: the biggest one.
      hapticHeavy();
      finishWorkout();
      return;
    }
    const nextIndex = exercises.findIndex((ex, i) => i > exIndex && (nextMap[ex.id] ?? 0) < ex.sets);
    if (nextIndex !== -1) setExIndex(nextIndex);
    startRest(exercise.restSec);
  };

  /** Pauses / resumes the whole workout: the clock, the kcal and the rest countdown together. */
  const togglePause = () => {
    hapticTap();
    const t = Date.now();
    if (paused) {
      setRunSince(t);
      if (pausedLeft != null) {
        setRestEndsAt(t + pausedLeft * 1000);
        setPausedLeft(null);
        setNow(t);
      }
    } else {
      setBankMs(elapsedAt(t));
      setRunSince(null);
      if (phase === 'resting' && pausedLeft == null) setPausedLeft(restLeft);
    }
  };

  const skipRest = () => {
    hapticTap();
    setRestEndsAt(null);
    setPausedLeft(null);
    setPhase('ready');
  };

  /** The X: leaves the session in progress (frozen, ready for "Riprendi") instead of ending it. */
  const leave = () => {
    if (phase === 'countdown' || phase === 'done') {
      onClose();
      return;
    }
    const t = Date.now();
    saveSession({
      date,
      title,
      startedAt: initial.startedAt,
      elapsedMs: elapsedAt(t),
      runSince: null,
      savedAt: t,
      exIndex,
      doneMap,
      loads,
      phase,
      restTotal,
      restEndsAt,
      pausedLeft: phase === 'resting' ? (pausedLeft ?? Math.max(0, restEndsAt ? (restEndsAt - t) / 1000 : 0)) : null,
      restAfter,
    });
    onClose();
  };

  const loadStep = load != null && load >= 20 ? 2.5 : 1;
  const changeLoad = (delta: number) => {
    hapticSelection();
    setLoads((l) => ({ ...l, [exercise.id]: Math.max(0, roundLoad((l[exercise.id] ?? 0) + delta)) }));
  };

  if (phase === 'countdown') {
    return (
      <View style={[styles.root, styles.center]}>
        <Pressable onPress={leave} hitSlop={11} accessibilityLabel="Chiudi allenamento" style={[styles.close, { position: 'absolute', top: insets.top + 8, left: 20 }]}>
          <Icon name="close" size={20} color={C.text} />
        </Pressable>
        <Countdown
          onDone={() => {
            setRunSince(Date.now());
            setPhase('ready');
          }}
        />
      </View>
    );
  }

  const isLast = exIndex === exercises.length - 1;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <Pressable onPress={leave} hitSlop={11} accessibilityLabel="Chiudi allenamento" style={styles.close}>
          <Icon name="close" size={20} color={C.text} />
        </Pressable>
        <ThemedText style={styles.workoutTitle} numberOfLines={1}>
          {title}
        </ThemedText>
        <View style={styles.closeSpacer} />
      </View>

      {view === 'done' ? (
        <DoneView
          exercises={exercises}
          doneMap={doneMap}
          elapsedMs={finalMs}
          kcal={sessionKcalAt(finalMs, ctx.weightKg, bmrPerDay)}
          onClose={onClose}
        />
      ) : (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.statsRow}>
              <LiveStats bankMs={bankMs} runSince={runSince} weightKg={ctx.weightKg} bmrPerDay={bmrPerDay} paused={paused} />
              <View style={styles.controls}>
                {confirmEnd ? (
                  <>
                    <Pressable onPress={finishWorkout} accessibilityRole="button" accessibilityLabel="Termina l'allenamento" style={[styles.controlBtn, { backgroundColor: C.danger }]}>
                      <Icon name="check" size={26} color="#FFFFFF" />
                    </Pressable>
                    <Pressable onPress={() => setConfirmEnd(false)} accessibilityRole="button" accessibilityLabel="Annulla" style={[styles.controlBtn, { backgroundColor: C.cardHigh }]}>
                      <Icon name="close" size={24} color={C.text} />
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      onPress={togglePause}
                      accessibilityRole="button"
                      accessibilityLabel={paused ? 'Riprendi allenamento' : 'Metti in pausa l’allenamento'}
                      style={[styles.controlBtn, { backgroundColor: paused ? C.green : C.cardHigh }]}>
                      <Icon name={paused ? 'play' : 'pause'} size={24} color={paused ? C.onGreen : C.text} />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        hapticTap();
                        setConfirmEnd(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Fine allenamento"
                      style={[styles.controlBtn, { backgroundColor: C.cardHigh }]}>
                      <Icon name="stop" size={22} color={C.danger} />
                    </Pressable>
                  </>
                )}
              </View>
            </View>
            <ThemedText style={[styles.controlHint, confirmEnd && { color: C.danger }]}>
              {confirmEnd ? 'Terminare l’allenamento? Le serie fatte restano salvate.' : paused ? 'In pausa · tocca play per riprendere' : ' '}
            </ThemedText>

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
              <Pressable onPress={togglePause} accessibilityLabel={paused ? 'Riprendi allenamento' : 'Metti in pausa l’allenamento'}>
                <CountdownRing fraction={restTotal > 0 ? restLeft / restTotal : 0}>
                  {restAfter ? (
                    <View style={styles.doneBadge}>
                      <Icon name="check" size={13} color={C.green} />
                      <ThemedText style={styles.doneBadgeText}>Serie {restAfter.set} fatta</ThemedText>
                    </View>
                  ) : null}
                  <ThemedText style={styles.ringTime}>{clock(restLeft)}</ThemedText>
                  <ThemedText style={styles.ringHint}>{paused ? 'in pausa · tocca per riprendere' : 'recupero · tocca per la pausa'}</ThemedText>
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
          </ScrollView>

          <View style={styles.footer}>
            {view === 'resting' ? (
              <PrimaryAction icon="play" label="Salta recupero" onPress={skipRest} disabled={paused} />
            ) : exerciseDone ? (
              <PrimaryAction icon="chevronRight" label={isLast ? 'Termina' : 'Esercizio successivo'} onPress={() => (isLast ? finishWorkout() : go(exIndex + 1))} disabled={paused} />
            ) : (
              <PrimaryAction icon="check" label={`Serie ${setsDone + 1} fatta`} onPress={completeSet} disabled={paused} />
            )}
          </View>
        </>
      )}
    </View>
  );
}

/**
 * The watch-style readout: the workout clock in yellow ("00:03,58") with the
 * active and total kcal under it, in big numerals with small caps labels. It
 * owns its own fast tick so only this block re-renders every 50 ms.
 */
function LiveStats({ bankMs, runSince, weightKg, bmrPerDay, paused }: { bankMs: number; runSince: number | null; weightKg: number; bmrPerDay: number; paused: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (runSince == null) return;
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, [runSince]);
  const ms = bankMs + (runSince != null ? Math.max(0, now - runSince) : 0);
  const kcal = sessionKcalAt(ms, weightKg, bmrPerDay);
  return (
    <View style={styles.stats} accessible accessibilityLabel={`${watchClock(ms)}, ${kcal.active} kcal attive, ${kcal.total} kcal totali`}>
      <ThemedText style={[styles.watchTime, paused && { opacity: 0.45 }]}>{watchClock(ms)}</ThemedText>
      <KcalLine value={kcal.active} top="KCAL" bottom="ATTIVE" />
      <KcalLine value={kcal.total} top="TOTALE" bottom="KCAL" />
    </View>
  );
}

function KcalLine({ value, top, bottom }: { value: number; top: string; bottom: string }) {
  return (
    <View style={styles.kcalLine}>
      <ThemedText style={styles.kcalValue}>{value}</ThemedText>
      <View>
        <ThemedText style={styles.kcalLabel}>{top}</ThemedText>
        <ThemedText style={styles.kcalLabel}>{bottom}</ThemedText>
      </View>
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
    if (done > prevDone.current) pop.value = withSequence(withTiming(1.06, TimingTap), withSpring(1, SpringCountPop));
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
    progress.value = withTiming(1, TimingCountdown);
    pop.value = 0.6;
    pop.value = withSpring(1, SpringCountPop);
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
  elapsedMs,
  kcal,
  onClose,
}: {
  exercises: TrainingExerciseEntry[];
  doneMap: Record<string, number>;
  elapsedMs: number;
  kcal: { active: number; total: number };
  onClose: () => void;
}) {
  const sets = exercises.reduce((sum, ex) => sum + Math.min(doneMap[ex.id] ?? 0, ex.sets), 0);
  const total = exercises.reduce((sum, ex) => sum + ex.sets, 0);
  const complete = sets >= total;
  return (
    <View style={styles.doneContent}>
      <SetsRing total={1} done={1}>
        <Icon name="trophy" size={56} color={C.green} />
      </SetsRing>
      <ThemedText style={styles.doneTitle}>{complete ? 'Allenamento completato' : 'Allenamento terminato'}</ThemedText>
      <View style={styles.infoRow}>
        <Info label="Durata" value={elapsedMs > 0 ? watchClock(elapsedMs).replace(/,\d+$/, '') : '—'} />
        <Info label="Kcal attive" value={elapsedMs > 0 ? String(kcal.active) : '—'} />
        <Info label="Serie" value={`${sets}/${total}`} />
      </View>
      <PrimaryAction icon="check" label="Chiudi" onPress={onClose} />
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

function PrimaryAction({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={({ pressed }) => [styles.primary, { opacity: disabled ? 0.35 : pressed ? 0.85 : 1 }]}>
      <Icon name={icon} size={20} color={C.onGreen} />
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
  scroll: {
    flex: 1,
  },
  // The session's scrolling body: stats and controls, then the exercise.
  content: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  doneContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    gap: 14,
  },
  footer: {
    paddingTop: 8,
  },
  statsRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stats: {
    gap: 2,
  },
  // The watch's workout screen: a big yellow clock, then big numerals with small caps labels.
  watchTime: {
    color: C.clock,
    fontSize: 54,
    lineHeight: 62,
    fontWeight: '700',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  kcalLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kcalValue: {
    color: C.text,
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '500',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  kcalLabel: {
    color: C.text,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
  },
  controls: {
    gap: 14,
  },
  controlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlHint: {
    alignSelf: 'stretch',
    color: C.muted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
    minHeight: 17,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.cardHigh,
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
    fontSize: 13,
    lineHeight: 17,
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
    fontSize: 12,
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
    color: C.onGreen,
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
