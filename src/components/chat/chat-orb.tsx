import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { loopTiming, TimingQuick } from '@/constants/motion';
import { Brand, Palette } from '@/constants/theme';

type Blob = {
  colors: readonly [string, string, string];
  /** Resting position as a fraction of the sphere's size, e.g. -0.15 is
   * 15% of the sphere left of center. Each color occupies its own region
   * of the sphere (like the reference photo) rather than every blob
   * piling up near the center, which is what made three overlapping
   * fields still read as one flat shaded ball. */
  baseOffset: { x: number; y: number };
  orbitDuration: number;
  direction: 1 | -1;
  phase: number;
  /** How much faster the vertical wander is than the horizontal one — a
   * Lissajous curve rather than a plain circle, so the path never quite
   * repeats the same way twice. */
  freqRatio: number;
};

// Three large color fields in their own regions of the sphere (not five
// small pulsing petals) — a vivid, saturated orange throughout rather than
// the muted cream/maroon/gold of the reference photo, per request, while
// keeping the same three-region composition and soft radial falloff. Each
// is far bigger than the sphere itself (see blobSize) so its own outer rim
// always falls outside the visible circle — you only ever see the
// gradual-falloff interior of each field, never a closed edge.
const BLOBS: Blob[] = [
  { colors: Brand.orbWarm, baseOffset: { x: -0.16, y: -0.22 }, orbitDuration: 4200, direction: 1, phase: 0, freqRatio: 0.8 },
  { colors: Brand.orbDeep, baseOffset: { x: 0.2, y: -0.26 }, orbitDuration: 5200, direction: -1, phase: 2.1, freqRatio: 1.2 },
  { colors: Brand.orbBright, baseOffset: { x: 0.24, y: 0.12 }, orbitDuration: 3600, direction: 1, phase: 4.2, freqRatio: 0.65 },
];

// Gradient stops shared by every blob's radial fill — brightest at the
// center easing down through the mid tone to fully transparent, spread
// across the WHOLE radius rather than staying solid until the last
// stretch, so it reads as a soft light falling off rather than a disc
// with a fuzzy edge. colorIndex picks which of the blob's 3 colors
// [edge, mid, center] each stop uses.
const GRADIENT_STOPS = [
  { offset: '0%', colorIndex: 2, opacity: 1 },
  { offset: '35%', colorIndex: 1, opacity: 0.8 },
  { offset: '65%', colorIndex: 0, opacity: 0.45 },
  { offset: '100%', colorIndex: 0, opacity: 0 },
];

// How far (px) the whole blob group drifts toward the phone's tilt — a
// liquid-in-a-ball feel, on top of (not instead of) each blob's own slow
// wander. Silently stays at rest wherever the accelerometer isn't
// available (web without permission, desktop, etc).
const TILT_RANGE = 10;

/** A small "living" AI entity standing in for a literal chat-bubble icon:
 * a vivid orange painterly glass sphere where three oversized color fields
 * wander around their own resting spot, drifting toward whichever way the
 * phone is tilted — colors continuously blending into one another with no
 * perceivable border between them, rather than looking like separate
 * spheres sliding around. */
export function ChatOrb({ size }: { size: number }) {
  const { tiltX, tiltY } = useTiltShift();

  const tiltStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tiltX.value }, { translateY: tiltY.value }],
  }));

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: Palette.orange[500] }}>
      <Animated.View style={[styles.layer, tiltStyle]}>
        {BLOBS.map((blob, i) => (
          <BlobLayer key={i} blob={blob} size={size} index={i} />
        ))}
      </Animated.View>
      <Vignette size={size} />
    </View>
  );
}

/** A static, subtle darkening toward the rim — grounds the sphere's edge
 * the way the reference photo's does, without a bright highlight ring.
 * Never animated, so (unlike the BlurView removed earlier) there's no
 * live backdrop sample that could go stale. */
function Vignette({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="chatOrbVignette" cx="50%" cy="50%" r="50%">
          <Stop offset="70%" stopColor={Palette.neutral[950]} stopOpacity={0} />
          <Stop offset="100%" stopColor={Palette.neutral[950]} stopOpacity={0.22} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#chatOrbVignette)" />
    </Svg>
  );
}

/** Reads the accelerometer's gravity vector (x/y, in g) and eases two
 * shared values toward it scaled to a small pixel range — the offset the
 * whole blob group drifts by. Subscribes only while mounted; if the
 * sensor never reports (unsupported platform, permission refused), the
 * values simply stay at 0 and the orb reads exactly as it would without
 * this feature. */
function useTiltShift() {
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  // The tilt is driven by the accelerometer, not by an animation, so
  // Reanimated's own Reduce Motion handling never sees it: without this
  // check the orb would keep swaying under the thumb for someone who has
  // asked the system for less movement.
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      tiltX.value = 0;
      tiltY.value = 0;
      return;
    }
    let cancelled = false;
    Accelerometer.isAvailableAsync()
      .then((isAvailable) => {
        if (cancelled || !isAvailable) return;
        Accelerometer.setUpdateInterval(100);
        subscriptionRef.current = Accelerometer.addListener(({ x, y }) => {
          tiltX.value = withTiming(Math.max(-1, Math.min(1, x)) * TILT_RANGE, TimingQuick);
          tiltY.value = withTiming(Math.max(-1, Math.min(1, y)) * -TILT_RANGE, TimingQuick);
        });
      })
      .catch(() => {
        // No accelerometer access (web without permission, unsupported
        // device) — the orb just keeps its base motion, no tilt drift.
      });

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  return { tiltX, tiltY };
}

function BlobLayer({ blob, size, index }: { blob: Blob; size: number; index: number }) {
  const orbit = useSharedValue(0);

  useEffect(() => {
    orbit.value = withRepeat(withTiming(1, loopTiming(blob.orbitDuration)), -1, false);
  }, [orbit, blob.orbitDuration]);

  // A wiggle around its resting spot big enough to actually be seen
  // moving (the earlier 0.06 was too subtle to read as motion at all) —
  // no breathing/pulsing though, since brightening and moving at once is
  // exactly what read as "blinking white dots" before, and a much bigger
  // orbit would drag each color out of its own region entirely.
  const wiggleRadius = size * 0.16;
  const baseX = size * blob.baseOffset.x;
  const baseY = size * blob.baseOffset.y;

  const style = useAnimatedStyle(() => {
    const angle = orbit.value * Math.PI * 2 * blob.direction + blob.phase;
    const x = baseX + Math.cos(angle) * wiggleRadius;
    const y = baseY + Math.sin(angle * blob.freqRatio) * wiggleRadius;
    return { transform: [{ translateX: x }, { translateY: y }] };
  });

  // Bigger than the sphere (see BLOBS comment) so its rim is always
  // off-screen — only the gradual falloff of its interior is ever visible
  // — but not so much bigger that the container only ever samples the
  // washed-out tail of the gradient (that read as an almost flat color).
  const blobSize = size * 1.5;
  const gradientId = `chatOrbBlob${index}`;

  return (
    <Animated.View style={[styles.layer, style]}>
      <Svg width={blobSize} height={blobSize} style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            {GRADIENT_STOPS.map((stop, i) => (
              <Stop key={i} offset={stop.offset} stopColor={blob.colors[stop.colorIndex]} stopOpacity={stop.opacity} />
            ))}
          </RadialGradient>
        </Defs>
        <Circle cx={blobSize / 2} cy={blobSize / 2} r={blobSize / 2} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
