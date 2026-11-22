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
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import {
  gramsFromPercents,
  isTargetsPlan,
  kcalFromGrams,
  macroPercents,
  TARGET_LIMITS,
  validateMonthTargets,
  type MacroMode,
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

/** What the person is typing for one month: calories, then the three macros in the chosen unit (% or g). */
type Draft = { kcal: string; protein: string; carbs: string; fats: string };
type MacroKey = 'protein' | 'carbs' | 'fats';

const MACROS: { key: MacroKey; label: string }[] = [
  { key: 'protein', label: 'Proteine' },
  { key: 'carbs', label: 'Carboidrati' },
  { key: 'fats', label: 'Grassi' },
];

const num = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const digits = (s: string) => s.replace(/[^0-9]/g, '').slice(0, 5);

function toDraft(t: MonthTargets, mode: MacroMode): Draft {
  const v = mode === 'percent' ? macroPercents(t) : t;
  return { kcal: String(Math.round(t.calories)), protein: String(Math.round(v.protein)), carbs: String(Math.round(v.carbs)), fats: String(Math.round(v.fats)) };
}

function toTargets(d: Draft, mode: MacroMode): MonthTargets {
  const calories = num(d.kcal);
  if (mode === 'grams') return { calories, protein: num(d.protein), carbs: num(d.carbs), fats: num(d.fats) };
  return { calories, ...gramsFromPercents(calories, { protein: num(d.protein), carbs: num(d.carbs), fats: num(d.fats) }) };
}

const shortDate = (d: Date) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

/**
 * "Imposta il tuo piano": how many months, and for each month the calories and the macros (in percent or in grams).
 * Once approved there is no menu: the targets replace the nutrition plan and every screen of the app follows them.
 * Opened again on a plan of this kind, it edits it: start date kept, months already lived locked.
 */
export function TargetsPlanSheet() {
  const theme = useTheme();
  const ctx = useUserContext();
  const dietPlan = usePlanStore((s) => s.dietPlan);
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
    const mode: MacroMode = editing?.ownTargets?.macroMode ?? 'percent';
    if (editing) return { mode, drafts: editing.months.map((m) => toDraft({ calories: m.calorieTarget, ...m.macroTargetsG }, mode)) };
    const month = dietPlan?.months.find((m) => m.monthIndex === currentMonthIndex(dietPlan));
    const base: MonthTargets = month
      ? { calories: month.calorieTarget, ...month.macroTargetsG }
      : profileKcal > 0 && profileMacros.protein > 0
        ? { calories: profileKcal, ...profileMacros }
        : { calories: 2000, ...gramsFromPercents(2000, DEFAULT_SPLIT) };
    return { mode, drafts: Array.from({ length: 3 }, () => toDraft(base, mode)) };
  });
  const [mode, setMode] = useState<MacroMode>(initial.mode);
  const [drafts, setDrafts] = useState<Draft[]>(initial.drafts);
  const [selected, setSelected] = useState(Math.min(firstEditable, initial.drafts.length) - 1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [triedApprove, setTriedApprove] = useState(false);

  const count = drafts.length;
  const minMonths = Math.max(TARGET_LIMITS.minMonths, firstEditable);
  const sel = Math.min(selected, count - 1);
  const draft = drafts[sel];
  const locked = sel + 1 < firstEditable;
  const weightKg = ctx.weightKg > 0 ? ctx.weightKg : undefined;

  const monthStart = (i: number) => new Date(startMs + i * 30 * DAY_MS);
  const monthRange = (i: number) => `${shortDate(monthStart(i))} – ${shortDate(new Date(monthStart(i + 1).getTime() - DAY_MS))}`;

  const issuesOf = (d: Draft): TargetIssue[] =>
    validateMonthTargets(toTargets(d, mode), mode, { protein: num(d.protein), carbs: num(d.carbs), fats: num(d.fats) }, weightKg);
  const allIssues = drafts.map((d, i) => (i + 1 < firstEditable ? [] : issuesOf(d)));
  const blockedMonths = allIssues.map((list, i) => (list.some((x) => x.level === 'blocker') ? i + 1 : 0)).filter(Boolean);
  const issues = allIssues[sel];

  const update = (patch: Partial<Draft>) => setDrafts((prev) => prev.map((d, i) => (i === sel ? { ...d, ...patch } : d)));

  const setCount = (next: number) => {
    const n = Math.min(TARGET_LIMITS.maxMonths, Math.max(minMonths, next));
    if (n === count) return;
    hapticSelection();
    // New months start from the last one: the person changes only what moves.
    setDrafts((prev) => (n > prev.length ? [...prev, ...Array.from({ length: n - prev.length }, () => ({ ...prev[prev.length - 1] }))] : prev.slice(0, n)));
    if (sel >= n) setSelected(n - 1);
  };

  const switchMode = (next: MacroMode) => {
    if (next === mode) return;
    setDrafts((prev) => prev.map((d) => toDraft(toTargets(d, mode), next)));
    setMode(next);
  };

  const copyForward = () => {
    hapticTap();
    setDrafts((prev) => prev.map((d, i) => (i > sel ? { ...draft } : d)));
  };

  const commit = (close: () => void) => {
    const months = drafts.map((d) => toTargets(d, mode));
    hapticSuccess();
    const fromPopup = confirmOpen;
    setConfirmOpen(false);
    setTimeout(close, fromPopup ? POPUP_EXIT_MS : 0);
    setTimeout(() => setOwnTargets(months, mode), (fromPopup ? POPUP_EXIT_MS : 0) + SHEET_EXIT_MS);
  };

  const approve = (close: () => void) => {
    setTriedApprove(true);
    if (blockedMonths.length > 0) {
      setSelected(blockedMonths[0] - 1);
      return;
    }
    // Replacing a plan in progress (not just editing these targets) asks first.
    if (dietPlan && !editing) setConfirmOpen(true);
    else commit(close);
  };

  const targets = toTargets(draft, mode);
  const pct = mode === 'percent' ? { protein: num(draft.protein), carbs: num(draft.carbs), fats: num(draft.fats) } : macroPercents(targets);
  const pctSum = pct.protein + pct.carbs + pct.fats;
  const gramsKcal = kcalFromGrams(targets);
  const end = new Date(startMs + count * 30 * DAY_MS - DAY_MS);

  return (
    <SheetScreen
      title={editing ? 'I tuoi obiettivi' : 'Imposta il tuo piano'}
      eyebrow="Calorie e macro mese per mese, senza un menù"
      fallbackHref="/plans"
      contentContainerStyle={styles.content}
    >
      {(close) => (
        <>
          <ListGroup header="Durata" footer={`${editing ? 'Dal' : 'Da oggi,'} ${monthStart(0).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} al ${end.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}. Ogni mese dura 30 giorni.`}>
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

          <View style={styles.group}>
            <ThemedText type="label" themeColor="textSecondary" style={styles.inset} accessibilityRole="header">
              Macro in
            </ThemedText>
            <View style={styles.inset}>
              <SegmentedControl
                options={[
                  { value: 'percent', label: 'Percentuali' },
                  { value: 'grams', label: 'Grammi' },
                ]}
                value={mode}
                onChange={switchMode}
              />
            </View>
          </View>

          <View style={styles.group}>
            <View style={styles.monthStrip} accessibilityRole="tablist">
              {drafts.map((d, i) => {
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
                    accessibilityLabel={`Mese ${i + 1}, ${d.kcal} kcal`}
                    style={[styles.monthChip, { backgroundColor: on ? theme.text : theme.backgroundElement, borderColor: blocked ? theme.danger : 'transparent' }]}
                  >
                    <ThemedText style={[styles.chipMonth, { color: on ? theme.background : theme.textSecondary }]}>{`Mese ${i + 1}`}</ThemedText>
                    <ThemedText style={[styles.chipKcal, { color: on ? theme.background : theme.text }]}>{num(d.kcal).toLocaleString('it-IT')}</ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ListGroup
              header={`Mese ${sel + 1} · ${monthRange(sel)}`}
              footer={
                locked
                  ? 'Mese già concluso: resta com’è.'
                  : mode === 'percent'
                    ? `Totale ${Math.round(pctSum)}% · ${targets.protein} g proteine, ${targets.carbs} g carboidrati, ${targets.fats} g grassi.`
                    : `Le macro valgono ${gramsKcal.toLocaleString('it-IT')} kcal · ${pct.protein}% proteine, ${pct.carbs}% carboidrati, ${pct.fats}% grassi.`
              }
            >
              <NumberRow key="kcal" title="Calorie al giorno" unit="kcal" value={draft.kcal} editable={!locked} onChange={(v) => update({ kcal: digits(v) })} />
              {MACROS.map((m) => (
                <NumberRow
                  key={m.key}
                  title={m.label}
                  hint={mode === 'percent' ? `${targets[m.key]} g` : `${pct[m.key]}%`}
                  unit={mode === 'percent' ? '%' : 'g'}
                  value={draft[m.key]}
                  editable={!locked}
                  onChange={(v) => update({ [m.key]: digits(v) } as Partial<Draft>)}
                />
              ))}
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

            {!locked ? (
              <View style={styles.actions}>
                {mode === 'grams' && Math.abs(gramsKcal - targets.calories) > 0 ? (
                  <TextAction label={`Usa ${gramsKcal.toLocaleString('it-IT')} kcal`} onPress={() => update({ kcal: String(gramsKcal) })} />
                ) : null}
                {sel < count - 1 ? <TextAction label="Copia nei mesi successivi" onPress={copyForward} /> : null}
              </View>
            ) : null}
          </View>

          <ListGroup header="Riepilogo">
            {drafts.map((d, i) => {
              const t = toTargets(d, mode);
              return (
                <ListRow
                  key={i}
                  title={`Mese ${i + 1}`}
                  subtitle={monthRange(i)}
                  onPress={() => setSelected(i)}
                  trailing={
                    <View style={styles.summaryValues}>
                      <ThemedText type="smallBold" style={styles.tabular}>{`${t.calories.toLocaleString('it-IT')} kcal`}</ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary" style={styles.tabular}>{`P ${t.protein} · C ${t.carbs} · G ${t.fats}`}</ThemedText>
                    </View>
                  }
                />
              );
            })}
          </ListGroup>

          {triedApprove && blockedMonths.length > 0 ? (
            <ThemedText type="small" style={[styles.inset, { color: theme.danger }]} accessibilityRole="alert">
              {`Da sistemare: ${blockedMonths.map((m) => `mese ${m}`).join(', ')}.`}
            </ThemedText>
          ) : null}

          <PrimaryButton label={editing ? 'Salva le modifiche' : 'Approva il piano'} icon="check" onPress={() => approve(close)} />

          <GlassPopup visible={confirmOpen} onClose={() => setConfirmOpen(false)} style={styles.popup}>
            <ThemedText type="title" style={styles.center}>
              Sostituire il piano alimentare?
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              I tuoi obiettivi prendono il posto del piano attuale: Home, Nutrizione e il resto dell’app useranno queste calorie e macro. Puoi tornare al piano dell’app quando vuoi.
            </ThemedText>
            <PrimaryButton label="Sostituisci" onPress={() => commit(close)} />
            <PrimaryButton label="Annulla" variant="outline" onPress={() => setConfirmOpen(false)} />
          </GlassPopup>
        </>
      )}
    </SheetScreen>
  );
}

function NumberRow({ title, hint, unit, value, editable, onChange }: { title: string; hint?: string; unit: string; value: string; editable: boolean; onChange: (v: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.numberRow}>
      <ThemedText type="default" style={styles.rowTitle}>
        {title}
      </ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textTertiary" style={styles.tabular}>
          {hint}
        </ThemedText>
      ) : null}
      <View style={[styles.field, { backgroundColor: editable ? theme.backgroundElement : 'transparent' }]}>
        <AppTextInput
          value={value}
          onChangeText={onChange}
          editable={editable}
          keyboardType="number-pad"
          inputMode="numeric"
          selectTextOnFocus
          maxLength={5}
          accessibilityLabel={`${title} in ${unit}`}
          style={[styles.input, { color: editable ? theme.text : theme.textSecondary }]}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {unit}
        </ThemedText>
      </View>
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
  inset: { paddingHorizontal: Spacing.four },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 24, textAlign: 'center', fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  monthStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.four, marginBottom: Spacing.two },
  monthChip: { minWidth: 72, minHeight: 44, paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chipMonth: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  chipKcal: { fontSize: 14, lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  numberRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: 6 },
  rowTitle: { flex: 1, minWidth: 0 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 116, flexShrink: 0, height: 38, borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: Spacing.two, justifyContent: 'flex-end' },
  input: { flex: 1, minWidth: 0, width: '100%', fontSize: 17, textAlign: 'right', fontVariant: ['tabular-nums'], padding: 0 },
  issues: { gap: 4, paddingHorizontal: Spacing.four },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.four, paddingHorizontal: Spacing.four },
  summaryValues: { alignItems: 'flex-end', gap: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  popup: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch' },
  center: { textAlign: 'center' },
});
