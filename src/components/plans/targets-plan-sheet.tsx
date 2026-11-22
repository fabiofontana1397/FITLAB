import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { AppTextInput } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserContext } from '@/hooks/use-user-context';
import { hapticSelection, hapticSuccess, hapticTap } from '@/lib/haptics';
import { WEEKDAY_LABELS } from '@/lib/planning/exercise-library';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import {
  DEFAULT_TRAINING_DAYS,
  dayTargets,
  gramsFromPercents,
  isTargetsPlan,
  KCAL_PER_G,
  monthDayTargets,
  planMonthName,
  TARGET_LIMITS,
  validateDayTargets,
  type DayKind,
  type MonthDayTargets,
  type MonthTargets,
  type TargetIssue,
} from '@/lib/planning/targets-plan';
import { usePlanStore } from '@/store/plan-store';
import { useUserStore } from '@/store/user-store';

/** Exit durations of the confirmation popup and of the sheet (TimingExit, 240 ms), with a little slack. */
const POPUP_EXIT_MS = 200;
const SHEET_EXIT_MS = 280;
const DAY_MS = 86_400_000;
const DEFAULT_SPLIT = { protein: 30, carbs: 45, fats: 25 };
/** Same inset as the rows and headers of ListGroup, so every label and every field lines up on both sides. */
const INSET = Spacing.four;
const COL = 84;
const COL_GAP = Spacing.two;
const WEEKDAY_NAMES = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

/**
 * What the person is typing for one kind of day: calories, then protein and fats each in grams and in percent (the
 * two stay in step: whichever is typed updates the other). Carbs are never typed: they fill the calories left.
 */
type DayDraft = { kcal: string; pG: string; pP: string; fG: string; fP: string };
type MonthDraft = Record<DayKind, DayDraft>;
type Field = 'kcal' | 'pG' | 'pP' | 'fG' | 'fP';

const num = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const digits = (s: string) => s.replace(/[^0-9]/g, '').slice(0, 5);
const pctOf = (grams: number, perG: number, kcal: number) => (kcal > 0 ? String(Math.round(((grams * perG) / kcal) * 100)) : '0');
const gramsOf = (pct: number, perG: number, kcal: number) => String(Math.round((kcal * pct) / 100 / perG));

function toDayDraft(t: MonthTargets): DayDraft {
  const kcal = Math.round(t.calories);
  return { kcal: String(kcal), pG: String(Math.round(t.protein)), pP: pctOf(t.protein, KCAL_PER_G.protein, kcal), fG: String(Math.round(t.fats)), fP: pctOf(t.fats, KCAL_PER_G.fats, kcal) };
}

const toDayTargets = (d: DayDraft): MonthTargets => dayTargets(num(d.kcal), num(d.pG), num(d.fG));

/** Applies one typed value and keeps grams and percent of the same macro in step. */
function applyField(d: DayDraft, field: Field, raw: string): DayDraft {
  const v = digits(raw);
  const next = { ...d, [field]: v };
  const kcal = num(next.kcal);
  if (field === 'kcal') {
    // The grams are what the person decided: a new calorie total moves the percentages (and the carbs).
    next.pP = pctOf(num(next.pG), KCAL_PER_G.protein, kcal);
    next.fP = pctOf(num(next.fG), KCAL_PER_G.fats, kcal);
  } else if (field === 'pG') next.pP = pctOf(num(v), KCAL_PER_G.protein, kcal);
  else if (field === 'pP') next.pG = gramsOf(num(v), KCAL_PER_G.protein, kcal);
  else if (field === 'fG') next.fP = pctOf(num(v), KCAL_PER_G.fats, kcal);
  else if (field === 'fP') next.fG = gramsOf(num(v), KCAL_PER_G.fats, kcal);
  return next;
}

const shortDate = (d: Date) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

/**
 * "Crea il tuo piano" (nutrition): how many months, which weekdays are training days, and for each month the
 * calories, protein and fats of a training day and of a rest day — carbs fill the calories left. Once approved there
 * is no menu: the targets replace the nutrition plan and every screen of the app follows them, day by day.
 * Opened again on a plan of this kind, it edits it: start date kept, months already lived locked.
 */
export function TargetsPlanSheet() {
  const theme = useTheme();
  const ctx = useUserContext();
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const setOwnTargets = usePlanStore((s) => s.setOwnTargets);
  const profileKcal = useUserStore((s) => s.dailyCalorieTarget);
  const profileMacros = useUserStore((s) => s.macroTargetsG);

  const editing = isTargetsPlan(dietPlan) ? dietPlan : null;
  // Months before this one are history when editing: shown, not editable.
  const firstEditable = editing ? currentMonthIndex(editing) : 1;
  const startMs = useMemo(() => {
    const d = editing ? new Date(editing.generatedAt) : new Date();
    d.setHours(12, 0, 0, 0);
    return d.getTime();
  }, [editing]);

  // Starting point: the plan being edited, else the targets the person follows today (app plan or profile), else a default.
  const [initial] = useState(() => {
    if (editing) {
      return {
        trainingDays: editing.ownTargets?.trainingDays ?? [],
        drafts: editing.months.map((m): MonthDraft => {
          const pair = monthDayTargets(m);
          return { training: toDayDraft(pair.training), rest: toDayDraft(pair.rest) };
        }),
      };
    }
    // Training days: the ones of the training card, if there is one.
    const trainingMonth = trainingPlan?.months.find((m) => m.monthIndex === currentMonthIndex(trainingPlan));
    const fromCard = trainingMonth?.weeklySplit.flatMap((d, i) => (d.type !== 'rest' ? [i] : [])) ?? [];
    const month = dietPlan?.months.find((m) => m.monthIndex === currentMonthIndex(dietPlan));
    // The app's own plan already has a training-day and a rest-day target: start from those.
    const pair: MonthDayTargets = month
      ? monthDayTargets(month)
      : (() => {
          const base =
            profileKcal > 0 && profileMacros.protein > 0 ? { calories: profileKcal, ...profileMacros } : { calories: 2000, ...gramsFromPercents(2000, DEFAULT_SPLIT) };
          return { training: base, rest: base };
        })();
    const draft: MonthDraft = { training: toDayDraft(pair.training), rest: toDayDraft(pair.rest) };
    return { trainingDays: fromCard.length > 0 ? fromCard : DEFAULT_TRAINING_DAYS, drafts: Array.from({ length: 3 }, () => ({ training: { ...draft.training }, rest: { ...draft.rest } })) };
  });
  const [trainingDays, setTrainingDays] = useState<number[]>(initial.trainingDays);
  const [drafts, setDrafts] = useState<MonthDraft[]>(initial.drafts);
  const [selected, setSelected] = useState(Math.min(firstEditable, initial.drafts.length) - 1);
  const [kindChoice, setKindChoice] = useState<DayKind>('training');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [triedApprove, setTriedApprove] = useState(false);

  // With no training day (or no rest day) there is one kind of day only: the other is never used.
  const split = trainingDays.length > 0 && trainingDays.length < 7;
  const usedKinds: DayKind[] = split ? ['training', 'rest'] : trainingDays.length === 7 ? ['training'] : ['rest'];
  const kind: DayKind = split ? kindChoice : usedKinds[0];

  const count = drafts.length;
  const minMonths = Math.max(TARGET_LIMITS.minMonths, firstEditable);
  const sel = Math.min(selected, count - 1);
  const draft = drafts[sel][kind];
  const locked = sel + 1 < firstEditable;
  const weightKg = ctx.weightKg > 0 ? ctx.weightKg : undefined;

  const monthStart = (i: number) => new Date(startMs + i * 30 * DAY_MS);
  const monthRange = (i: number) => `${shortDate(monthStart(i))} – ${shortDate(new Date(monthStart(i + 1).getTime() - DAY_MS))}`;
  const monthName = (i: number, style: 'long' | 'short' = 'long') => planMonthName(startMs, i + 1, style);
  const kindLabel = (k: DayKind) => (k === 'training' ? 'allenamento' : 'riposo');

  const issuesOfMonth = (m: MonthDraft): { kind: DayKind; issue: TargetIssue }[] =>
    usedKinds.flatMap((k) => validateDayTargets(toDayTargets(m[k]), weightKg).map((issue) => ({ kind: k, issue })));
  const allIssues = drafts.map((m, i) => (i + 1 < firstEditable ? [] : issuesOfMonth(m)));
  const blockedMonths = allIssues.map((list, i) => (list.some((x) => x.issue.level === 'blocker') ? i + 1 : 0)).filter(Boolean);
  const issues = allIssues[sel].filter((x) => x.kind === kind).map((x) => x.issue);
  const otherKindBlocked = split && allIssues[sel].some((x) => x.kind !== kind && x.issue.level === 'blocker');

  const update = (field: Field, raw: string) =>
    setDrafts((prev) => prev.map((m, i) => (i === sel ? { ...m, [kind]: applyField(m[kind], field, raw) } : m)));

  const setCount = (next: number) => {
    const n = Math.min(TARGET_LIMITS.maxMonths, Math.max(minMonths, next));
    if (n === count) return;
    hapticSelection();
    // New months start from the last one: the person changes only what moves.
    setDrafts((prev) =>
      n > prev.length
        ? [...prev, ...Array.from({ length: n - prev.length }, () => ({ training: { ...prev[prev.length - 1].training }, rest: { ...prev[prev.length - 1].rest } }))]
        : prev.slice(0, n)
    );
    if (sel >= n) setSelected(n - 1);
  };

  const toggleDay = (d: number) => {
    hapticSelection();
    setTrainingDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  };

  const copyForward = () => {
    hapticTap();
    const src = drafts[sel];
    setDrafts((prev) => prev.map((m, i) => (i > sel ? { training: { ...src.training }, rest: { ...src.rest } } : m)));
  };

  const commit = (close: () => void) => {
    // A kind of day nobody lives (no training day, or training every day) takes the other's values.
    const months = drafts.map((m): MonthDayTargets => {
      const training = toDayTargets(m[usedKinds.includes('training') ? 'training' : 'rest']);
      const rest = toDayTargets(m[usedKinds.includes('rest') ? 'rest' : 'training']);
      return { training, rest };
    });
    hapticSuccess();
    const fromPopup = confirmOpen;
    setConfirmOpen(false);
    setTimeout(close, fromPopup ? POPUP_EXIT_MS : 0);
    setTimeout(() => setOwnTargets(months, trainingDays), (fromPopup ? POPUP_EXIT_MS : 0) + SHEET_EXIT_MS);
  };

  const approve = (close: () => void) => {
    setTriedApprove(true);
    if (blockedMonths.length > 0) {
      const first = blockedMonths[0] - 1;
      setSelected(first);
      const blockedKind = allIssues[first].find((x) => x.issue.level === 'blocker')?.kind;
      if (blockedKind && split) setKindChoice(blockedKind);
      return;
    }
    // Replacing a plan in progress (not just editing this one) asks first.
    if (dietPlan && !editing) setConfirmOpen(true);
    else commit(close);
  };

  const targets = toDayTargets(draft);
  const carbsPct = pctOf(targets.carbs, KCAL_PER_G.carbs, targets.calories);
  const end = new Date(startMs + count * 30 * DAY_MS - DAY_MS);
  const chipRows: number[][] = [];
  for (let i = 0; i < count; i += 6) chipRows.push(Array.from({ length: Math.min(6, count - i) }, (_, k) => i + k));

  return (
    <SheetScreen title={editing ? 'Modifica il tuo piano' : 'Crea il tuo piano'} eyebrow="Calorie e macro mese per mese, senza un menù" fallbackHref="/plans" contentContainerStyle={styles.content}>
      {(close) => (
        <>
          <ListGroup
            header="Durata"
            footer={`${editing ? 'Dal' : 'Da oggi,'} ${monthStart(0).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} al ${end.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}.`}
          >
            <ListRow
              key="months"
              title="Mesi"
              trailing={
                <View style={styles.stepper}>
                  <StepButton icon="minusSign" label="Un mese in meno" disabled={count <= minMonths} onPress={() => setCount(count - 1)} />
                  <ThemedText style={styles.stepValue} accessibilityLiveRegion="polite">
                    {count}
                  </ThemedText>
                  <StepButton icon="plus" label="Un mese in più" disabled={count >= TARGET_LIMITS.maxMonths} onPress={() => setCount(count + 1)} />
                </View>
              }
            />
          </ListGroup>

          <ListGroup
            header="Giorni di allenamento"
            footer={
              split
                ? `${trainingDays.length} di allenamento, ${7 - trainingDays.length} di riposo: per ciascuno imposti calorie e macro diverse.`
                : trainingDays.length === 7
                  ? 'Ti alleni tutti i giorni: un solo valore per ogni giorno.'
                  : 'Nessun giorno di allenamento: un solo valore per ogni giorno.'
            }
          >
            <View key="days" style={styles.weekRow} accessibilityRole="toolbar">
              {WEEKDAY_LABELS.map((label, d) => {
                const on = trainingDays.includes(d);
                return (
                  <Pressable
                    key={label}
                    onPress={() => toggleDay(d)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${WEEKDAY_NAMES[d]}, ${on ? 'allenamento' : 'riposo'}`}
                    style={({ pressed }) => [styles.dayChip, { backgroundColor: on ? theme.accent : theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <ThemedText style={[styles.dayText, { color: on ? '#FFFFFF' : theme.textSecondary }]}>{label.charAt(0)}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ListGroup>

          <View style={styles.group}>
            <ThemedText type="label" themeColor="textSecondary" style={styles.inset} accessibilityRole="header">
              Mese
            </ThemedText>
            <View style={styles.monthGrid} accessibilityRole="tablist">
              {chipRows.map((row, r) => (
                <View key={r} style={styles.monthRow}>
                  {row.map((i) => {
                    const on = i === sel;
                    const blocked = triedApprove && blockedMonths.includes(i + 1);
                    return (
                      <Pressable
                        key={i}
                        onPress={() => {
                          hapticSelection();
                          setSelected(i);
                        }}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${monthName(i)}, ${drafts[i][kind].kcal} kcal`}
                        style={[styles.monthChip, { backgroundColor: on ? theme.text : theme.backgroundElement, borderColor: blocked ? theme.danger : 'transparent' }]}
                      >
                        <ThemedText numberOfLines={1} style={[styles.chipMonth, { color: on ? theme.background : theme.textSecondary }]}>
                          {monthName(i, 'short')}
                        </ThemedText>
                        <ThemedText numberOfLines={1} style={[styles.chipKcal, { color: on ? theme.background : theme.text }]}>
                          {num(drafts[i][kind].kcal).toLocaleString('it-IT')}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                  {/* empty cells keep the last row on the same grid as the full ones */}
                  {row.length < Math.min(6, count) ? Array.from({ length: Math.min(6, count) - row.length }, (_, k) => <View key={`pad${k}`} style={styles.monthPad} />) : null}
                </View>
              ))}
            </View>
            {split ? (
              <SegmentedControl
                options={[
                  { value: 'training', label: 'Allenamento' },
                  { value: 'rest', label: 'Riposo' },
                ]}
                value={kindChoice}
                onChange={(k) => {
                  hapticSelection();
                  setKindChoice(k);
                }}
              />
            ) : null}
          </View>

          <View style={styles.group}>
            <ListGroup
              header={`${monthName(sel)} · ${monthRange(sel)}`}
              footer={locked ? 'Mese già concluso: resta com’è.' : 'Imposta grammi o percentuale: l’altro valore si aggiorna. I carboidrati coprono le calorie che restano.'}
            >
              <View key="head" style={styles.colHead}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.rowTitle}>
                  Al giorno
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.colLabel}>
                  Grammi
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.colLabel}>
                  %
                </ThemedText>
              </View>
              <View key="kcal" style={styles.numberRow}>
                <ThemedText type="default" style={styles.rowTitle}>
                  Calorie
                </ThemedText>
                <NumberField value={draft.kcal} unit="kcal" editable={!locked} wide label="Calorie al giorno in kcal" onChange={(v) => update('kcal', v)} />
              </View>
              <MacroRow key="p" label="Proteine" color={theme.accent} grams={draft.pG} pct={draft.pP} editable={!locked} onGrams={(v) => update('pG', v)} onPct={(v) => update('pP', v)} />
              <MacroRow key="c" label="Carboidrati" color={theme.brandGreen} grams={String(targets.carbs)} pct={carbsPct} editable={false} auto />
              <MacroRow key="f" label="Grassi" color={theme.brandYellow} grams={draft.fG} pct={draft.fP} editable={!locked} onGrams={(v) => update('fG', v)} onPct={(v) => update('fP', v)} />
            </ListGroup>

            {!locked && issues.length > 0 ? (
              <View style={styles.issues} accessibilityLiveRegion="polite">
                {issues.map((x) => (
                  <ThemedText key={x.text} type="caption" style={{ color: x.level === 'blocker' ? theme.danger : theme.warning }}>
                    {x.text}
                  </ThemedText>
                ))}
              </View>
            ) : null}
            {!locked && otherKindBlocked ? (
              <ThemedText type="caption" style={[styles.inset, { color: theme.danger }]}>
                {`Da sistemare anche il giorno di ${kindLabel(kind === 'training' ? 'rest' : 'training')}.`}
              </ThemedText>
            ) : null}

            {!locked && sel < count - 1 ? (
              <View style={styles.actions}>
                <TextAction label="Copia nei mesi successivi" onPress={copyForward} />
              </View>
            ) : null}
          </View>

          <ListGroup header="Riepilogo">
            {drafts.map((m, i) => (
              <ListRow
                key={i}
                title={monthName(i)}
                subtitle={monthRange(i)}
                onPress={() => setSelected(i)}
                trailing={
                  <View style={styles.summaryValues}>
                    {usedKinds.map((k) => (
                      <ThemedText key={k} type={k === usedKinds[0] ? 'smallBold' : 'caption'} themeColor={k === usedKinds[0] ? undefined : 'textSecondary'} style={styles.tabular}>
                        {`${num(m[k].kcal).toLocaleString('it-IT')} kcal${split ? ` · ${kindLabel(k)}` : ''}`}
                      </ThemedText>
                    ))}
                  </View>
                }
              />
            ))}
          </ListGroup>

          {triedApprove && blockedMonths.length > 0 ? (
            <ThemedText type="small" style={[styles.inset, { color: theme.danger }]} accessibilityRole="alert">
              {`Da sistemare: ${blockedMonths.map((m) => monthName(m - 1)).join(', ')}.`}
            </ThemedText>
          ) : null}

          <PrimaryButton label={editing ? 'Salva le modifiche' : 'Approva il piano'} icon="check" onPress={() => approve(close)} />

          <GlassPopup visible={confirmOpen} onClose={() => setConfirmOpen(false)} style={styles.popup}>
            <ThemedText type="title" style={styles.center}>
              Sostituire il piano alimentare?
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              Il tuo piano prende il posto di quello attuale: Home, Nutrizione e il resto dell’app useranno queste calorie e macro. Puoi tornare al piano di FitLab quando vuoi.
            </ThemedText>
            <PrimaryButton label="Sostituisci" onPress={() => commit(close)} />
            <PrimaryButton label="Annulla" variant="outline" onPress={() => setConfirmOpen(false)} />
          </GlassPopup>
        </>
      )}
    </SheetScreen>
  );
}

function MacroRow({
  label,
  color,
  grams,
  pct,
  editable,
  auto,
  onGrams,
  onPct,
}: {
  label: string;
  color: string;
  grams: string;
  pct: string;
  editable: boolean;
  /** Computed, not typed (the carbs). */
  auto?: boolean;
  onGrams?: (v: string) => void;
  onPct?: (v: string) => void;
}) {
  return (
    <View style={styles.numberRow}>
      <View style={[styles.rowTitle, styles.macroName]}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <ThemedText type="default" numberOfLines={1} style={styles.flexShrink}>
          {label}
        </ThemedText>
        {auto ? <Icon name="refresh" size={13} color={color} /> : null}
      </View>
      <NumberField value={grams} unit="g" editable={editable} label={`${label} in grammi${auto ? ', calcolati' : ''}`} onChange={onGrams} />
      <NumberField value={pct} unit="%" editable={editable} label={`${label} in percentuale${auto ? ', calcolata' : ''}`} onChange={onPct} />
    </View>
  );
}

function NumberField({ value, unit, editable, wide, label, onChange }: { value: string; unit: string; editable: boolean; wide?: boolean; label: string; onChange?: (v: string) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.field, wide ? styles.fieldWide : null, { backgroundColor: editable ? theme.backgroundElement : 'transparent' }]}>
      <AppTextInput
        value={value}
        onChangeText={onChange}
        editable={editable}
        keyboardType="number-pad"
        inputMode="numeric"
        selectTextOnFocus
        maxLength={5}
        accessibilityLabel={label}
        style={[styles.input, { color: editable ? theme.text : theme.textSecondary }]}
      />
      <ThemedText type="small" themeColor="textSecondary" style={styles.unit}>
        {unit}
      </ThemedText>
    </View>
  );
}

function StepButton({ icon, label, disabled, onPress }: { icon: 'plus' | 'minusSign'; label: string; disabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.stepButton, { backgroundColor: theme.backgroundElement, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}
    >
      <Icon name={icon} size={18} color={theme.text} />
    </Pressable>
  );
}

function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <ThemedText type="small" style={{ color: theme.accent, fontWeight: '600' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four },
  group: { gap: Spacing.two },
  inset: { paddingHorizontal: INSET },
  flexShrink: { flexShrink: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 24, textAlign: 'center', fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: INSET, paddingVertical: 12 },
  dayChip: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  // Chips span the full width of the cards below them: same left and right edge.
  monthGrid: { gap: Spacing.two, marginBottom: Spacing.two },
  monthRow: { flexDirection: 'row', gap: Spacing.two },
  monthChip: { flex: 1, minHeight: 48, paddingHorizontal: 4, paddingVertical: 6, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  monthPad: { flex: 1 },
  chipMonth: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  chipKcal: { fontSize: 14, lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  colHead: { flexDirection: 'row', alignItems: 'center', gap: COL_GAP, paddingHorizontal: INSET, paddingTop: 10, paddingBottom: 6 },
  colLabel: { width: COL, textAlign: 'center' },
  numberRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: COL_GAP, paddingHorizontal: INSET, paddingVertical: 6 },
  rowTitle: { flex: 1, minWidth: 0 },
  macroName: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 4, width: COL, flexShrink: 0, height: 38, borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: Spacing.two, justifyContent: 'flex-end' },
  fieldWide: { width: COL * 2 + COL_GAP },
  input: { flex: 1, minWidth: 0, width: '100%', fontSize: 17, textAlign: 'right', fontVariant: ['tabular-nums'], padding: 0 },
  unit: { minWidth: 22, textAlign: 'left' },
  issues: { gap: 4, paddingHorizontal: INSET },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four, paddingHorizontal: INSET },
  summaryValues: { alignItems: 'flex-end', gap: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  popup: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch' },
  center: { textAlign: 'center' },
});
