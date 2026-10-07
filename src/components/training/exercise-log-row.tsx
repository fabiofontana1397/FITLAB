import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppTextInput } from '@/components/ui/app-text';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { TrendChart } from '@/components/ui/trend-chart';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ExerciseSetLog, ExerciseTemplate } from '@/store/training-store';

export type ExerciseLogRowProps = {
  exercise: ExerciseTemplate;
  setsToday: ExerciseSetLog[];
  history: { date: string; weightKg: number }[];
  onAddSet: (reps: number, weightKg: number) => void;
};

export function ExerciseLogRow({ exercise, setsToday, history, onAddSet }: ExerciseLogRowProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const lastSet = setsToday[setsToday.length - 1] ?? history[history.length - 1];
  const [reps, setReps] = useState(lastSet ? String(lastSet.reps ?? 6) : '6');
  const [weight, setWeight] = useState(lastSet ? String(lastSet.weightKg) : '');

  const handleAdd = () => {
    const repsNum = parseInt(reps, 10);
    const weightNum = parseFloat(weight.replace(',', '.'));
    if (!Number.isFinite(repsNum) || !Number.isFinite(weightNum) || repsNum <= 0) return;
    onAddSet(repsNum, weightNum);
  };

  const bestToday = setsToday.length
    ? Math.max(...setsToday.map((s) => s.weightKg))
    : undefined;

  return (
    <GlassSurface level="card" radius={Radius.large}>
      <Pressable onPress={() => setExpanded((e) => !e)} style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type="smallBold">{exercise.name}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {exercise.targetSets}×{exercise.targetReps} · recupero {Math.round(exercise.restSec / 60) || 1}
            {exercise.restSec < 60 ? 's' : ' min'}
          </ThemedText>
        </View>
        {bestToday != null ? (
          <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
            <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '700' }}>
              {bestToday}kg
            </ThemedText>
          </View>
        ) : null}
        <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={18} color={theme.textTertiary} />
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {history.length >= 2 ? (
            <View style={styles.chartRow}>
              <ThemedText type="caption" themeColor="textSecondary" style={{ flex: 1 }}>
                Progressione carico
              </ThemedText>
              <TrendChart data={history.map((h) => h.weightKg)} width={120} height={36} color={theme.accent} />
            </View>
          ) : null}

          {setsToday.length > 0 ? (
            <View style={{ gap: 4 }}>
              {setsToday.map((set, i) => (
                <ThemedText key={set.id} type="caption" themeColor="textSecondary">
                  Serie {i + 1}: {set.reps} rep × {set.weightKg} kg
                </ThemedText>
              ))}
            </View>
          ) : null}

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <ThemedText type="label" themeColor="textSecondary">
                Rep
              </ThemedText>
              <AppTextInput
                value={reps}
                onChangeText={setReps}
                keyboardType="number-pad"
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
                placeholderTextColor={theme.textTertiary}
              />
            </View>
            <View style={styles.inputGroup}>
              <ThemedText type="label" themeColor="textSecondary">
                Kg
              </ThemedText>
              <AppTextInput
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="0"
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
                placeholderTextColor={theme.textTertiary}
              />
            </View>
            <Pressable onPress={handleAdd} style={[styles.addButton, { backgroundColor: theme.accent }]}>
              <Icon name="plus" size={18} color={theme.onAccent} />
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                Serie
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  body: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  inputGroup: {
    gap: 4,
  },
  input: {
    width: 64,
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: 8,
    fontSize: 14,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    marginLeft: 'auto',
  },
});
