import { StyleSheet, View } from 'react-native';

import { AnimatedFill } from '@/components/motion/animated-fill';
import { PressableScale } from '@/components/motion/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TodayTask = {
  icon: IconName;
  label: string;
  done: number;
  total: number;
  /** Shown instead of "x/y" when the task isn't a count (e.g. a rest day). */
  note?: string;
  onPress: () => void;
  actionLabel: string;
};

export type TodayTasksCardProps = {
  tasks: TodayTask[];
  radius?: number;
};

/**
 * What today still needs, in one line each: "Pasti registrati 2/4" and the
 * workout, each with the button that opens the flow it belongs to. Once
 * everything is in, the card says so instead of nagging.
 */
export function TodayTasksCard({ tasks, radius = Radius.large }: TodayTasksCardProps) {
  const theme = useTheme();
  const open = tasks.filter((task) => task.done < task.total);
  const allDone = open.length === 0;

  return (
    <FlatCard radius={radius} style={styles.card}>
      <View style={styles.headRow}>
        <View style={[styles.headIcon, { backgroundColor: allDone ? theme.successSoft : theme.accentSoft }]}>
          <Icon name={allDone ? 'checkCircle' : 'bolt'} size={18} color={allDone ? theme.success : theme.accent} />
        </View>
        <View style={styles.headText}>
          <ThemedText type="subtitle">{allDone ? 'Giornata completata' : 'Da completare oggi'}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {allDone
              ? 'Hai registrato tutto quello che era in programma.'
              : `${open.length} ${open.length === 1 ? 'attività' : 'attività'} ancora da registrare.`}
          </ThemedText>
        </View>
      </View>

      {tasks.map((task) => {
        const complete = task.done >= task.total;
        return (
          <View key={task.label} style={styles.taskRow}>
            <View style={styles.taskLeft}>
              <Icon name={task.icon} size={17} color={complete ? theme.success : theme.textSecondary} />
              <View style={styles.taskTextCol}>
                <ThemedText type="small">{task.label}</ThemedText>
                {/* A task with a note ("Riposo") has nothing to fill in. */}
                {task.note ? null : (
                  <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
                    <AnimatedFill
                      progress={task.total > 0 ? task.done / task.total : 0}
                      delay={140}
                      style={[styles.fill, { backgroundColor: complete ? theme.success : theme.accent }]}
                    />
                  </View>
                )}
              </View>
            </View>
            <View style={styles.taskRight}>
              <ThemedText type="smallBold" themeColor={complete ? 'textSecondary' : 'text'}>
                {task.note ?? `${task.done}/${task.total}`}
              </ThemedText>
              {complete ? null : (
                <PressableScale
                  onPress={task.onPress}
                  haptic="tap"
                  accessibilityRole="button"
                  accessibilityLabel={task.actionLabel}
                  style={[styles.taskButton, { backgroundColor: theme.accent }]}>
                  <Icon name="plus" size={15} color={theme.onAccent} />
                </PressableScale>
              )}
            </View>
          </View>
        );
      })}
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  taskLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  taskTextCol: {
    flex: 1,
    gap: 6,
  },
  track: {
    height: 5,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  taskRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  taskButton: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
