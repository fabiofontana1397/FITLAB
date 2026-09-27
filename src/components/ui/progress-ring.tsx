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

export type ProgressRingProps = {
  size?: number;
  strokeWidth?: number;
  /** 0..1 for a single lap. Values beyond 1 (goal exceeded) wrap: the ring
   * shows as a complete lap plus a second arc layered on top of it, drawn
   * from the same 12 o'clock start with a soft drop shadow underneath it —
   * the same "starting another lap on itself" read as the Activity rings,
   * instead of just clipping at a full ring. */
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

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={baseProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {showOverlap ? (
          <>
            {/* Soft drop shadow, offset slightly, so the wrapped arc reads as
                sitting above the completed base ring rather than merged flat into it. */}
            <AnimatedCircle
              cx={size / 2 + 1.5}
              cy={size / 2 + 1.5}
              r={radius}
              stroke="rgba(0,0,0,0.28)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              animatedProps={overlapProps}
              transform={`rotate(-90 ${size / 2 + 1.5} ${size / 2 + 1.5})`}
            />
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              animatedProps={overlapProps}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </>
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
