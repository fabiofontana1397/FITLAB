import { StyleSheet, View } from 'react-native';

import { AnimatedFill } from '@/components/motion/animated-fill';
import { PressableScale } from '@/components/motion/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatKcal } from '@/lib/format-kcal';

const GAP = 10;

export type EnergyBarsProps = {
  /** Intake so far, and the day's calorie target it fills towards. */
  eatenKcal: number;
  eatenTargetKcal: number;
  /** Burned by resting metabolism + everyday movement so far (grows hour by hour today), and over the whole day. */
  basalKcal: number;
  basalDayKcal: number;
  /** Burned by training and logged activities so far, and what the plan has for the day. */
  exerciseKcal: number;
  exerciseDayKcal: number;
  /** A day that has not started: empty bars and dashes. */
  inactive?: boolean;
  /** Today is still running: the basal share is shown against its full day. */
  running?: boolean;
  onEatenPress?: () => void;
  onBurnedPress?: () => void;
};

/** `#rrggbb` with an alpha. */
function alpha(hex: string, a: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex;
  return `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
}

function TileHeader({ icon, color, title }: { icon: IconName; color: string; title: string }) {
  return (
    <View style={styles.header}>
      <View style={[styles.headerIcon, { backgroundColor: alpha(color, 0.16) }]}>
        <Icon name={icon} size={14} color={color} />
      </View>
      <ThemedText style={styles.headerTitle} numberOfLines={1}>
        {title}
      </ThemedText>
    </View>
  );
}

/**
 * Under the ring: where the day's energy comes from and goes, in two tiles side
 * by side like the ones below them.
 *
 * Assunte (left): intake against the day's calorie target, one orange bar.
 * Bruciate (right): one green bar over the whole expected day, built from the
 * lighter metabolism (resting + everyday movement, growing hour after hour) and
 * the deeper activity (training and logged exercise), with both parts listed.
 */
export function EnergyBars({ eatenKcal, eatenTargetKcal, basalKcal, basalDayKcal, exerciseKcal, exerciseDayKcal, inactive = false, running = false, onEatenPress, onBurnedPress }: EnergyBarsProps) {
  const theme = useTheme();
  const burnedKcal = basalKcal + exerciseKcal;
  const burnedDay = Math.max(basalDayKcal + exerciseDayKcal, burnedKcal, 1);
  const eatenShare = inactive ? 0 : eatenTargetKcal > 0 ? eatenKcal / eatenTargetKcal : 0;
  const basalShare = inactive ? 0 : basalKcal / burnedDay;
  const exerciseShare = inactive ? 0 : exerciseKcal / burnedDay;
  const green = theme.brandGreen;
  const dash = '—';
  const left = eatenTargetKcal - eatenKcal;
  const eatenNote = inactive || eatenTargetKcal <= 0 ? dash : left >= 0 ? `Restano ${formatKcal(left)} kcal` : `Oltre di ${formatKcal(-left)} kcal`;

  return (
    <View style={styles.row}>
      {/* Intake */}
      <PressableScale onPress={onEatenPress} scaleTo={0.97} style={styles.cell} accessibilityRole="button" accessibilityLabel={`Assunte ${formatKcal(eatenKcal)} su ${formatKcal(eatenTargetKcal)} kcal`}>
        <FlatCard radius={Radius.large} style={styles.tile}>
          <TileHeader icon="utensils" color={theme.accent} title="Assunte" />
          <View style={styles.body}>
            <View style={styles.valueLine}>
              <ThemedText style={styles.value} numberOfLines={1}>
                {inactive ? dash : formatKcal(eatenKcal)}
              </ThemedText>
              <ThemedText style={styles.of} themeColor="textTertiary" numberOfLines={1}>
                {inactive ? '' : ` / ${formatKcal(eatenTargetKcal)} kcal`}
              </ThemedText>
            </View>
            <View style={[styles.track, { backgroundColor: alpha(theme.accent, 0.18) }]}>
              <AnimatedFill progress={eatenShare} delay={120} style={[styles.segment, { backgroundColor: theme.accent }]} />
            </View>
            <ThemedText style={styles.note} themeColor="textSecondary" numberOfLines={1}>
              {eatenNote}
            </ThemedText>
          </View>
        </FlatCard>
      </PressableScale>

      {/* Burned: metabolism (hour by hour) + activity */}
      <PressableScale onPress={onBurnedPress} scaleTo={0.97} style={styles.cell} accessibilityRole="button" accessibilityLabel={`Bruciate ${formatKcal(burnedKcal)} kcal: metabolismo ${formatKcal(basalKcal)}, attività ${formatKcal(exerciseKcal)}`}>
        <FlatCard radius={Radius.large} style={styles.tile}>
          <TileHeader icon="flameLine" color={green} title="Bruciate" />
          <View style={styles.body}>
            <View style={styles.valueLine}>
              <ThemedText style={styles.value} numberOfLines={1}>
                {inactive ? dash : formatKcal(burnedKcal)}
              </ThemedText>
              <ThemedText style={styles.of} themeColor="textTertiary" numberOfLines={1}>
                {inactive ? '' : ' kcal'}
              </ThemedText>
            </View>
            <View style={[styles.track, styles.stack, { backgroundColor: alpha(green, 0.14) }]}>
              <AnimatedFill progress={basalShare} delay={200} style={[styles.segment, { backgroundColor: alpha(green, 0.42) }]} />
              <AnimatedFill progress={exerciseShare} delay={320} style={[styles.segment, { backgroundColor: green }]} />
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: alpha(green, 0.42) }]} />
                <ThemedText style={styles.legendText} themeColor="textSecondary" numberOfLines={1}>
                  Metabolismo
                </ThemedText>
                <ThemedText style={styles.legendValue} numberOfLines={1}>
                  {inactive ? dash : formatKcal(basalKcal)}
                  {running && !inactive && basalDayKcal > basalKcal ? (
                    <ThemedText style={styles.legendOf} themeColor="textTertiary">
                      {`/${formatKcal(basalDayKcal)}`}
                    </ThemedText>
                  ) : null}
                </ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: green }]} />
                <ThemedText style={styles.legendText} themeColor="textSecondary" numberOfLines={1}>
                  Attività
                </ThemedText>
                <ThemedText style={styles.legendValue} numberOfLines={1}>
                  {inactive ? dash : formatKcal(exerciseKcal)}
                </ThemedText>
              </View>
            </View>
          </View>
        </FlatCard>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: GAP, marginTop: 10 },
  cell: { flex: 1 },
  tile: { flex: 1, padding: 14, justifyContent: 'space-between', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  body: { gap: 8 },
  valueLine: { flexDirection: 'row', alignItems: 'baseline' },
  value: { fontSize: 22, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  of: { flexShrink: 1, fontSize: 12, lineHeight: 26, fontWeight: '600', fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  stack: { flexDirection: 'row' },
  segment: { height: 6 },
  note: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  legend: { gap: 3 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  legendValue: { fontSize: 12, lineHeight: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  legendOf: { fontSize: 11, lineHeight: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
