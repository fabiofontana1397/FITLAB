import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type WeekTimelineWeek = { weekNumber: number; startISO: string; endISO: string; isCurrent: boolean };

const NODE_SIZE = 28;

/** "19-25 set" / "29 set - 5 ott" — a 3-letter-month date range compact
 * enough for the narrow week-node columns (formatDayRange's full month
 * name doesn't fit here). */
function compactDayRange(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const shortMonth = (d: Date) => d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '');
  if (start.getMonth() === end.getMonth()) return `${start.getDate()}-${end.getDate()} ${shortMonth(start)}`;
  return `${start.getDate()} ${shortMonth(start)} - ${end.getDate()} ${shortMonth(end)}`;
}

/** The plan card's "Settimana 1..4" strip: a connecting line under 4 dots,
 * the current week filled solid, each with its label and real calendar date
 * range underneath — the week-level counterpart to PlanTimeline's month
 * dots (used elsewhere for the whole multi-month plan). */
export function WeekTimeline({ weeks }: { weeks: WeekTimelineWeek[] }) {
  const theme = useTheme();
  const currentIndex = weeks.findIndex((w) => w.isCurrent);
  const fillFraction = weeks.length > 1 ? Math.max(currentIndex, 0) / (weeks.length - 1) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.trackContainer}>
        <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.fill, { backgroundColor: theme.accent, width: `${fillFraction * 100}%` }]} />
        </View>
      </View>
      <View style={styles.row}>
        {weeks.map((week) => (
          <View key={week.weekNumber} style={styles.col}>
            <View
              style={[
                styles.node,
                {
                  backgroundColor: week.isCurrent ? theme.accent : theme.backgroundElevated,
                  borderColor: week.isCurrent ? theme.accent : theme.border,
                },
              ]}>
              <ThemedText type="caption" style={{ color: week.isCurrent ? theme.onAccent : theme.textSecondary, fontWeight: '700' }}>
                {week.weekNumber}
              </ThemedText>
            </View>
            <ThemedText
              type="caption"
              numberOfLines={1}
              style={{ color: week.isCurrent ? theme.accent : theme.text, fontWeight: '700', marginTop: 6 }}>
              Settimana {week.weekNumber}
            </ThemedText>
            <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1}>
              {compactDayRange(week.startISO, week.endISO)}
            </ThemedText>
          </View>
        ))}
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
