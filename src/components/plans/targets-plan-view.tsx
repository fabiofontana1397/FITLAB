import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MonthTimeline } from '@/components/plans/month-timeline';
import { Reveal } from '@/components/motion/reveal';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { OnBrand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticTap } from '@/lib/haptics';
import { mondayIndex } from '@/lib/mock/dates';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { macroPercents, monthDayTargets, planMonthName, type DayKind } from '@/lib/planning/targets-plan';
import type { DietPlan } from '@/lib/planning/types';

const DAY_MS = 86_400_000;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const shortDate = (d: Date) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

/**
 * The Piani page for a plan of the person's own targets: no menu, only the numbers. "Il tuo piano": the path of the
 * months (each named after its calendar month), the chosen month's calories and macros — for training days and for
 * rest days — and the way to change them; then every month in a list.
 */
export function TargetsPlanView({ plan, checkinPendingMonth, onCheckin }: { plan: DietPlan; checkinPendingMonth: number | null; onCheckin: () => void }) {
  const theme = useTheme();
  const total = plan.durationMonths;
  const current = currentMonthIndex(plan);
  const [selected, setSelected] = useState(current);
  // Read once on mount: `Date.now()` is impure, so it cannot be called while rendering.
  const [now] = useState(() => Date.now());
  const startMs = new Date(plan.generatedAt).getTime();
  const elapsedMonths = clamp01((now - startMs) / (total * 30 * DAY_MS)) * total;

  const trainingDays = plan.ownTargets?.trainingDays ?? [];
  // Two kinds of day only when the week has both; otherwise every day shares one target.
  const split = trainingDays.length > 0 && trainingDays.length < 7;
  const [kind, setKind] = useState<DayKind>(() => (trainingDays.includes(mondayIndex(new Date(now))) ? 'training' : 'rest'));
  const shownKind: DayKind = split ? kind : trainingDays.length === 7 ? 'training' : 'rest';

  const monthStart = (i: number) => new Date(startMs + (i - 1) * 30 * DAY_MS);
  const monthRange = (i: number) => `${shortDate(monthStart(i))} – ${shortDate(new Date(monthStart(i + 1).getTime() - DAY_MS))}`;
  const monthName = (i: number, style: 'long' | 'short' = 'long') => planMonthName(startMs, i, style);

  const month = plan.months.find((m) => m.monthIndex === selected) ?? plan.months[0];
  const t = monthDayTargets(month)[shownKind];
  const pct = macroPercents(t);
  const status = selected < current ? 'Concluso' : selected === current ? 'In corso' : 'Da iniziare';
  // Same colours as Home and Nutrizione, so a macro reads the same everywhere.
  const macros = [
    { label: 'Proteine', grams: t.protein, pct: pct.protein, color: theme.accent },
    { label: 'Carboidrati', grams: t.carbs, pct: pct.carbs, color: theme.brandGreen },
    { label: 'Grassi', grams: t.fats, pct: pct.fats, color: theme.brandYellow },
  ];
  const edit = () => {
    hapticTap();
    router.push('/custom-targets');
  };

  return (
    <View style={styles.stack}>
      <Reveal index={0}>
        <FlatCard radius={Radius.medium} style={styles.box}>
          <ThemedText style={styles.title} numberOfLines={1} accessibilityRole="header">
            Il tuo piano
          </ThemedText>

          <View>
            <MonthTimeline months={plan.months.map((m) => m.monthIndex)} current={current} selected={selected} elapsedMonths={elapsedMonths} onSelect={setSelected} />
            <View style={styles.monthLabels} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              {plan.months.map((m) => (
                <ThemedText
                  key={m.monthIndex}
                  numberOfLines={1}
                  style={[
                    styles.monthLabel,
                    { color: m.monthIndex === selected ? (m.monthIndex === current ? theme.accent : theme.text) : theme.textTertiary, fontWeight: m.monthIndex === selected ? '700' : '500' },
                  ]}
                >
                  {monthName(m.monthIndex, total > 6 ? 'short' : 'long')}
                </ThemedText>
              ))}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.monthHead}>
            <ThemedText style={styles.monthTitle}>{`${monthName(selected)} · ${monthRange(selected)}`}</ThemedText>
            <View style={[styles.pill, { backgroundColor: selected === current ? theme.accentSoft : theme.backgroundElement }]}>
              <ThemedText style={[styles.pillText, { color: selected === current ? theme.accent : theme.textSecondary }]}>{status}</ThemedText>
            </View>
          </View>

          {split ? (
            <SegmentedControl
              options={[
                { value: 'training', label: 'Allenamento' },
                { value: 'rest', label: 'Riposo' },
              ]}
              value={kind}
              onChange={setKind}
            />
          ) : null}

          <View style={styles.kcalRow} accessibilityLabel={`${t.calories} kcal al giorno`}>
            <ThemedText style={styles.kcal}>{t.calories.toLocaleString('it-IT')}</ThemedText>
            <ThemedText style={styles.kcalUnit} themeColor="textSecondary">
              {split ? `kcal nei giorni di ${shownKind === 'training' ? 'allenamento' : 'riposo'}` : 'kcal al giorno'}
            </ThemedText>
          </View>

          {/* One bar split by each macro's share of the calories, then the three values under it — as in Ricette. */}
          <View style={styles.macros} accessibilityLabel={macros.map((m) => `${m.label} ${m.grams} grammi, ${m.pct} per cento`).join(', ')}>
            <View style={styles.splitBar}>
              {macros.map((m) => (
                <View key={m.label} style={{ flex: Math.max(m.pct, 2), backgroundColor: m.color }} />
              ))}
            </View>
            <View style={styles.macroRow}>
              {macros.map((m) => (
                <View key={m.label} style={styles.macroCol}>
                  <View style={styles.macroName}>
                    <View style={[styles.dot, { backgroundColor: m.color }]} />
                    <ThemedText style={styles.macroLabel} themeColor="textSecondary" numberOfLines={1}>
                      {m.label}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.macroValue}>{`${m.grams} g`}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          <PrimaryButton label="Modifica il tuo piano" icon="edit" variant="outline" onPress={edit} />

          {checkinPendingMonth ? (
            <Pressable onPress={onCheckin} accessibilityRole="button" style={({ pressed }) => [styles.checkin, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}>
              <Icon name="checkCircle" size={18} color={OnBrand.text} />
              <ThemedText style={[styles.checkinText, { color: OnBrand.text }]}>{`Fai il check-in · ${monthName(checkinPendingMonth)}`}</ThemedText>
            </Pressable>
          ) : null}
        </FlatCard>
      </Reveal>

    </View>
  );
}

const styles = StyleSheet.create({
  macros: { gap: 10 },
  splitBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 3 },
  macroRow: { flexDirection: 'row' },
  macroCol: { flex: 1, gap: 2 },
  macroName: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  macroLabel: { fontSize: 14, lineHeight: 18, fontWeight: '500' },
  macroValue: { fontSize: 18, lineHeight: 23, fontWeight: '700', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  stack: { gap: Spacing.four },
  box: { padding: 14, gap: 12 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.3 },
  monthLabels: { flexDirection: 'row', marginTop: 2 },
  monthLabel: { flex: 1, textAlign: 'center', fontSize: 11, lineHeight: 14 },
  divider: { height: StyleSheet.hairlineWidth },
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  monthTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.2 },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderCurve: 'continuous' },
  pillText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  kcal: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  kcalUnit: { fontSize: 15, lineHeight: 20 },
  checkin: { minHeight: 44, borderRadius: 14, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  checkinText: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
});
