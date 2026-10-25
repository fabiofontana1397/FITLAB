import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { CountUpText } from '@/components/energy-guide/count-up-text';
import { usePlayValue } from '@/components/energy-guide/use-play-value';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { formatKcal } from '@/lib/format-kcal';

export type EnergyExpenditureChartProps = {
  /** Resting energy (BMR). */
  basalKcal: number;
  /** Everything else burned in the day, training included. basal + movement = total. */
  movementKcal: number;
  /** The part of movementKcal from training and logged activities (already inside it). */
  trainingKcal: number;
  play: boolean;
};

/**
 * Page 2: where the day's expenditure comes from. One stacked bar is the
 * whole day; its two parts grow one after the other. The total is the sum of
 * the two parts and nothing else — training is shown as "di cui", a slice of
 * movement, never added on top.
 */
export function EnergyExpenditureChart({ basalKcal, movementKcal, trainingKcal, play }: EnergyExpenditureChartProps) {
  const theme = useTheme();
  const totalKcal = basalKcal + movementKcal;
  const basalShare = totalKcal > 0 ? basalKcal / totalKcal : 0;
  const movementShare = totalKcal > 0 ? movementKcal / totalKcal : 0;
  // Basal first, then movement after it: they arrive separately.
  const basalWidth = usePlayValue(basalShare, play, 0);
  const movementWidth = usePlayValue(movementShare, play, 380);
  const basalStyle = useAnimatedStyle(() => ({ width: `${basalWidth.value * 100}%` }));
  const movementStyle = useAnimatedStyle(() => ({ width: `${movementWidth.value * 100}%` }));
  const basalColor = theme.accent;
  const movementColor = theme.brandYellow;

  return (
    <View
      style={styles.root}
      accessible
      accessibilityLabel={`Esempio: consumo totale ${formatKcal(totalKcal)} kcal, di cui metabolismo basale ${formatKcal(basalKcal)} (${Math.round(basalShare * 100)}%) e attività e movimento ${formatKcal(movementKcal)} (${Math.round(movementShare * 100)}%).`}>
      <View style={styles.totalRow}>
        <Icon name="flame" size={22} color={theme.accent} />
        <ThemedText style={styles.totalLabel} themeColor="textSecondary">
          Consumo totale
        </ThemedText>
        <CountUpText value={totalKcal} play={play} suffix=" kcal" style={styles.totalValue} />
      </View>

      <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
        <Animated.View style={[styles.segment, { backgroundColor: basalColor }, basalStyle]} />
        <Animated.View style={[styles.segment, { backgroundColor: movementColor }, movementStyle]} />
      </View>

      <Part
        icon="heart"
        color={basalColor}
        title="Metabolismo basale"
        body="Energia per le funzioni vitali a riposo."
        kcal={basalKcal}
        share={basalShare}
        play={play}
        delay={0}
      />
      <Part
        icon="footsteps"
        color={movementColor}
        title="Attività fisica e movimento"
        body={`Allenamenti, camminate e altro movimento. Di cui allenamento: ${formatKcal(trainingKcal)} kcal.`}
        kcal={movementKcal}
        share={movementShare}
        play={play}
        delay={380}
      />
    </View>
  );
}

function Part({
  icon,
  color,
  title,
  body,
  kcal,
  share,
  play,
  delay,
}: {
  icon: IconName;
  color: string;
  title: string;
  body: string;
  kcal: number;
  share: number;
  play: boolean;
  delay: number;
}) {
  return (
    <View style={styles.part}>
      <View style={[styles.swatch, { backgroundColor: color }]}>
        <Icon name={icon} size={14} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.partHead}>
          <ThemedText style={styles.partTitle}>{title}</ThemedText>
          <CountUpText value={kcal} play={play} delay={delay} suffix=" kcal" style={styles.partValue} />
        </View>
        <ThemedText style={styles.partBody} themeColor="textSecondary">
          {body}
        </ThemedText>
        <CountUpText value={share * 100} play={play} delay={delay} format={(n) => `${Math.round(n)}%`} suffix=" del totale" style={[styles.partShare, { color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  track: {
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  segment: {
    height: '100%',
  },
  part: {
    flexDirection: 'row',
    gap: 10,
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  partHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  partTitle: {
    flexShrink: 1,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '700',
  },
  partValue: {
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '800',
  },
  partBody: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
  },
  partShare: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
  },
});
