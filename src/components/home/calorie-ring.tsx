import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useRevealedValue } from '@/components/motion/reveal';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type CalorieRingProps = {
  /** 0 = nothing eaten yet, 1 = the day's target reached. Values above 1
   * are kept (see `overColor`) rather than clamped away, so going over the
   * target is something the ring can actually show. */
  progress: number;
  /** The big number at the centre, already formatted. */
  value: string;
  /** Under the number, e.g. "kcal assunte". */
  caption: string;
  /** A third, smaller line under the caption (e.g. the remaining calories). */
  footnote?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  /** Colour the ring switches to once it goes past the target. */
  overColor?: string;
  /** Stagger slot, matched to the card it sits in. */
  delay?: number;
};

/**
 * The Home card's calorie ring: a neutral track with a single arc growing
 * clockwise from 12 o'clock, rounded at both ends, and the day's number at
 * the centre. One arc, one colour, no gradients — the quantity is the only
 * thing it has to say.
 *
 * Past the target the arc completes and recolours instead of overflowing
 * into a second lap, so "over by a lot" can't be mistaken for "barely
 * started" — the figure at the centre carries the real amount.
 */
export function CalorieRing({
  progress,
  value,
  caption,
  footnote,
  size = 168,
  strokeWidth = 14,
  color,
  overColor,
  delay = 120,
}: CalorieRingProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  const safeProgress = Number.isFinite(progress) ? Math.max(progress, 0) : 0;
  const shown = Math.min(safeProgress, 1);
  const isOver = safeProgress > 1.001;
  const arcColor = isOver ? (overColor ?? theme.danger) : (color ?? theme.accent);

  const animated = useRevealedValue(shown, delay);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedProps = useAnimatedProps(() => {
    const fraction = reduceMotion ? shown : animated.value;
    return { strokeDashoffset: circumference * (1 - fraction) };
  });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.backgroundElement}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={arcColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // Start at 12 o'clock rather than 3 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <ThemedText style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </ThemedText>
        <ThemedText style={styles.caption} themeColor="textSecondary" numberOfLines={1}>
          {caption}
        </ThemedText>
        {footnote ? (
          <ThemedText style={styles.footnote} themeColor="textTertiary" numberOfLines={1}>
            {footnote}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  value: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -1,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  footnote: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
    marginTop: 2,
  },
});
