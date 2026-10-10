import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Vibration, View } from 'react-native';
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

// The session player is always dark, like a workout app on the gym floor:
// black canvas, graphite cards, one neon green for "go" and the brand orange
// for the session progress.
const C = {
  bg: '#000000',
  card: '#1C1C1E',
  cardHigh: '#2C2C2E',
  text: '#FFFFFF',
  muted: '#8E8E93',
  faint: '#48484A',
  green: '#3DF56B',
  greenDim: 'rgba(61,245,107,0.18)',
  orange: '#FF7A00',
  blue: '#0A84FF',
};

type Phase = 'ready' | 'working' | 'resting' | 'done';

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

/** Reps and load to show when an exercise comes up: the top of the rep range
 * and the progression engine's next load (null = bodyweight). */
function prefillFor(ex: TrainingExerciseEntry, history: Parameters<typeof suggestedNextLoadForExercise>[0]): { reps: number; weight: number | null } {
  const load = suggestedNextLoadForExercise(history, ex.id, ex.reps, ex.suggestedKg).suggestedKg;
  return { reps: repRange(ex.reps)[1], weight: ex.suggestedKg == null && !load ? null : load || ex.suggestedKg };
}

const isTimed = (ex: TrainingExerciseEntry) => /\bs\b/.test(ex.reps);

function clock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Full-screen guided session ("Inizia allenamento"): one exercise at a
 * time with its sets, target reps, load to use and a rest countdown between
 * sets. Every completed set is logged, and an exercise is ticked once all
 * its sets are done — so leaving halfway resumes where the user stopped. */
export function WorkoutSessionModal({ visible, onClose, title, exercises, date }: WorkoutSessionModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      {/* Mounted only while open, so every opening starts from a fresh session state. */}
      {visible && exercises.length > 0 ? <SessionView onClose={onClose} title={title} exercises={exercises} date={date} /> : null}
    </Modal>
  );
}

type Stats = { sets: number; volume: number; startedAt: number; endedAt: number | null };

function SessionView({ onClose, title, exercises, date }: Omit<WorkoutSessionModalProps, 'visible'>) {
  const insets = useSafeAreaInsets();
  const progressSets = useTrainingProgressStore((s) => s.sets);
  const completed = useTrainingProgressStore((s) => s.completed);
  const logSet = useTrainingProgressStore((s) => s.logSet);
  const toggleCompleted = useTrainingProgressStore((s) => s.toggleCompleted);

  // Opening resumes at the first exercise not yet ticked today, after the sets already logged.
  const [initial] = useState(() => {
    const start = Math.max(0, exercises.findIndex((ex) => !isExerciseCompleted(completed, ex.id, date)));
    const ex = exercises[start];
    const logged = setsForExerciseOnDate(progressSets, ex.id, date).length;
    const allDone = exercises.every((e) => isExerciseCompleted(completed, e.id, date));
    return {
      exIndex: start,
      setsDone: logged < ex.sets ? logged : 0,
      phase: (allDone ? 'done' : 'ready') as Phase,
      ...prefillFor(ex, progressSets),
      startedAt: Date.now(),
    };
  });
  const [exIndex, setExIndex] = useState(initial.exIndex);
  const [setsDone, setSetsDone] = useState(initial.setsDone);
  const [phase, setPhase] = useState<Phase>(initial.phase);
  const [reps, setReps] = useState(initial.reps);
  const [weight, setWeight] = useState<number | null>(initial.weight);
  const [now, setNow] = useState(initial.startedAt);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(60);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [workStartedAt, setWorkStartedAt] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats>({ sets: 0, volume: 0, startedAt: initial.startedAt, endedAt: null });
  const buzzed = useRef(false);
  const restBuzzed = useRef(false);

  const exercise = exercises[exIndex];
  const next = exercises[exIndex + 1];
  const media = getExerciseMedia(exercise.id);
  const timed = isTimed(exercise);

  const prefill = (ex: TrainingExerciseEntry) => {
    const values = prefillFor(ex, progressSets);
    setReps(values.reps);
    setWeight(values.weight);
  };

  useEffect(() => {
    if (phase !== 'resting' && phase !== 'working') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase]);

  const restLeft = pausedLeft ?? (restEndsAt ? Math.max(0, (restEndsAt - now) / 1000) : 0);
  const workElapsed = workStartedAt ? (now - workStartedAt) / 1000 : 0;
  const timedTarget = timed ? repRange(exercise.reps)[1] : 0;

  // Once the rest runs out the screen falls back to "ready" for the next set.
  const restOver = phase === 'resting' && pausedLeft == null && restEndsAt != null && now >= restEndsAt;
  const view: Phase = restOver ? 'ready' : phase;
  const holdOver = phase === 'working' && timed && workElapsed >= timedTarget;

  // One buzz when the rest ends or a timed hold reaches its target.
  useEffect(() => {
    if (restOver && !restBuzzed.current) {
      restBuzzed.current = true;
      Vibration.vibrate(400);
    }
    if (holdOver && !buzzed.current) {
      buzzed.current = true;
      Vibration.vibrate(400);
    }
  }, [restOver, holdOver]);

  const finish = () => {
    setStats((s) => ({ ...s, endedAt: Date.now() }));
    setPhase('done');
  };

  const startRest = (seconds: number) => {
    restBuzzed.current = false;
    setRestTotal(seconds);
    setRestEndsAt(Date.now() + seconds * 1000);
    setPausedLeft(null);
    setNow(Date.now());
    setPhase('resting');
  };

  const startSet = () => {
    buzzed.current = false;
    setRestEndsAt(null);
    setPausedLeft(null);
    setWorkStartedAt(Date.now());
    setNow(Date.now());
    setPhase('working');
  };

  const goToExercise = (index: number, rest: number | null) => {
    const ex = exercises[index];
    setExIndex(index);
    setSetsDone(0);
    prefill(ex);
    if (rest) startRest(rest);
    else setPhase('ready');
  };

  const completeSet = () => {
    const performedReps = timed ? Math.round(workElapsed) : reps;
    if (!timed && weight != null && weight > 0) logSet(exercise.id, exercise.name, performedReps, weight, date);
    setStats((s) => ({ ...s, sets: s.sets + 1, volume: s.volume + (!timed && weight ? weight * performedReps : 0) }));
    setWorkStartedAt(null);
    const doneNow = setsDone + 1;
    setSetsDone(doneNow);
    if (doneNow < exercise.sets) {
      startRest(exercise.restSec);
      return;
    }
    if (!isExerciseCompleted(completed, exercise.id, date)) toggleCompleted(exercise.id, date);
    const nextIndex = exercises.findIndex((ex, i) => i > exIndex && !isExerciseCompleted(completed, ex.id, date));
    if (nextIndex === -1) finish();
    else goToExercise(nextIndex, exercise.restSec);
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

  const addRest = (seconds: number) => {
    if (pausedLeft != null) setPausedLeft(pausedLeft + seconds);
    else if (restEndsAt) setRestEndsAt(restEndsAt + seconds * 1000);
    setRestTotal((t) => t + seconds);
  };

  const weightStep = weight != null && weight >= 20 ? 2.5 : 1;
  const tag = media?.target.split(',')[0].trim().toUpperCase();
  const totalSetsAll = exercises.reduce((sum, ex) => sum + ex.sets, 0);
  const setsBefore = exercises.slice(0, exIndex).reduce((sum, ex) => sum + ex.sets, 0);
  const sessionFraction = view === 'done' ? 1 : (setsBefore + setsDone) / Math.max(totalSetsAll, 1);

  return (
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.header}>
          <RoundButton icon="close" onPress={onClose} label="Chiudi allenamento" />
          <View style={styles.headerText}>
            <ThemedText style={styles.headerTitle} numberOfLines={1}>
              {title}
            </ThemedText>
            <ThemedText style={styles.headerSub}>
              {view === 'done' ? 'Completato' : `Esercizio ${exIndex + 1} di ${exercises.length}`}
            </ThemedText>
          </View>
          <View style={styles.roundButton} />
        </View>

        <View style={styles.segments}>
          {exercises.map((ex, i) => {
            const done = isExerciseCompleted(completed, ex.id, date) || view === 'done';
            const current = i === exIndex && view !== 'done';
            return (
              <View key={ex.id} style={[styles.segment, { backgroundColor: C.faint }]}>
                <View
                  style={[
                    styles.segmentFill,
                    { backgroundColor: done ? C.green : C.orange, width: done ? '100%' : current ? `${(setsDone / ex.sets) * 100}%` : '0%' },
                  ]}
                />
              </View>
            );
          })}
        </View>

        {view === 'done' ? (
          <DoneView stats={stats} totalSets={totalSetsAll} onClose={onClose} />
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <View style={{ flex: 1, gap: 6 }}>
                {tag ? (
                  <View style={[styles.tag, { backgroundColor: C.blue }]}>
                    <ThemedText style={styles.tagText}>{tag}</ThemedText>
                  </View>
                ) : null}
                <ThemedText style={styles.exerciseName}>{exercise.name}</ThemedText>
                <ThemedText style={styles.exerciseMeta}>
                  Tempo {exercise.tempo} · recupero {exercise.restSec < 60 ? `${exercise.restSec}s` : clock(exercise.restSec)}
                </ThemedText>
              </View>
              {media ? (
                <View style={styles.mediaBox}>
                  <Image source={{ uri: media.gifUrl }} style={styles.media} resizeMode="contain" />
                </View>
              ) : null}
            </View>

            <View style={[styles.statsCard, { backgroundColor: C.card }]}>
              <StatTile label="Serie" value={`${Math.min(setsDone + 1, exercise.sets)}`} suffix={`/${exercise.sets}`} />
              <View style={styles.statDivider} />
              {timed ? (
                <StatTile label="Durata" value={exercise.reps.replace(/\s*s$/, '')} suffix="s" />
              ) : (
                <StatTile
                  label="Ripetizioni"
                  value={String(reps)}
                  hint={`obiettivo ${exercise.reps}`}
                  onMinus={() => setReps((r) => Math.max(1, r - 1))}
                  onPlus={() => setReps((r) => r + 1)}
                />
              )}
              <View style={styles.statDivider} />
              {weight == null ? (
                <StatTile label="Peso" value="Corpo" suffix="libero" small />
              ) : (
                <StatTile
                  label="Peso"
                  value={String(weight)}
                  suffix="kg"
                  onMinus={() => setWeight((w) => Math.max(0, roundLoad((w ?? 0) - weightStep)))}
                  onPlus={() => setWeight((w) => roundLoad((w ?? 0) + weightStep))}
                />
              )}
            </View>

            <View style={styles.ringWrap}>
              {view === 'resting' ? (
                <Ring fraction={restTotal > 0 ? restLeft / restTotal : 0} color={C.green}>
                  <ThemedText style={styles.ringLabel}>{pausedLeft != null ? 'In pausa' : 'Recupero'}</ThemedText>
                  <ThemedText style={styles.ringTime}>{clock(restLeft)}</ThemedText>
                  <ThemedText style={styles.ringSub}>prossima serie</ThemedText>
                </Ring>
              ) : view === 'working' ? (
                <Ring fraction={timed ? Math.min(workElapsed / Math.max(timedTarget, 1), 1) : 1} color={C.orange}>
                  <ThemedText style={styles.ringLabel}>{timed ? 'Tieni la posizione' : 'Serie in corso'}</ThemedText>
                  <ThemedText style={styles.ringTime}>{clock(timed ? Math.max(timedTarget - workElapsed, 0) : workElapsed)}</ThemedText>
                  <ThemedText style={styles.ringSub}>{timed ? `obiettivo ${exercise.reps}` : `${reps} ripetizioni${weight ? ` · ${weight} kg` : ''}`}</ThemedText>
                </Ring>
              ) : (
                <Ring fraction={sessionFraction} color={C.orange} track={C.cardHigh}>
                  <ThemedText style={styles.ringLabel}>Pronto</ThemedText>
                  <ThemedText style={styles.ringTime}>
                    {Math.min(setsDone + 1, exercise.sets)}
                    <ThemedText style={styles.ringTimeSmall}>/{exercise.sets}</ThemedText>
                  </ThemedText>
                  <ThemedText style={styles.ringSub}>
                    {exercise.sets - setsDone === 1 ? 'ultima serie' : `ne mancano ${exercise.sets - setsDone}`}
                  </ThemedText>
                </Ring>
              )}
              {view === 'resting' ? (
                <Pressable onPress={() => addRest(15)} style={[styles.chip, { backgroundColor: C.card }]} accessibilityLabel="Aggiungi 15 secondi">
                  <ThemedText style={styles.chipText}>+15 s</ThemedText>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.actions}>
              {view === 'resting' ? (
                <>
                  <ActionButton icon={pausedLeft != null ? 'play' : 'pause'} label={pausedLeft != null ? 'Riprendi' : 'Pausa'} onPress={togglePause} />
                  <ActionButton icon="play" label="Inizia serie" primary onPress={startSet} />
                </>
              ) : view === 'working' ? (
                <>
                  <ActionButton icon="close" label="Annulla" onPress={() => setPhase('ready')} />
                  <ActionButton icon="check" label="Serie fatta" primary onPress={completeSet} />
                </>
              ) : (
                <>
                  <ActionButton
                    icon="chevronRight"
                    label={next ? 'Salta' : 'Termina'}
                    onPress={() => (next ? goToExercise(exIndex + 1, null) : finish())}
                  />
                  <ActionButton icon="play" label="Inizia serie" primary onPress={startSet} />
                </>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: C.card }]}>
              <View style={styles.cardHead}>
                <ThemedText style={styles.cardTitle}>Progresso serie</ThemedText>
                <ThemedText style={styles.cardCount}>
                  {setsDone}/{exercise.sets} completate
                </ThemedText>
              </View>
              <View style={styles.pills}>
                {Array.from({ length: exercise.sets }, (_, i) => {
                  const done = i < setsDone;
                  const current = i === setsDone;
                  return (
                    <View
                      key={i}
                      style={[
                        styles.pill,
                        done
                          ? { backgroundColor: C.green, borderColor: C.green }
                          : { borderColor: current ? C.green : C.faint, backgroundColor: current ? C.greenDim : 'transparent' },
                      ]}>
                      {done ? <Icon name="check" size={13} color="#000" /> : null}
                      <ThemedText style={[styles.pillText, { color: done ? '#000' : current ? C.green : C.muted }]}>{i + 1}</ThemedText>
                    </View>
                  );
                })}
              </View>
            </View>

            {next ? (
              <Pressable
                onPress={() => goToExercise(exIndex + 1, null)}
                style={[styles.card, styles.nextCard, { backgroundColor: C.card }]}
                accessibilityLabel={`Passa a ${next.name}`}>
                <View style={styles.nextThumb}>
                  {getExerciseMedia(next.id) ? <Image source={{ uri: getExerciseMedia(next.id)!.gifUrl }} style={styles.nextImg} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardCount}>Esercizio successivo</ThemedText>
                  <ThemedText style={styles.nextName} numberOfLines={1}>
                    {next.name}
                  </ThemedText>
                  <ThemedText style={styles.cardCount}>
                    {next.sets} × {next.reps}
                    {next.suggestedKg ? ` · ${next.suggestedKg} kg` : ''}
                  </ThemedText>
                </View>
                <Icon name="chevronRight" size={18} color={C.muted} />
              </Pressable>
            ) : null}
          </ScrollView>
        )}
      </View>
  );
}

function DoneView({ stats, totalSets, onClose }: { stats: Stats; totalSets: number; onClose: () => void }) {
  const minutes = stats.endedAt != null && stats.sets > 0 ? String(Math.max(1, Math.round((stats.endedAt - stats.startedAt) / 60000))) : '—';
  return (
    <View style={styles.done}>
      <Ring fraction={1} color={C.green}>
        <Icon name="trophy" size={54} color={C.green} />
      </Ring>
      <ThemedText style={styles.doneTitle}>Allenamento completato</ThemedText>
      <ThemedText style={styles.doneSub}>Ottimo lavoro: ogni serie registrata alimenta i tuoi progressi.</ThemedText>
      <View style={[styles.statsCard, { backgroundColor: C.card, alignSelf: 'stretch' }]}>
        <StatTile label="Durata" value={minutes} suffix="min" />
        <View style={styles.statDivider} />
        <StatTile label="Serie" value={String(stats.sets)} suffix={`/${totalSets}`} />
        <View style={styles.statDivider} />
        <StatTile label="Volume" value={String(Math.round(stats.volume))} suffix="kg" />
      </View>
      <View style={{ alignSelf: 'stretch' }}>
        <ActionButton icon="check" label="Fine" primary onPress={onClose} />
      </View>
    </View>
  );
}

function Ring({ fraction, color, track = C.card, children }: { fraction: number; color: string; track?: string; children: React.ReactNode }) {
  const size = 230;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const f = Math.min(Math.max(fraction, 0), 1);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
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

function StatTile({
  label,
  value,
  suffix,
  hint,
  small,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  small?: boolean;
  onMinus?: () => void;
  onPlus?: () => void;
}) {
  return (
    <View style={styles.statTile}>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
      <ThemedText style={[styles.statValue, small && { fontSize: 20, lineHeight: 26 }]} numberOfLines={1}>
        {value}
        {suffix ? <ThemedText style={styles.statSuffix}> {suffix}</ThemedText> : null}
      </ThemedText>
      {hint ? <ThemedText style={styles.statHint}>{hint}</ThemedText> : null}
      {onMinus && onPlus ? (
        <View style={styles.stepper}>
          <Pressable onPress={onMinus} hitSlop={6} style={styles.stepBtn} accessibilityLabel={`Diminuisci ${label}`}>
            <Icon name="trendFlat" size={14} color={C.text} />
          </Pressable>
          <Pressable onPress={onPlus} hitSlop={6} style={styles.stepBtn} accessibilityLabel={`Aumenta ${label}`}>
            <Icon name="plus" size={14} color={C.text} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ActionButton({ icon, label, primary, onPress }: { icon: IconName; label: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: primary ? C.green : C.card, opacity: pressed ? 0.85 : 1 }]}
      accessibilityRole="button">
      <Icon name={icon} size={20} color={primary ? '#000' : C.text} />
      <ThemedText style={[styles.actionText, { color: primary ? '#000' : C.text }]}>{label}</ThemedText>
    </Pressable>
  );
}

function RoundButton({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={label} style={[styles.roundButton, { backgroundColor: C.card }]}>
      <Icon name={icon} size={20} color={C.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: C.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  headerSub: {
    color: C.muted,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segments: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
  },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
    borderRadius: 3,
  },
  body: {
    paddingTop: 18,
    paddingBottom: 12,
    gap: 16,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  exerciseName: {
    color: C.text,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  exerciseMeta: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  mediaBox: {
    width: 104,
    height: 104,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  statsCard: {
    flexDirection: 'row',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: C.faint,
    marginVertical: 4,
  },
  statTile: {
    flex: 1,
    paddingHorizontal: 10,
    gap: 2,
  },
  statLabel: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
  },
  statValue: {
    color: C.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statSuffix: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  statHint: {
    color: C.muted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  stepper: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  stepBtn: {
    width: 30,
    height: 26,
    borderRadius: 8,
    backgroundColor: C.cardHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  ringLabel: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  ringTime: {
    color: C.text,
    fontSize: 54,
    lineHeight: 62,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  ringTimeSmall: {
    color: C.muted,
    fontSize: 28,
    fontWeight: '700',
  },
  ringSub: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
  },
  chipText: {
    color: C.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  action: {
    flex: 1,
    height: 58,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  card: {
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: C.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  cardCount: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pillText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  nextImg: {
    width: '100%',
    height: '100%',
  },
  nextName: {
    color: C.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  done: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  doneTitle: {
    color: C.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  doneSub: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
});
