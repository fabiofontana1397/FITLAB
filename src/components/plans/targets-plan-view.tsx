import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MonthTimeline } from '@/components/plans/month-timeline';
import { Reveal } from '@/components/motion/reveal';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { PrimaryButton } from '@/components/ui/primary-button';
import { OnBrand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticTap } from '@/lib/haptics';
import { currentMonthIndex, monthProgress } from '@/lib/planning/plan-progress';
import { macroPercents } from '@/lib/planning/targets-plan';
import type { DietPlan } from '@/lib/planning/types';

const DAY_MS = 86_400_000;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const shortDate = (d: Date) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

/**
 * The Piani page for a plan of the person's own targets: no menu, only the numbers. A summary of the months (the
 * path, then the chosen month's calories and macros, then every month in a list) and the way to update them.
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

  const monthStart = (i: number) => new Date(startMs + (i - 1) * 30 * DAY_MS);
  const monthRange = (i: number) => `${shortDate(monthStart(i))} – ${shortDate(new Date(monthStart(i + 1).getTime() - DAY_MS))}`;
  const end = new Date(startMs + total * 30 * DAY_MS - DAY_MS);

  const month = plan.months.find((m) => m.monthIndex === selected) ?? plan.months[0];
  const t = { calories: month.calorieTarget, ...month.macroTargetsG };
  const pct = macroPercents(t);
  const { dayInMonth } = monthProgress(plan, selected);
  const status = selected < current ? 'Concluso' : selected === current ? `In corso · giorno ${dayInMonth} di 30` : 'Da iniziare';
  const macros = [
    { label: 'Proteine', grams: t.protein, pct: pct.protein, color: theme.accent },
    { label: 'Carboidrati', grams: t.carbs, pct: pct.carbs, color: theme.text },
    { label: 'Grassi', grams: t.fats, pct: pct.fats, color: theme.textSecondary },
  ];
  const edit = () => {
    hapticTap();
    router.push('/custom-targets');
  };

  return (
    <View style={styles.stack}>
      <Reveal index={0}>
        <FlatCard radius={Radius.medium} style={styles.box}>
          <View style={styles.headRow}>
            <View style={styles.flex}>
              <ThemedText style={styles.title} numberOfLines={1} accessibilityRole="header">
                I tuoi obiettivi
              </ThemedText>
              <ThemedText style={styles.caption} themeColor="textSecondary">
                {`${total} ${total === 1 ? 'mese' : 'mesi'} · dal ${shortDate(new Date(startMs))} al ${end.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`}
              </ThemedText>
            </View>
            <Pressable onPress={edit} hitSlop={6} accessibilityRole="button" accessibilityLabel="Modifica gli obiettivi" style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 }]}>
              <Icon name="edit" size={18} color={theme.text} />
            </Pressable>
          </View>

          <MonthTimeline months={plan.months.map((m) => m.monthIndex)} current={current} selected={selected} elapsedMonths={elapsedMonths} onSelect={setSelected} />

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.monthHead}>
            <ThemedText style={styles.monthTitle}>{`Mese ${selected} · ${monthRange(selected)}`}</ThemedText>
            <View style={[styles.pill, { backgroundColor: selected === current ? theme.accentSoft : theme.backgroundElement }]}>
              <ThemedText style={[styles.pillText, { color: selected === current ? theme.accent : theme.textSecondary }]}>{status}</ThemedText>
            </View>
          </View>

          <View style={styles.kcalRow} accessibilityLabel={`${t.calories} kcal al giorno`}>
            <ThemedText style={styles.kcal}>{t.calories.toLocaleString('it-IT')}</ThemedText>
            <ThemedText style={styles.kcalUnit} themeColor="textSecondary">
              kcal al giorno
            </ThemedText>
          </View>

          <View style={styles.macros}>
            {macros.map((m) => (
              <View key={m.label} style={styles.macro} accessibilityLabel={`${m.label} ${m.grams} grammi, ${m.pct} per cento`}>
                <View style={styles.macroHead}>
                  <ThemedText style={styles.macroLabel}>{m.label}</ThemedText>
                  <ThemedText style={styles.macroValue}>
                    {`${m.grams} g`}
                    <ThemedText style={styles.macroPct} themeColor="textSecondary">{`  ${m.pct}%`}</ThemedText>
                  </ThemedText>
                </View>
                <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
                  <View style={[styles.fill, { width: `${Math.min(100, m.pct)}%`, backgroundColor: m.color }]} />
                </View>
              </View>
            ))}
          </View>

          {checkinPendingMonth ? (
            <Pressable onPress={onCheckin} accessibilityRole="button" style={({ pressed }) => [styles.checkin, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}>
              <Icon name="checkCircle" size={18} color={OnBrand.text} />
              <ThemedText style={[styles.checkinText, { color: OnBrand.text }]}>{`Fai il check-in · Mese ${checkinPendingMonth}`}</ThemedText>
            </Pressable>
          ) : null}
        </FlatCard>
      </Reveal>

      <Reveal index={1}>
        <ListGroup header="Mese per mese" footer="Questi obiettivi valgono in tutta l’app: Home, Nutrizione e il riepilogo della settimana li usano al posto del piano alimentare.">
          {plan.months.map((m) => (
            <ListRow
              key={m.monthIndex}
              title={`Mese ${m.monthIndex}${m.monthIndex === current ? ' · in corso' : m.monthIndex < current ? ' · concluso' : ''}`}
              subtitle={monthRange(m.monthIndex)}
              onPress={() => setSelected(m.monthIndex)}
              trailing={
                <View style={styles.rowValues}>
                  <ThemedText type="smallBold" style={[styles.tabular, m.monthIndex === selected ? { color: theme.accent } : null]}>{`${m.calorieTarget.toLocaleString('it-IT')} kcal`}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary" style={styles.tabular}>{`P ${m.macroTargetsG.protein} · C ${m.macroTargetsG.carbs} · G ${m.macroTargetsG.fats}`}</ThemedText>
                </View>
              }
            />
          ))}
        </ListGroup>
      </Reveal>

      <Reveal index={2}>
        <PrimaryButton label="Aggiorna gli obiettivi" icon="edit" variant="outline" onPress={edit} />
      </Reveal>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.four },
  flex: { flex: 1, minWidth: 0 },
  box: { padding: 14, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.3 },
  caption: { fontSize: 13, lineHeight: 18 },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  monthTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.2 },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderCurve: 'continuous' },
  pillText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  kcal: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  kcalUnit: { fontSize: 15, lineHeight: 20 },
  macros: { gap: 10 },
  macro: { gap: 5 },
  macroHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  macroLabel: { fontSize: 14, lineHeight: 19, fontWeight: '500' },
  macroValue: { fontSize: 14, lineHeight: 19, fontWeight: '700', fontVariant: ['tabular-nums'] },
  macroPct: { fontSize: 13, fontWeight: '500' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  checkin: { minHeight: 44, borderRadius: 14, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  checkinText: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  rowValues: { alignItems: 'flex-end', gap: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
});
