import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TimingQuick } from '@/constants/motion';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const LIGHT_WASH_TOP = '#F2F2F1';

export type OnboardingShellProps = {
  /** Changes whenever a different screen is shown: what triggers the transition. */
  screenKey: string;
  /** 1 going forward, -1 going back — the new screen slides in from that side. */
  direction: 1 | -1;
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
};

/**
 * The frame every onboarding question lives in: progress header pinned to the
 * top, the question scrolling in the middle, the Continua button pinned above
 * the home indicator.
 *
 * Safe areas are honoured on both edges (Dynamic Island at the top, home
 * indicator at the bottom), the footer rides above the keyboard on the text
 * questions, and the content column is capped so the flow doesn't stretch
 * into an unreadable line length on a tablet or in the browser.
 */
export function OnboardingShell({ screenKey, direction, header, footer, children }: OnboardingShellProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const enter = useSharedValue(1);
  const isLight = theme.tabBarBlur === 'light';

  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = 0;
    enter.value = withTiming(1, { ...TimingQuick, duration: 240 });
  }, [screenKey, enter, reduceMotion]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * 26 * direction }],
  }));

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {isLight ? (
        <LinearGradient
          colors={[LIGHT_WASH_TOP, theme.background, '#DEDEDD']}
          locations={[0, 0.45, 1]}
          style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
        />
      ) : null}
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <View style={[styles.column, { paddingTop: insets.top + Spacing.two }]}>{header}</View>

        <Animated.View style={[styles.flex, contentStyle]}>
          <ScrollView
            key={screenKey}
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.column}>{children}</View>
          </ScrollView>
        </Animated.View>

        <View style={[styles.column, styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>{footer}</View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.four },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: Spacing.four },
  footer: { paddingTop: Spacing.three, gap: Spacing.two },
});
