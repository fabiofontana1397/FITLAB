import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

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

/** One line under a tile's bar: an optional legend dot, the label, and its value on the right. */
function Row({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <View style={styles.rowLine}>
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <ThemedText style={styles.rowLabel} themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText style={styles.rowValue} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
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
 * Under the ring: where the day's energy comes from and goes, in two square
 * tiles built like the ones below them: the header, the figure, a bar and its
 * lines, all from the top so the two bars sit level.
 *
 * Assunte (left): intake against the day's calorie target, and what is left.
 * Bruciate (right): one green bar over the whole expected day, built from the
 * lighter metabolism (resting + everyday movement) and the deeper training,
 * each with its own line.
 */
export function EnergyBars({ eatenKcal, eatenTargetKcal, basalKcal, basalDayKcal, exerciseKcal, exerciseDayKcal, inactive = false, onEatenPress, onBurnedPress }: EnergyBarsProps) {
  const theme = useTheme();
  // Square at rest, like the tiles below: the row's width sets the minimum height.
  const [side, setSide] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round((e.nativeEvent.layout.width - GAP) / 2);
    setSide((prev) => (prev === next ? prev : next));
  };
  const burnedKcal = basalKcal + exerciseKcal;
  const burnedDay = Math.max(basalDayKcal + exerciseDayKcal, burnedKcal, 1);
  const eatenShare = inactive ? 0 : eatenTargetKcal > 0 ? eatenKcal / eatenTargetKcal : 0;
  const basalShare = inactive ? 0 : basalKcal / burnedDay;
  const exerciseShare = inactive ? 0 : exerciseKcal / burnedDay;
  const green = theme.brandGreen;
  const dash = '—';
  const hasTarget = eatenTargetKcal > 0;
  const left = eatenTargetKcal - eatenKcal;

  return (
    <View style={styles.row} onLayout={onLayout}>
      {/* Intake */}
      <PressableScale onPress={onEatenPress} scaleTo={0.97} style={styles.cell} accessibilityRole="button" accessibilityLabel={`Assunte ${formatKcal(eatenKcal)} su ${formatKcal(eatenTargetKcal)} kcal`}>
        <FlatCard radius={Radius.large} style={[styles.tile, { minHeight: side }]}>
          <TileHeader icon="utensils" color={theme.accent} title="Assunte" />
          <View style={styles.body}>
            <View>
              <ThemedText style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
                {inactive ? dash : formatKcal(eatenKcal)}
              </ThemedText>
              <ThemedText style={styles.unit} themeColor="textTertiary" numberOfLines={1}>
                {hasTarget && !inactive ? `/ ${formatKcal(eatenTargetKcal)} kcal` : 'kcal'}
              </ThemedText>
            </View>
            <View style={[styles.track, { backgroundColor: alpha(theme.accent, 0.18) }]}>
              <AnimatedFill progress={eatenShare} delay={120} style={[styles.segment, { backgroundColor: theme.accent }]} />
            </View>
            <View style={styles.rows}>
              <Row label={!inactive && hasTarget && left < 0 ? 'Oltre' : 'Restano'} value={inactive || !hasTarget ? dash : `${formatKcal(Math.abs(left))} kcal`} />
            </View>
          </View>
        </FlatCard>
      </PressableScale>

      {/* Burned: metabolism (hour by hour) + activity */}
      <PressableScale onPress={onBurnedPress} scaleTo={0.97} style={styles.cell} accessibilityRole="button" accessibilityLabel={`Bruciate ${formatKcal(burnedKcal)} kcal: metabolismo ${formatKcal(basalKcal)}, attività ${formatKcal(exerciseKcal)}`}>
        <FlatCard radius={Radius.large} style={[styles.tile, { minHeight: side }]}>
          <TileHeader icon="flameLine" color={green} title="Bruciate" />
          <View style={styles.body}>
            <View>
              <ThemedText style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
                {inactive ? dash : formatKcal(burnedKcal)}
              </ThemedText>
              <ThemedText style={styles.unit} themeColor="textTertiary" numberOfLines={1}>
                kcal
              </ThemedText>
            </View>
            <View style={[styles.track, styles.stack, { backgroundColor: alpha(green, 0.14) }]}>
              <AnimatedFill progress={basalShare} delay={200} style={[styles.segment, { backgroundColor: alpha(green, 0.42) }]} />
              <AnimatedFill progress={exerciseShare} delay={320} style={[styles.segment, { backgroundColor: green }]} />
            </View>
            <View style={styles.rows}>
              <Row dot={alpha(green, 0.42)} label="Metabolismo" value={inactive ? dash : formatKcal(basalKcal)} />
              <Row dot={green} label="Allenamento" value={inactive ? dash : formatKcal(exerciseKcal)} />
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
  tile: { flex: 1, padding: 14, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  body: { gap: 10 },
  value: { fontSize: 30, lineHeight: 34, fontWeight: '800', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 12, lineHeight: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  stack: { flexDirection: 'row' },
  segment: { height: 6 },
  rows: { gap: 3 },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 16 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  rowLabel: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  rowValue: { fontSize: 12, lineHeight: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
