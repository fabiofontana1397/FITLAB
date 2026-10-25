import { Image, type ImageSource } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type QuestionMediaProps = {
  /** The illustration for this question, when the app ships one. Any
   * expo-image source works, animated WebP/GIF included; a failure to load
   * silently falls back to the icon below, so a missing or broken asset can
   * never block the questionnaire. */
  asset?: ImageSource;
  icon?: IconName;
  accessibilityLabel?: string;
};

/**
 * The visual at the top of a question screen.
 *
 * There are no illustration assets in the repo yet, so today every screen
 * renders the animated fallback: the question's icon inside a pair of
 * breathing accent rings. `asset` is the seam real artwork drops into later
 * without touching any screen — and either way the media is decorative,
 * announced as such, and never on the path to answering.
 */
export function QuestionMedia({ asset, icon, accessibilityLabel }: QuestionMediaProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const pulse = useSharedValue(0);
  const pulseLate = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 2400 }), -1, false);
    pulseLate.value = withDelay(800, withRepeat(withTiming(1, { duration: 2400 }), -1, false));
  }, [pulse, pulseLate, reduceMotion]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.45 }],
  }));
  const ringLateStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulseLate.value),
    transform: [{ scale: 1 + pulseLate.value * 0.45 }],
  }));

  if (asset && !failed) {
    return (
      <View style={styles.root}>
        <Image
          source={asset}
          style={styles.asset}
          contentFit="contain"
          transition={200}
          onError={() => setFailed(true)}
          accessibilityLabel={accessibilityLabel}
          accessible={!!accessibilityLabel}
        />
      </View>
    );
  }

  if (!icon) return null;

  return (
    <View style={styles.root} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {!reduceMotion ? (
        <>
          <Animated.View style={[styles.ring, { borderColor: theme.accent }, ringStyle]} />
          <Animated.View style={[styles.ring, { borderColor: theme.accent }, ringLateStyle]} />
        </>
      ) : null}
      <View style={[styles.disc, { backgroundColor: theme.accentSoft }]}>
        <Icon name={icon} size={30} color={theme.accent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: 104, alignItems: 'center', justifyContent: 'center' },
  disc: { width: 72, height: 72, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 72, height: 72, borderRadius: Radius.pill, borderWidth: 1.5 },
  asset: { width: '100%', height: 104 },
});
