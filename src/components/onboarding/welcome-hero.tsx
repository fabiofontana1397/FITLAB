import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const PLATE = require('@/assets/images/welcome-plate.webp');

/** The plate photo is laid out in a 900-unit square; every chip below is placed in those units and scaled with the plate. */
const UNITS = 900;
const ITEMS = [
  { name: 'Riso integrale', kcal: 135, icon: require('@/assets/images/food-icons/sheaf-of-rice.webp'), left: 58, top: 38, width: 470 },
  { name: 'Insalata', kcal: 14, icon: require('@/assets/images/food-icons/leafy-green.webp'), left: 640, top: 226, width: 340 },
  { name: 'Petto di pollo', kcal: 248, icon: require('@/assets/images/food-icons/poultry-leg.webp'), left: -140, top: 408, width: 466 },
  { name: 'Avocado', kcal: 160, icon: require('@/assets/images/food-icons/avocado.webp'), left: 540, top: 638, width: 372 },
] as const;
const CHIP_HEIGHT = 138;

/** Choreography (ms): the plate settles, the scanner line sweeps it once, each chip is "detected" as the line passes it. */
const PLATE_IN = 120;
const SCAN_START = 420;
const SCAN_DURATION = 1500;
/** After the entrance: every chip floats on its own slow cycle, and a sheen crosses them one after another. */
const FLOAT_PERIOD = 3600;
const SHEEN_EVERY = 5200;

const SpringChip = { damping: 14, mass: 0.7, stiffness: 170 };
const easeInOut = Easing.inOut(Easing.sin);

/**
 * Welcome-screen hero: a plate of food photographed from above, framed by orange scanner corners.
 * An orange line sweeps the plate like a scan and the four ingredient chips pop out from the plate
 * as it reaches them, their kcal counting up; then they float gently, each on its own rhythm,
 * with a light sheen passing over them now and then. With "Riduci movimento" everything is still.
 *
 * `maxHeight` caps the hero so the welcome screen fits without scrolling on small phones.
 */
export function WelcomeHero({ maxHeight }: { maxHeight?: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const frameRatio = 1.02;
  const size = Math.max(160, Math.min(width * 0.76, 330, maxHeight ? maxHeight / frameRatio : Infinity));
  const f = size / UNITS;
  const frameW = size * 1.128;
  const frameH = size * frameRatio;
  const isLight = theme.tabBarBlur === 'light';
  const chipBg = isLight ? '#FFFFFF' : theme.backgroundSelected;

  const plate = useSharedValue(reduceMotion ? 1 : 0);
  const corners = useSharedValue(reduceMotion ? 1 : 0);
  const scan = useSharedValue(0);
  const scanOpacity = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    plate.value = withDelay(PLATE_IN, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    corners.value = withDelay(PLATE_IN, withSpring(1, { damping: 16, mass: 0.8, stiffness: 160 }));
    scanOpacity.value = withDelay(
      SCAN_START,
      withSequence(withTiming(1, { duration: 180 }), withDelay(SCAN_DURATION - 360, withTiming(0, { duration: 420 })))
    );
    scan.value = withDelay(SCAN_START, withTiming(1, { duration: SCAN_DURATION, easing: Easing.inOut(Easing.cubic) }));
  }, [reduceMotion, plate, corners, scan, scanOpacity]);

  const plateStyle = useAnimatedStyle(() => ({
    opacity: plate.value,
    transform: [{ scale: interpolate(plate.value, [0, 1], [0.94, 1]) }],
  }));

  const scanStyle = useAnimatedStyle(() => ({
    opacity: scanOpacity.value,
    transform: [{ translateY: interpolate(scan.value, [0, 1], [0, frameH]) }],
  }));

  return (
    <View
      style={{ width: '100%', height: frameH, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ position: 'absolute', width: frameW, height: frameH }} pointerEvents="none">
        {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
          <Corner key={corner} corner={corner} progress={corners} color={theme.accent} />
        ))}
      </View>

      <View style={{ width: size, height: size }}>
        <Animated.View style={[StyleSheet.absoluteFill, plateStyle]}>
          <Image source={PLATE} style={{ width: size, height: size }} contentFit="contain" />
        </Animated.View>

        {/* Scanner line: a thin orange beam with a soft glow trailing above it. */}
        {reduceMotion ? null : (
          <Animated.View pointerEvents="none" style={[styles.scan, { width: frameW, left: (size - frameW) / 2, top: -(frameH - size) / 2 - 36 }, scanStyle]}>
            <LinearGradient
              colors={[`${theme.accent}00`, `${theme.accent}30`, `${theme.accent}00`]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ height: 36, opacity: 0.9 }}
            />
            <LinearGradient
              colors={[`${theme.accent}00`, theme.accent, `${theme.accent}00`]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ height: 2 }}
            />
          </Animated.View>
        )}

        {ITEMS.map((item, i) => {
          const centerY = ((frameH - size) / 2 + (item.top + CHIP_HEIGHT / 2) * f) / frameH;
          return (
            <FoodChip
              key={item.name}
              item={item}
              index={i}
              f={f}
              plateSize={size}
              chipBg={chipBg}
              isLight={isLight}
              delay={SCAN_START + Math.max(0, centerY) * SCAN_DURATION - 120}
              reduceMotion={reduceMotion}
            />
          );
        })}
      </View>
    </View>
  );
}

/** A scanner corner: closes in on the plate like a viewfinder locking on. */
function Corner({ corner, progress, color }: { corner: 'tl' | 'tr' | 'bl' | 'br'; progress: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const d = (1 - progress.value) * 14;
    return {
      opacity: progress.value,
      transform: [{ translateX: corner[1] === 'l' ? -d : d }, { translateY: corner[0] === 't' ? -d : d }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.corner,
        { borderColor: color },
        corner[0] === 't' ? { top: 0, borderTopWidth: 2.5 } : { bottom: 0, borderBottomWidth: 2.5 },
        corner[1] === 'l'
          ? { left: 0, borderLeftWidth: 2.5, borderTopLeftRadius: corner === 'tl' ? 16 : 0, borderBottomLeftRadius: corner === 'bl' ? 16 : 0 }
          : { right: 0, borderRightWidth: 2.5, borderTopRightRadius: corner === 'tr' ? 16 : 0, borderBottomRightRadius: corner === 'br' ? 16 : 0 },
        style,
      ]}
    />
  );
}

function FoodChip({
  item,
  index,
  f,
  plateSize,
  chipBg,
  isLight,
  delay,
  reduceMotion,
}: {
  item: (typeof ITEMS)[number];
  index: number;
  f: number;
  plateSize: number;
  chipBg: string;
  isLight: boolean;
  delay: number;
  reduceMotion: boolean;
}) {
  const theme = useTheme();
  const appear = useSharedValue(reduceMotion ? 1 : 0);
  const float = useSharedValue(0);
  const sheen = useSharedValue(0);
  const kcal = useCountUp(item.kcal, reduceMotion ? 0 : delay + 140, reduceMotion ? 0 : 900);

  const width = item.width * f;
  // On small plates the text shrinks with the chip (down to 11 pt), so no name is ever cut.
  const k = Math.max(11 / 13, Math.min(1, (f * UNITS) / 300));
  const height = CHIP_HEIGHT * f;
  // Where the chip pops out from: toward the plate's centre.
  const fromX = (plateSize / 2 - (item.left * f + width / 2)) * 0.35;
  const fromY = (plateSize / 2 - (item.top * f + height / 2)) * 0.35;

  useEffect(() => {
    if (reduceMotion) return;
    appear.value = withDelay(delay, withSpring(1, SpringChip));
    // Float: a slow sine bob, each chip half a beat apart so they never move in unison.
    const floatStart = delay + 900 + index * (FLOAT_PERIOD / 4);
    float.value = withDelay(
      floatStart,
      withRepeat(
        withSequence(withTiming(1, { duration: FLOAT_PERIOD / 2, easing: easeInOut }), withTiming(-1, { duration: FLOAT_PERIOD / 2, easing: easeInOut })),
        -1,
        true
      )
    );
    // Sheen: the chips catch the light one after another, then rest.
    sheen.value = withDelay(
      delay + 1600 + index * 260,
      withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), withDelay(SHEEN_EVERY - 900, withTiming(0, { duration: 0 }))), -1)
    );
    return () => {
      cancelAnimation(float);
      cancelAnimation(sheen);
    };
  }, [reduceMotion, delay, index, appear, float, sheen]);

  const chipStyle = useAnimatedStyle(() => {
    const a = appear.value;
    return {
      opacity: interpolate(a, [0, 0.35], [0, 1], 'clamp'),
      transform: [
        { translateX: (1 - a) * fromX },
        { translateY: (1 - a) * fromY + float.value * 3.5 },
        { scale: interpolate(a, [0, 1], [0.55, 1]) },
        { rotate: `${float.value * (index % 2 ? -0.6 : 0.6)}deg` },
      ],
    };
  });

  // The icon lands a beat after its chip, with its own small overshoot.
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(appear.value, [0, 0.6, 1], [0.2, 0.7, 1], 'clamp') }, { rotate: `${(1 - appear.value) * -40}deg` }],
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: sheen.value > 0 && sheen.value < 1 ? 1 : 0,
    transform: [{ translateX: interpolate(sheen.value, [0, 1], [-width * 0.6, width * 1.1]) }, { skewX: '-18deg' }],
  }));

  const sheenColor = 'rgba(255,255,255,0)';
  const sheenPeak = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.16)';

  return (
    <Animated.View
      style={[
        styles.chip,
        {
          left: item.left * f,
          top: item.top * f,
          width,
          height,
          borderRadius: height / 2,
          backgroundColor: chipBg,
          borderColor: theme.boxEdge,
        },
        chipStyle,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: height / 2, overflow: 'hidden' }]} pointerEvents="none">
        <Animated.View style={[styles.sheen, { width: width * 0.35 }, sheenStyle]}>
          <LinearGradient colors={[sheenColor, sheenPeak, sheenColor]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
      <Animated.View style={iconStyle}>
        <Image source={item.icon} style={{ width: 24 * k, height: 24 * k }} contentFit="contain" />
      </Animated.View>
      <View style={styles.chipText}>
        <ThemedText style={[styles.chipName, { fontSize: 13 * k, lineHeight: 17 * k }]} numberOfLines={1}>
          {item.name}
        </ThemedText>
        <ThemedText style={[styles.chipKcal, styles.tabular, { fontSize: 13 * k, lineHeight: 17 * k }]} themeColor="textSecondary" numberOfLines={1}>
          {kcal} kcal
        </ThemedText>
      </View>
    </Animated.View>
  );
}

/** Counts from 0 to `target` with an ease-out, starting after `delay` ms. Duration 0 shows the value at once. */
function useCountUp(target: number, delay: number, duration: number) {
  const [value, setValue] = useState(duration ? 0 : target);
  useEffect(() => {
    if (!duration) return;
    let frame = 0;
    let start = 0;
    const timer = setTimeout(() => {
      const tick = (t: number) => {
        if (!start) start = t;
        const p = Math.min(1, (t - start) / duration);
        setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, delay, duration]);
  return duration ? value : target;
}

const ARM = 38;
const styles = StyleSheet.create({
  corner: { position: 'absolute', width: ARM, height: ARM },
  scan: { position: 'absolute' },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 9,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: '0px 6px 18px rgba(20,20,25,0.14)',
  },
  sheen: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  chipText: { flex: 1, minWidth: 0 },
  chipName: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
  chipKcal: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  tabular: { fontVariant: ['tabular-nums'] },
});
