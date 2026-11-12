import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { CountUpText } from '@/components/energy-guide/count-up-text';
import { usePlayValue } from '@/components/energy-guide/use-play-value';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { formatKcal } from '@/lib/format-kcal';

/** `#rrggbb` with an alpha, as Home's bars do. */
function alpha(hex: string, a: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex;
  return `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
}

export type EnergyExpenditureChartProps = {
  /** Metabolism, as Home's "Bruciate" bar splits it: resting energy (BMR) plus everyday movement. */
  basalKcal: number;
  /** Activity: the session and any logged exercise. basal + activity = total. */
  movementKcal: number;
  play: boolean;
};

/**
 * Page 2: where the day's expenditure comes from, split and coloured exactly
 * like Home's "Bruciate" bar: green for the day, the lighter part metabolism
 * (resting + everyday movement), the deeper part activity (training and
 * logged exercise). The total is the sum of the two and nothing else.
 */
export function EnergyExpenditureChart({ basalKcal, movementKcal, play }: EnergyExpenditureChartProps) {
  const theme = useTheme();
  const totalKcal = basalKcal + movementKcal;
  const basalShare = totalKcal > 0 ? basalKcal / totalKcal : 0;
  const movementShare = totalKcal > 0 ? movementKcal / totalKcal : 0;
  // Basal first, then movement after it: they arrive separately.
  const basalWidth = usePlayValue(basalShare, play, 0);
  const movementWidth = usePlayValue(movementShare, play, 380);
  const basalStyle = useAnimatedStyle(() => ({ width: `${basalWidth.value * 100}%` }));
  const movementStyle = useAnimatedStyle(() => ({ width: `${movementWidth.value * 100}%` }));
  const basalColor = alpha(theme.brandGreen, 0.42);
  const movementColor = theme.brandGreen;

  return (
    <View
      style={styles.root}
      accessible
      accessibilityLabel={`Esempio: consumo totale ${formatKcal(totalKcal)} kcal, di cui metabolismo ${formatKcal(basalKcal)} (${Math.round(basalShare * 100)}%) e attività ${formatKcal(movementKcal)} (${Math.round(movementShare * 100)}%).`}>
      <View style={styles.totalRow}>
        <Icon name="flameLine" size={22} color={theme.brandGreen} />
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
        title="Metabolismo"
        body="Funzioni vitali a riposo e movimento di tutti i giorni."
        kcal={basalKcal}
        share={basalShare}
        play={play}
        delay={0}
      />
      <Part
        icon="footsteps"
        color={movementColor}
        title="Attività"
        body="Allenamento e attività che registri."
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
    lineHeight: 29,
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
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  partValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  partBody: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  partShare: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
});
