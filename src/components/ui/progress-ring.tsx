import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { TimingSlow } from '@/constants/motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Darkens a "#rrggbb" color by `amount` (0..1) — used to shade the
 * completed-lap base ring once a second lap overlaps it. Returns the
 * input unchanged for any other format (e.g. an rgba() string) rather
 * than risk producing a wrong color. */
function darken(hex: string, amount: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const num = parseInt(match[1], 16);
  const channel = (shift: number) => Math.round(((num >> shift) & 0xff) * (1 - amount));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(channel(16))}${toHex(channel(8))}${toHex(channel(0))}`;
}

export type ProgressRingProps = {
  size?: number;
  strokeWidth?: number;
  /** 0..1 for a single lap. Values beyond 1 (goal exceeded) wrap: the base
   * ring shades to a darker tone of `color` (a completed lap) and a second
   * arc in the full-brightness `color` is drawn on top of it from the same
   * 12 o'clock start — the same "starting another lap on itself" read as
   * the Activity rings. */
  progress: number;
  color: string;
  trackColor: string;
  children?: React.ReactNode;
};

export function ProgressRing({
  size = 96,
  strokeWidth = 10,
  progress,
  color,
  trackColor,
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;
  const base = useSharedValue(0);
  const overlap = useSharedValue(0);

  useEffect(() => {
    const safeProgress = Math.max(progress, 0);
    base.value = withTiming(Math.min(safeProgress, 1), TimingSlow);
    overlap.value = withTiming(safeProgress > 1 ? safeProgress % 1 : 0, TimingSlow);
  }, [progress, base, overlap]);

  const baseProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - base.value),
  }));
  const overlapProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - overlap.value),
  }));

  const showOverlap = progress > 1;
  const baseColor = showOverlap ? darken(color, 0.35) : color;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={baseColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={baseProps}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        {showOverlap ? (
          <AnimatedCircle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={overlapProps}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ) : null}
      </Svg>
      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
