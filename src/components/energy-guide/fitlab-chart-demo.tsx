import { StyleSheet, View } from 'react-native';

import { useCountUp } from '@/components/energy-guide/use-play-value';
import { OggiGauge } from '@/components/home/oggi-gauge';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { readBalance } from '@/domain/calorie-balance';
import { useTheme } from '@/hooks/use-theme';
import type { DemoDay } from '@/lib/energy-guide/demo-example';
import { explain, type ExplainTone } from '@/lib/energy-guide/explain';
import { formatKcal, formatSignedKcal } from '@/lib/format-kcal';

export type FitLabChartDemoProps = {
  day: DemoDay;
  play: boolean;
};

/**
 * Page 4: Home's own gauge (OggiGauge, unchanged) fed with the example's
 * numbers, under the same three columns Home shows, plus a running
 * explanation of what the arcs and the markers are saying right now.
 *
 * Until the page is first shown the gauge gets an empty day, so its own
 * glide — the one it does on Home — starts when it comes into view.
 */
export function FitLabChartDemo({ day, play }: FitLabChartDemoProps) {
  const theme = useTheme();
  const burnedKcal = play ? day.burnedKcal : 0;
  const eatenKcal = play ? day.eatenKcal : 0;
  const reading = play ? day.reading : readBalance({ eatenKcal: 0, burnedKcal: 0, goalKcal: day.goalKcal, toleranceKcal: day.toleranceKcal });
  const shownBalance = useCountUp(day.balanceKcal, play);

  return (
    <View style={styles.root}>
      <View
        accessible
        accessibilityLabel={`Esempio del grafico di FitLab: bilancio ${formatSignedKcal(day.balanceKcal)} kcal, ${day.caption}. Obiettivo ${formatSignedKcal(day.goalKcal)} kcal. Consumate ${formatKcal(day.burnedKcal)}, assunte ${formatKcal(day.eatenKcal)} kcal.`}>
        <OggiGauge
          burnedKcal={burnedKcal}
          eatenKcal={eatenKcal}
          burnedColor={theme.accent}
          eatenColor={theme.brandGreen}
          reading={reading}
          value={formatSignedKcal(play ? shownBalance : 0)}
          caption={play ? day.caption : ''}
        />
      </View>

      <View style={styles.row}>
        <Column icon="flame" color={theme.accent} label="Bruciate" value={`${formatKcal(day.burnedKcal)} kcal`} />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Column icon="target" color={theme.textSecondary} label="Obiettivo" value={`${formatSignedKcal(day.goalKcal)} kcal`} />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Column icon="utensils" color={theme.brandGreen} label="Assunte" value={`${formatKcal(day.eatenKcal)} kcal`} />
      </View>

      <View style={styles.notes}>
        {explain(day).map((line) => (
          <View key={line.key} style={styles.note}>
            <View style={[styles.bullet, { backgroundColor: toneColor(line.tone, theme) }]} />
            <ThemedText style={styles.noteText} themeColor="textSecondary">
              {line.text}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

function toneColor(tone: ExplainTone, theme: ReturnType<typeof useTheme>): string {
  switch (tone) {
    case 'burned':
      return theme.accent;
    case 'goal':
      return theme.balanceGoalScale[2];
    case 'surplus':
      return theme.calorieSurplus;
    case 'deficit':
      return theme.calorieDeficit;
    default:
      return theme.text;
  }
}

function Column({ icon, color, label, value }: { icon: IconName; color: string; label: string; value: string }) {
  return (
    <View style={styles.col}>
      <Icon name={icon} size={20} color={color} />
      <ThemedText style={styles.colLabel} themeColor="textTertiary">
        {label}
      </ThemedText>
      <ThemedText style={styles.colValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 38,
  },
  colLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
  },
  colValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  notes: {
    gap: 8,
  },
  note: {
    flexDirection: 'row',
    gap: 8,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});
