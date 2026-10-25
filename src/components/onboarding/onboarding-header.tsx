import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useReducedMotion, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { TimingQuick } from '@/constants/motion';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type OnboardingHeaderProps = {
  /** 0 → 1 along the path actually being walked (see lib/questionnaire/flow.ts). */
  progress: number;
  onBack?: () => void;
  /** "Profilo fisico · 1/8" — which part of the questionnaire this screen belongs to. */
  kicker?: string;
};

/**
 * Back button + progress bar, pinned above every question. The bar animates
 * to its new width rather than jumping, so a conditional question appearing
 * (which lengthens the path and therefore *lowers* the percentage) reads as
 * the path growing instead of as progress being taken away.
 */
export function OnboardingHeader({ progress, onBack, kicker }: OnboardingHeaderProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, progress));
  const animated = useDerivedValue(() => (reduceMotion ? clamped : withTiming(clamped, TimingQuick)), [clamped, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${animated.value * 100}%` }));

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Torna alla domanda precedente"
            style={[styles.backButton, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="arrowBack" size={18} color={theme.text} />
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}
        <View
          style={[styles.track, { backgroundColor: theme.backgroundElement }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}>
          <Animated.View style={[styles.fill, { backgroundColor: theme.accent }, fillStyle]} />
        </View>
      </View>
      {kicker ? (
        <ThemedText type="label" themeColor="textSecondary" style={styles.kicker}>
          {kicker}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  backButton: { width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  kicker: { marginLeft: 36 + Spacing.three },
});
