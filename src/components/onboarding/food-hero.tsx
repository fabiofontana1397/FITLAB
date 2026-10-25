import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const BOWL = require('@/assets/images/food-icons/bowl-with-spoon.png');

/** Real catalog pictures (the same ones the meal tracker uses) around a bowl. The
 * names are plain labels: no calories or macros are shown, because here they
 * would be made-up numbers presented as data. */
const ITEMS = [
  { label: 'Riso', source: require('@/assets/images/food-icons/cooked-rice.png'), x: -92, y: -78 },
  { label: 'Pollo', source: require('@/assets/images/food-icons/poultry-leg.png'), x: 88, y: -64 },
  { label: 'Insalata', source: require('@/assets/images/food-icons/green-salad.png'), x: -96, y: 62 },
  { label: 'Broccoli', source: require('@/assets/images/food-icons/broccoli.png'), x: 94, y: 78 },
] as const;

export type FoodHeroProps = { size?: number };

/**
 * Welcome-screen illustration: a bowl on a soft disc with four foods floating
 * gently around it. Built from assets already in the app, so there is nothing
 * to download and nothing that can fail to load; the float stops entirely
 * under "reduce motion".
 */
export function FoodHero({ size = 280 }: FoodHeroProps) {
  const theme = useTheme();
  const scale = size / 280;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.disc, { width: size * 0.78, height: size * 0.78, backgroundColor: theme.accentSoft }]} />
      <View style={[styles.ring, { width: size * 0.92, height: size * 0.92, borderColor: theme.accent }]} />
      <Image source={BOWL} style={{ width: 112 * scale, height: 112 * scale }} contentFit="contain" />
      {ITEMS.map((item, index) => (
        <FloatingItem key={item.label} index={index} scale={scale} {...item} />
      ))}
    </View>
  );
}

function FloatingItem({ label, source, x, y, index, scale }: { label: string; source: number; x: number; y: number; index: number; scale: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  const float = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    enter.value = withDelay(250 + index * 120, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    float.value = withDelay(
      900 + index * 200,
      withRepeat(withSequence(withTiming(1, { duration: 2200 }), withTiming(0, { duration: 2200 })), -1, false)
    );
  }, [enter, float, index, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 16 - float.value * 6 }, { scale: 0.85 + enter.value * 0.15 }],
  }));

  return (
    <Animated.View style={[styles.item, { left: '50%', top: '50%', marginLeft: x * scale - 38, marginTop: y * scale - 28 }, style]}>
      <View style={[styles.chip, { backgroundColor: theme.tabBarBlur === 'light' ? '#FFFFFF' : theme.backgroundSelected, borderColor: theme.border }]}>
        <Image source={source} style={{ width: 28, height: 28 }} contentFit="contain" />
        <ThemedText type="caption" style={{ fontWeight: '700' }}>
          {label}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  disc: { position: 'absolute', borderRadius: Radius.pill },
  ring: { position: 'absolute', borderRadius: Radius.pill, borderWidth: 1.5, opacity: 0.25 },
  item: { position: 'absolute', width: 76 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignSelf: 'center',
  },
});
