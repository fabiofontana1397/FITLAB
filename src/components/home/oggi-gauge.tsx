import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { OnBrand, Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Angles are clockwise from 12 o'clock. The Figma gauge leaves a wide open
// gap at the bottom and a narrow one where orange meets green; these are
// the *path* gaps (the round caps close the visible gap a bit further).
// The middle gap is where both arrow knobs sit, facing each other, so it is
// wide enough to leave a sliver of track between them.
const BOTTOM_GAP_DEG = 84;
const MID_GAP_DEG = 18;
const MIN_SWEEP_DEG = 10;
const ARC_START_DEG = 180 + BOTTOM_GAP_DEG / 2;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, startDeg + sweepDeg);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/**
 * The white knob with a chevron that rides the leading tip of an arc and
 * points the way that arc grows, like the tip of an Activity ring.
 * `clockwise` is the direction of travel along the ring.
 */
function ArrowKnob({ cx, cy, r, deg, clockwise, radius, color }: {
  cx: number;
  cy: number;
  r: number;
  deg: number;
  clockwise: boolean;
  radius: number;
  color: string;
}) {
  const { x, y } = polar(cx, cy, r, deg);
  // For a point at `deg` clockwise from 12 o'clock, the clockwise tangent
  // points at `deg` degrees from the +x axis in SVG's y-down space; the
  // chevron below is drawn pointing along +x and rotated onto it.
  const heading = clockwise ? deg : deg + 180;
  const a = radius * 0.24;
  const b = radius * 0.42;
  return (
    <G transform={`translate(${x} ${y})`}>
      {/* Soft drop shadow, nudged down like light from above. */}
      <Circle r={radius + 0.5} cy={0.9} fill={Palette.neutral[950]} opacity={0.18} />
      <Circle r={radius} fill={OnBrand.text} />
      <Path
        d={`M ${-a} ${-b} L ${a} 0 L ${-a} ${b}`}
        transform={`rotate(${heading})`}
        stroke={color}
        strokeWidth={radius * 0.26}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </G>
  );
}

export type OggiGaugeProps = {
  size?: number;
  strokeWidth?: number;
  burnedKcal: number;
  eatenKcal: number;
  burnedColor: string;
  eatenColor: string;
  value: string;
  caption: string;
};

/** Two-tone gauge: the orange arc is calories burned, the green arc calories
 * eaten, each sized by its share of the two together — so the ring itself
 * shows at a glance which side of the balance the day is on, while the
 * centre spells out the exact surplus/deficit.
 *
 * Burned grows clockwise from the left end, eaten counter-clockwise from the
 * right end; each carries an arrow knob on its growing tip, so the two
 * knobs meet in the middle gap pushing against each other. */
export function OggiGauge({ size = 176, strokeWidth = 15, burnedKcal, eatenKcal, burnedColor, eatenColor, value, caption }: OggiGaugeProps) {
  const theme = useTheme();
  const total = burnedKcal + eatenKcal;
  const available = 360 - BOTTOM_GAP_DEG - MID_GAP_DEG;
  const burnedShare = total > 0 ? burnedKcal / total : 0.5;
  const burnedSweep = Math.min(Math.max(available * burnedShare, MIN_SWEEP_DEG), available - MIN_SWEEP_DEG);
  const eatenSweep = available - burnedSweep;

  const c = size / 2;
  const r = (size - strokeWidth) / 2;
  const burnedStart = ARC_START_DEG;
  const eatenStart = burnedStart + burnedSweep + MID_GAP_DEG;
  const empty = total <= 0;
  // As wide as the stroke itself, so the knob reads as the arc's rounded tip.
  const knobRadius = strokeWidth / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', marginBottom: -size * 0.14 }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Path
          d={arcPath(c, c, r, burnedStart, burnedSweep)}
          stroke={empty ? theme.backgroundElement : burnedColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={arcPath(c, c, r, eatenStart, eatenSweep)}
          stroke={empty ? theme.backgroundElement : eatenColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
        {/* No direction to show on an empty day. */}
        {empty ? null : (
          <>
            <ArrowKnob cx={c} cy={c} r={r} deg={burnedStart + burnedSweep} clockwise radius={knobRadius} color={burnedColor} />
            <ArrowKnob cx={c} cy={c} r={r} deg={eatenStart} clockwise={false} radius={knobRadius} color={eatenColor} />
          </>
        )}
      </Svg>
      <ThemedText style={styles.value}>{value}</ThemedText>
      <ThemedText style={styles.unit}>kcal</ThemedText>
      <ThemedText style={styles.caption} themeColor="textTertiary">
        {caption}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  value: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  caption: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
  },
});
