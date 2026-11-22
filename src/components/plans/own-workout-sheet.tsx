import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { AppTextInput } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { ListGroup } from '@/components/ui/list-group';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserContext } from '@/hooks/use-user-context';
import { hapticSelection, hapticSuccess, hapticTap } from '@/lib/haptics';
import {
  buildOwnWeek,
  DEFAULT_OWN_WEEK,
  exerciseFromCatalog,
  exerciseFromName,
  muscleLabel,
  ownWeekFromPlan,
  PICKER_GROUPS,
  searchExercises,
  validateOwnWeek,
  WEEKDAY_FULL,
  type OwnDay,
  type OwnExercise,
  type OwnWeek,
} from '@/lib/planning/own-workout';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { useOnboardingStore } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';

/** Exit durations of the confirmation popup and of the sheet (TimingExit, 240 ms), with a little slack. */
const POPUP_EXIT_MS = 200;
const SHEET_EXIT_MS = 280;
const DAY_LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
/** The browser's focus ring around the search field: the field already has its own background. */
const webNoOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as object;

/**
 * "Fai da te" for training: the days of the week, and for each day the exercises (from the catalog, or typed) with
 * sets, reps and rest. Saved, it replaces the training plan and is followed as written; opened again on a program
 * of this kind, it edits it.
 */
export function OwnWorkoutSheet() {
  const theme = useTheme();
  const ctx = useUserContext();
  const answers = useOnboardingStore((s) => s.answers);
  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const importCustomTraining = usePlanStore((s) => s.importCustomTraining);
  const editing = trainingPlan?.source === 'custom' && trainingPlan.ownBuilt ? trainingPlan : null;

  const [week, setWeek] = useState<OwnWeek>(() => (editing ? ownWeekFromPlan(editing, currentMonthIndex(editing)) : DEFAULT_OWN_WEEK()));
  const days = useMemo(() => Object.keys(week).map(Number).sort((a, b) => a - b), [week]);
  const [selected, setSelected] = useState<number>(() => days[0] ?? 0);
  const sel = week[selected] ? selected : (days[0] ?? null);
  const day = sel != null ? week[sel] : null;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const results = useMemo(() => searchExercises(query, group), [query, group]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tried, setTried] = useState(false);
  const issues = validateOwnWeek(week);

  const toggleDay = (i: number) => {
    hapticSelection();
    setWeek((prev) => {
      const next = { ...prev };
      if (next[i]) delete next[i];
      else next[i] = { title: `Allenamento ${String.fromCharCode(65 + Object.keys(prev).length)}`, exercises: [] };
      return next;
    });
    if (!week[i]) setSelected(i);
  };

  const updateDay = (patch: Partial<OwnDay>) => sel != null && setWeek((prev) => ({ ...prev, [sel]: { ...prev[sel], ...patch } }));
  const updateExercise = (key: string, patch: Partial<OwnExercise>) => day && updateDay({ exercises: day.exercises.map((x) => (x.key === key ? { ...x, ...patch } : x)) });
  const removeExercise = (key: string) => {
    hapticTap();
    if (day) updateDay({ exercises: day.exercises.filter((x) => x.key !== key) });
  };
  const moveUp = (index: number) => {
    if (!day || index === 0) return;
    hapticSelection();
    const list = [...day.exercises];
    [list[index - 1], list[index]] = [list[index], list[index - 1]];
    updateDay({ exercises: list });
  };
  const add = (x: OwnExercise) => {
    hapticSelection();
    if (day) updateDay({ exercises: [...day.exercises, x] });
    setQuery('');
  };

  const commit = (close: () => void) => {
    const plan = buildOwnWeek(week);
    const weightKg = ctx.weightKg > 0 ? ctx.weightKg : undefined;
    hapticSuccess();
    const fromPopup = confirmOpen;
    setConfirmOpen(false);
    setTimeout(close, fromPopup ? POPUP_EXIT_MS : 0);
    setTimeout(() => importCustomTraining(answers, plan, weightKg, { own: true }), (fromPopup ? POPUP_EXIT_MS : 0) + SHEET_EXIT_MS);
  };
  const save = (close: () => void) => {
    setTried(true);
    if (issues.length > 0) {
      const first = issues.find((x) => x.day != null);
      if (first?.day != null) setSelected(first.day);
      return;
    }
    if (trainingPlan && !editing) setConfirmOpen(true);
    else commit(close);
  };

  const dayIssues = tried && sel != null ? issues.filter((x) => x.day === sel) : [];
  const typed = query.trim();

  return (
    <SheetScreen title={editing ? 'Il tuo programma' : 'Crea il tuo programma'} eyebrow="Scegli i giorni e gli esercizi" fallbackHref="/plans" contentContainerStyle={styles.content}>
      {(close) => (
        <>
          <ListGroup header="Giorni di allenamento" footer={days.length === 0 ? 'Nessun giorno scelto.' : `${days.length} ${days.length === 1 ? 'allenamento' : 'allenamenti'} a settimana, gli altri giorni sono di riposo.`}>
            <View key="days" style={styles.weekRow}>
              {DAY_LETTERS.map((l, i) => {
                const on = week[i] != null;
                return (
                  <Pressable
                    key={i}
                    onPress={() => toggleDay(i)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    aria-checked={on}
                    accessibilityLabel={WEEKDAY_FULL[i]}
                    style={[styles.dayToggle, { backgroundColor: on ? theme.text : theme.backgroundElement }]}
                  >
                    <ThemedText style={[styles.dayLetter, { color: on ? theme.background : theme.textSecondary }]}>{l}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ListGroup>

          {days.length > 0 ? (
            <View style={styles.group}>
              <View style={styles.chips} accessibilityRole="tablist">
                {days.map((i) => {
                  const on = i === sel;
                  const bad = tried && issues.some((x) => x.day === i);
                  return (
                    <Pressable
                      key={i}
                      onPress={() => {
                        hapticSelection();
                        setSelected(i);
                        setPickerOpen(false);
                      }}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${WEEKDAY_FULL[i]}, ${week[i].exercises.length} esercizi`}
                      style={[styles.chip, { backgroundColor: on ? theme.text : theme.backgroundElement, borderColor: bad ? theme.danger : 'transparent' }]}
                    >
                      <ThemedText style={[styles.chipDay, { color: on ? theme.background : theme.textSecondary }]}>{WEEKDAY_FULL[i].slice(0, 3)}</ThemedText>
                      <ThemedText style={[styles.chipCount, { color: on ? theme.background : theme.text }]}>{`${week[i].exercises.length} es.`}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {day && sel != null ? (
                <>
                  <ListGroup header={WEEKDAY_FULL[sel]}>
                    <View key="title" style={styles.titleRow}>
                      <ThemedText style={styles.titleLabel}>Nome</ThemedText>
                      <AppTextInput
                        value={day.title}
                        onChangeText={(t) => updateDay({ title: t.slice(0, 40) })}
                        placeholder="Es. Petto e tricipiti"
                        accessibilityLabel="Nome dell’allenamento"
                        style={[styles.titleInput, webNoOutline, { color: theme.text }]}
                      />
                    </View>
                    {day.exercises.map((x, index) => (
                      <View key={x.key} style={styles.exercise}>
                        <View style={styles.exerciseHead}>
                          <View style={styles.flex}>
                            <ThemedText style={styles.exerciseName} numberOfLines={2}>
                              {x.name}
                            </ThemedText>
                            {muscleLabel(x.id) ? (
                              <ThemedText type="caption" themeColor="textSecondary">
                                {muscleLabel(x.id)}
                              </ThemedText>
                            ) : null}
                          </View>
                          {index > 0 ? <RoundIcon icon="chevronUp" label={`Sposta ${x.name} più su`} onPress={() => moveUp(index)} /> : null}
                          <RoundIcon icon="trash" label={`Togli ${x.name}`} onPress={() => removeExercise(x.key)} />
                        </View>
                        <View style={styles.fields}>
                          <Field label="Serie" value={x.sets} numeric onChange={(v) => updateExercise(x.key, { sets: v.replace(/[^0-9]/g, '').slice(0, 2) })} />
                          <Field label="Ripetizioni" value={x.reps} onChange={(v) => updateExercise(x.key, { reps: v.slice(0, 10) })} />
                          <Field label="Recupero (s)" value={x.rest} numeric onChange={(v) => updateExercise(x.key, { rest: v.replace(/[^0-9]/g, '').slice(0, 3) })} />
                        </View>
                      </View>
                    ))}
                  </ListGroup>

                  {dayIssues.length > 0 ? (
                    <View style={styles.inset}>
                      {dayIssues.map((x) => (
                        <ThemedText key={x.text} type="caption" style={{ color: theme.danger }}>
                          {x.text}
                        </ThemedText>
                      ))}
                    </View>
                  ) : null}

                  {pickerOpen ? (
                    <View style={[styles.picker, { backgroundColor: theme.backgroundElement }]}>
                      <View style={[styles.search, { backgroundColor: theme.background }]}>
                        <Icon name="search" size={16} color={theme.textSecondary} />
                        <AppTextInput
                          value={query}
                          onChangeText={setQuery}
                          placeholder="Cerca un esercizio"
                          autoFocus
                          accessibilityLabel="Cerca un esercizio"
                          style={[styles.searchInput, webNoOutline, { color: theme.text }]}
                        />
                        <Pressable onPress={() => setPickerOpen(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Chiudi la ricerca">
                          <Icon name="close" size={16} color={theme.textSecondary} />
                        </Pressable>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groups}>
                        {[{ id: null, label: 'Tutti' }, ...PICKER_GROUPS].map((g) => {
                          const on = group === g.id;
                          return (
                            <Pressable
                              key={g.label}
                              onPress={() => {
                                hapticSelection();
                                setGroup(g.id);
                              }}
                              accessibilityRole="button"
                              accessibilityState={{ selected: on }}
                              style={[styles.groupChip, { backgroundColor: on ? theme.text : theme.background }]}
                            >
                              <ThemedText style={[styles.groupLabel, { color: on ? theme.background : theme.text }]}>{g.label}</ThemedText>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                      <View style={styles.results}>
                        {results.slice(0, 40).map((e) => {
                          const already = day.exercises.some((x) => x.id === e.id);
                          return (
                            <Pressable
                              key={e.id}
                              onPress={() => add(exerciseFromCatalog(e))}
                              accessibilityRole="button"
                              accessibilityLabel={`Aggiungi ${e.name}`}
                              style={({ pressed }) => [styles.result, { borderBottomColor: theme.border, opacity: pressed ? 0.6 : 1 }]}
                            >
                              <View style={styles.flex}>
                                <ThemedText style={styles.resultName} numberOfLines={1}>
                                  {e.name}
                                </ThemedText>
                                <ThemedText type="caption" themeColor="textSecondary">
                                  {muscleLabel(e.id)}
                                </ThemedText>
                              </View>
                              <Icon name={already ? 'checkCircle' : 'addCircleOutline'} size={22} color={theme.accent} />
                            </Pressable>
                          );
                        })}
                        {typed.length >= 2 ? (
                          <Pressable onPress={() => add(exerciseFromName(typed))} accessibilityRole="button" style={({ pressed }) => [styles.result, { borderBottomColor: 'transparent', opacity: pressed ? 0.6 : 1 }]}>
                            <ThemedText style={[styles.resultName, styles.flex, { color: theme.accent }]} numberOfLines={1}>{`Aggiungi “${typed}”`}</ThemedText>
                            <Icon name="plus" size={20} color={theme.accent} />
                          </Pressable>
                        ) : results.length === 0 ? (
                          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyResults}>
                            Nessun esercizio trovato.
                          </ThemedText>
                        ) : null}
                      </View>
                    </View>
                  ) : (
                    <PrimaryButton
                      label="Aggiungi esercizio"
                      icon="plus"
                      variant="outline"
                      onPress={() => {
                        hapticTap();
                        setPickerOpen(true);
                      }}
                    />
                  )}
                </>
              ) : null}
            </View>
          ) : null}

          {tried && issues.length > 0 ? (
            <ThemedText type="small" style={[styles.inset, { color: theme.danger }]} accessibilityRole="alert">
              {issues.some((x) => x.day == null) ? issues[0].text : `Da sistemare: ${[...new Set(issues.map((x) => WEEKDAY_FULL[x.day as number]))].join(', ')}.`}
            </ThemedText>
          ) : null}

          <PrimaryButton label={editing ? 'Salva le modifiche' : 'Salva il programma'} icon="check" onPress={() => save(close)} />

          <GlassPopup visible={confirmOpen} onClose={() => setConfirmOpen(false)} style={styles.popup}>
            <ThemedText type="title" style={styles.center}>
              Sostituire il programma?
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              Il programma che hai creato prende il posto di quello attuale. Puoi riprendere il piano FitLab quando vuoi da Piani.
            </ThemedText>
            <PrimaryButton label="Sostituisci" onPress={() => commit(close)} />
            <PrimaryButton label="Annulla" variant="outline" onPress={() => setConfirmOpen(false)} />
          </GlassPopup>
        </>
      )}
    </SheetScreen>
  );
}

function Field({ label, value, numeric, onChange }: { label: string; value: string; numeric?: boolean; onChange: (v: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText style={styles.fieldLabel} themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <AppTextInput
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'number-pad' : 'default'}
        inputMode={numeric ? 'numeric' : 'text'}
        selectTextOnFocus
        accessibilityLabel={label}
        style={[styles.fieldInput, webNoOutline, { backgroundColor: theme.backgroundElement, color: theme.text }]}
      />
    </View>
  );
}

function RoundIcon({ icon, label, onPress }: { icon: 'trash' | 'chevronUp'; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.round, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 }]}>
      <Icon name={icon} size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four },
  group: { gap: Spacing.three },
  flex: { flex: 1, minWidth: 0 },
  inset: { paddingHorizontal: Spacing.four, gap: 4 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  dayToggle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayLetter: { fontSize: 15, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingHorizontal: Spacing.four },
  chip: { minWidth: 64, minHeight: 44, paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chipDay: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  chipCount: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 52, paddingHorizontal: Spacing.four },
  titleLabel: { fontSize: 17 },
  titleInput: { flex: 1, minWidth: 0, fontSize: 17, textAlign: 'right', padding: 0 },
  exercise: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, gap: Spacing.two },
  exerciseHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  exerciseName: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  fields: { flexDirection: 'row', gap: Spacing.two },
  field: { flex: 1, minWidth: 0, gap: 4 },
  fieldLabel: { fontSize: 12, lineHeight: 16 },
  fieldInput: { height: 38, borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: Spacing.two, fontSize: 16, textAlign: 'center', width: '100%' },
  round: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  picker: { borderRadius: 24, borderCurve: 'continuous', padding: Spacing.three, gap: Spacing.three },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, height: 42, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: Spacing.three },
  searchInput: { flex: 1, minWidth: 0, fontSize: 16, padding: 0 },
  groups: { gap: Spacing.two },
  groupChip: { paddingHorizontal: 14, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  groupLabel: { fontSize: 14, fontWeight: '600' },
  results: {},
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 52, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  resultName: { fontSize: 16, lineHeight: 21 },
  emptyResults: { paddingVertical: Spacing.three, textAlign: 'center' },
  popup: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch' },
  center: { textAlign: 'center' },
});
