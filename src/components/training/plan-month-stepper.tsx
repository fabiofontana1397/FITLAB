import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ProgressRing } from '@/components/ui/progress-ring';
import { useTheme } from '@/hooks/use-theme';
import type { PlanPhaseKind } from '@/lib/planning/types';

export const PHASE_SHORT_LABEL: Record<PlanPhaseKind, string> = {
  adattamento: 'Adattamento e tecnica',
  progressione: 'Sovraccarico progressivo',
  consolidamento: 'Consolidamento',
};

export type PlanMonthStepperProps = {
  months: { monthIndex: number; phase: PlanPhaseKind }[];
  /** The month the plan is in right now: earlier ones are completed, later ones locked. */
  currentMonth: number;
  /** 0..1 of the current month elapsed — drawn as the ring around its node. */
  currentFraction: number;
  selectedMonth: number;
  onSelectMonth: (month: number) => void;
};

const NODE = 52;
const RING = 62;
const COLUMN_WIDTH = 84;

/** Month-by-month path: completed months show a filled check, the current
 * one a ring that fills as the month goes on, later ones a grey node with a
 * padlock. Up to four months share the width; longer plans scroll. */
export function PlanMonthStepper({ months, currentMonth, currentFraction, selectedMonth, onSelectMonth }: PlanMonthStepperProps) {
  const theme = useTheme();
  const scrolls = months.length > 4;

  const columns = months.map((m, i) => {
    const done = m.monthIndex < currentMonth;
    const current = m.monthIndex === currentMonth;
    const locked = m.monthIndex > currentMonth;
    const selected = m.monthIndex === selectedMonth;
    const isLast = i === months.length - 1;

    return (
      <Pressable
        key={m.monthIndex}
        onPress={() => onSelectMonth(m.monthIndex)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`Mese ${m.monthIndex}${done ? ', completato' : current ? ', in corso' : ', bloccato'}`}
        style={[styles.column, scrolls ? { width: COLUMN_WIDTH } : { flex: 1 }]}>
        <View style={styles.lockSlot}>{locked ? <Icon name="lock" size={13} color={theme.textTertiary} /> : null}</View>

        <View style={styles.nodeSlot}>
          {!isLast ? (
            <View
              style={[styles.connector, { backgroundColor: m.monthIndex < currentMonth ? theme.accent : theme.backgroundElement }]}
            />
          ) : null}
          {current ? (
            <ProgressRing size={RING} strokeWidth={4} progress={Math.max(currentFraction, 0.04)} color={theme.accent} trackColor={theme.accentSoft}>
              <View style={[styles.node, { backgroundColor: theme.accent }]}>
                <ThemedText style={[styles.nodeNumber, { color: theme.onAccent }]}>{m.monthIndex}</ThemedText>
              </View>
            </ProgressRing>
          ) : (
            <View
              style={[
                styles.node,
                done
                  ? { backgroundColor: theme.brandGreen }
                  : { backgroundColor: theme.backgroundElement },
                selected && !done ? { borderWidth: 2, borderColor: theme.accent } : null,
                selected && done ? { borderWidth: 2, borderColor: theme.text } : null,
              ]}>
              {done ? (
                <Icon name="check" size={24} color="#FFFFFF" />
              ) : (
                <ThemedText style={[styles.nodeNumber, { color: theme.textTertiary }]}>{m.monthIndex}</ThemedText>
              )}
            </View>
          )}
        </View>

        <ThemedText style={[styles.monthLabel, { color: selected ? theme.accent : locked ? theme.textSecondary : theme.text }]}>
          Mese {m.monthIndex}
        </ThemedText>
        <ThemedText style={styles.phaseLabel} themeColor={locked ? 'textTertiary' : 'textSecondary'} numberOfLines={2}>
          {PHASE_SHORT_LABEL[m.phase]}
        </ThemedText>
        {selected ? <View style={[styles.selectedDot, { backgroundColor: theme.accent }]} /> : <View style={styles.selectedDot} />}
      </Pressable>
    );
  });

  if (scrolls) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {columns}
      </ScrollView>
    );
  }
  return <View style={styles.row}>{columns}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  column: {
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  lockSlot: {
    height: 16,
    justifyContent: 'center',
  },
  nodeSlot: {
    width: '100%',
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Runs from this column's centre to the next one's, behind both nodes.
  connector: {
    position: 'absolute',
    left: '50%',
    width: '100%',
    height: 3,
    borderRadius: 2,
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeNumber: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
  },
  monthLabel: {
    marginTop: 8,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '700',
  },
  phaseLabel: {
    marginTop: 2,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  selectedDot: {
    marginTop: 6,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
