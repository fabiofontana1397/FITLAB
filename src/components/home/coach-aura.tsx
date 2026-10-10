import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

type Field = {
  /** [edge, mid, center] of the radial fill. */
  colors: [string, string, string];
  /** Resting center as a fraction of the card (0..1). */
  anchor: { x: number; y: number };
  /** Diameter as a fraction of the card's width. */
  scale: number;
  /** How far it wanders, as a fraction of the card's width. */
  wander: number;
  duration: number;
  direction: 1 | -1;
  phase: number;
  freqRatio: number;
  opacity: number;
};

// The same painterly orange as the chat orb (chat-orb.tsx), stretched over the
// card: big soft fields resting toward the right and bottom (the text sits on
// the left), wandering slowly on Lissajous paths so they keep blending into
// one another without ever repeating the exact same picture.
const FIELDS: Field[] = [
  { colors: ['#7A1E00', '#E8590C', '#FF8A1F'], anchor: { x: 0.95, y: 0.95 }, scale: 0.95, wander: 0.14, duration: 6400, direction: 1, phase: 0, freqRatio: 0.8, opacity: 0.75 },
  { colors: ['#5A1600', '#B33A0A', '#FF7A1A'], anchor: { x: 0.8, y: 0.05 }, scale: 0.7, wander: 0.16, duration: 7800, direction: -1, phase: 2.1, freqRatio: 1.3, opacity: 0.45 },
  { colors: ['#C24E12', '#FF7A1A', '#FFB454'], anchor: { x: 0.45, y: 1.1 }, scale: 0.6, wander: 0.18, duration: 5200, direction: 1, phase: 4.2, freqRatio: 0.65, opacity: 0.4 },
];

const STOPS = [
  { offset: '0%', colorIndex: 2, opacity: 1 },
  { offset: '35%', colorIndex: 1, opacity: 0.75 },
  { offset: '70%', colorIndex: 0, opacity: 0.3 },
  { offset: '100%', colorIndex: 0, opacity: 0 },
];

/**
 * The moving background of Home's AI Coach card: orange light fields drifting
 * under a dark veil, the card-sized cousin of the chat orb. Purely decorative
 * (no touches), sized from the card's own layout.
 */
export function CoachAura({ width, height }: { width: number; height: number }) {
  if (width <= 0 || height <= 0) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {FIELDS.map((field, i) => (
        <AuraField key={i} field={field} index={i} width={width} height={height} />
      ))}
      {/* Keeps the left half (headline and text) dark and readable while the light lives on the right. */}
      <LinearGradient
        colors={['rgba(21,22,26,0.92)', 'rgba(21,22,26,0.55)', 'rgba(21,22,26,0)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

function AuraField({ field, index, width, height }: { field: Field; index: number; width: number; height: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: field.duration, easing: Easing.linear }), -1, false);
  }, [t, field.duration]);

  const size = width * field.scale;
  const radius = width * field.wander;
  const left = width * field.anchor.x - size / 2;
  const top = height * field.anchor.y - size / 2;

  const style = useAnimatedStyle(() => {
    const angle = t.value * Math.PI * 2 * field.direction + field.phase;
    return {
      transform: [{ translateX: Math.cos(angle) * radius }, { translateY: Math.sin(angle * field.freqRatio) * radius * 0.7 }],
    };
  });

  const id = `coachAura${index}`;
  return (
    <Animated.View style={[{ position: 'absolute', left, top, width: size, height: size, opacity: field.opacity }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            {STOPS.map((stop, i) => (
              <Stop key={i} offset={stop.offset} stopColor={field.colors[stop.colorIndex]} stopOpacity={stop.opacity} />
            ))}
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** A small dot that softly pulses — "something new" without blinking. */
export function PulseDot({ color, size = 6 }: { color: string; size?: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false);
  }, [p]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - p.value), transform: [{ scale: 1 + p.value * 1.6 }] }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ring]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}
