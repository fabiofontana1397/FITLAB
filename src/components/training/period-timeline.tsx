import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';

export type TimelinePeriod = { number: number; isCurrent: boolean };

const NODE_SIZE = 28;

/** A generic "N of these periods" strip: a connecting line under one dot
 * per period, the current one outlined, past ones filled solid with a
 * checkmark, each with its label (`{label} {number}`, e.g. "Sett 1" or
 * "Mese 1") underneath. Used for the plan card's month strip
 * (label="Mese") — same visual convention week-level use would follow
 * too, if that comes back. */
export function PeriodTimeline({ label, periods }: { label: string; periods: TimelinePeriod[] }) {
  const theme = useTheme();
  const currentIndex = periods.findIndex((p) => p.isCurrent);
  const fillFraction = periods.length > 1 ? Math.max(currentIndex, 0) / (periods.length - 1) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.trackContainer}>
        <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.fill, { backgroundColor: theme.accent, width: `${fillFraction * 100}%` }]} />
        </View>
      </View>
      <View style={styles.row}>
        {periods.map((period, index) => {
          const done = currentIndex >= 0 && index < currentIndex;
          return (
            <View key={period.number} style={styles.col}>
              <View
                style={[
                  styles.node,
                  {
                    backgroundColor: done ? theme.accent : theme.backgroundElevated,
                    borderColor: period.isCurrent || done ? theme.accent : theme.border,
                  },
                ]}>
                {done ? (
                  <Icon name="check" size={14} color={theme.onAccent} />
                ) : (
                  <ThemedText type="caption" style={{ color: period.isCurrent ? theme.accent : theme.textSecondary, fontWeight: '700' }}>
                    {period.number}
                  </ThemedText>
                )}
              </View>
              <ThemedText type="caption" numberOfLines={1} style={{ color: theme.text, fontWeight: '700', marginTop: 6 }}>
                {label} {period.number}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 6,
  },
  trackContainer: {
    position: 'absolute',
    left: NODE_SIZE / 2,
    right: NODE_SIZE / 2,
    top: 6 + NODE_SIZE / 2 - 2,
    height: 4,
  },
  track: {
    flex: 1,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  col: {
    width: 74,
    alignItems: 'center',
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
