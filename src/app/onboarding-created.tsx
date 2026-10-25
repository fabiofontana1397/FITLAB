import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { FadeInView } from '@/components/ui/fade-in-view';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SpringSnappy } from '@/constants/motion';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { OnboardingMode } from '@/lib/questionnaire/schema';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useUserStore } from '@/store/user-store';

const BURST_ANGLES = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);

export default function OnboardingCreatedScreen() {
  const mode = (useOnboardingStore((s) => s.answers.mode) as OnboardingMode | undefined) ?? 'both';
  const calories = useUserStore((s) => s.dailyCalorieTarget);
  const macros = useUserStore((s) => s.macroTargetsG);
  // The numbers the profile was actually saved with (confirmProfile ran the
  // same engine the plans use). Hidden for a training-only profile and until
  // there is a real value — never a placeholder.
  const showTargets = mode !== 'training' && calories > 0;

  return (
    <ScreenScroll contentContainerStyle={{ flex: 1, justifyContent: 'space-between' }}>
      <View />
      <View style={{ alignItems: 'center', gap: Spacing.five }}>
        <CelebrationBadge />
        <FadeInView delay={500} style={{ alignItems: 'center', gap: Spacing.two }}>
          <ThemedText type="display" style={{ textAlign: 'center' }}>
            Profilo creato!
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 320 }}>
            Abbiamo calcolato il tuo punto di partenza. Ora ti mostriamo come funzionerà il tuo piano.
          </ThemedText>
        </FadeInView>
        {showTargets ? (
          <FadeInView delay={620} style={{ width: '100%', maxWidth: 360 }}>
            <StartingPoint calories={calories} protein={macros.protein} carbs={macros.carbs} fats={macros.fats} />
          </FadeInView>
        ) : null}
      </View>
      <FadeInView delay={750}>
        <PrimaryButton label="Continua" onPress={() => router.push('/onboarding-roadmap')} />
      </FadeInView>
    </ScreenScroll>
  );
}

function StartingPoint({ calories, protein, carbs, fats }: { calories: number; protein: number; carbs: number; fats: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText type="label" themeColor="textSecondary">
        Il tuo punto di partenza
      </ThemedText>
      <View style={styles.kcalRow}>
        <ThemedText style={styles.kcal}>{Math.round(calories).toLocaleString('it-IT')}</ThemedText>
        <ThemedText type="subtitle" themeColor="textSecondary">
          kcal al giorno
        </ThemedText>
      </View>
      <View style={styles.macros}>
        <Macro label="Proteine" grams={protein} />
        <Macro label="Carboidrati" grams={carbs} />
        <Macro label="Grassi" grams={fats} />
      </View>
    </View>
  );
}

function Macro({ label, grams }: { label: string; grams: number }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <ThemedText type="smallBold">{Math.round(grams)} g</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function CelebrationBadge() {
  const theme = useTheme();
  const circleScale = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.6);

  useEffect(() => {
    circleScale.value = withSpring(1, SpringSnappy);
    checkScale.value = withDelay(220, withSpring(1, SpringSnappy));
    ringScale.value = withDelay(300, withRepeat(withTiming(1.5, { duration: 1400 }), -1, false));
    ringOpacity.value = withDelay(300, withRepeat(withTiming(0, { duration: 1400 }), -1, false));
  }, [circleScale, checkScale, ringScale, ringOpacity]);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: circleScale.value }] }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  return (
    <View style={styles.badgeWrap}>
      <Animated.View style={[styles.ring, { borderColor: theme.accent }, ringStyle]} />
      <Animated.View style={[styles.circle, { backgroundColor: theme.accent }, circleStyle]}>
        <Animated.View style={checkStyle}>
          <Icon name="check" size={48} color={theme.onAccent} />
        </Animated.View>
      </Animated.View>
      {BURST_ANGLES.map((angle, i) => (
        <BurstDot key={i} angle={angle} delay={260 + i * 40} color={theme.accent} />
      ))}
    </View>
  );
}

function BurstDot({ angle, delay, color }: { angle: number; delay: number; color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 700 }));
  }, [delay, progress]);

  const distance = 74;
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: 1 - p,
      transform: [
        { translateX: Math.cos(angle) * distance * p },
        { translateY: Math.sin(angle) * distance * p },
        { scale: 1 - p * 0.4 },
      ],
    };
  });

  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.large, padding: Spacing.four, gap: Spacing.two, alignItems: 'center' },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  kcal: { fontSize: 40, lineHeight: 46, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  macros: { flexDirection: 'row', alignSelf: 'stretch', marginTop: Spacing.one },
  badgeWrap: {
    width: 190,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
  },
  circle: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
