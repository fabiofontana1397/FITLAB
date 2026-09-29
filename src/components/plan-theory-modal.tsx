import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RoadmapStep } from '@/lib/planning/roadmap-content';

const SHEET_MAX_WIDTH = 440;

function withAlpha(hex: string, alpha: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex;
  return `${hex}${Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0')}`;
}

/** One vivid color per phase, cycling if there are ever more than 4 steps
 * — accent (the app's own "hero" color) leads the progression step since
 * that's the phase most worth feeling excited about, with success/warning/
 * calorieSurplus (already theme-safe as text/icon colors, see theme.ts)
 * carrying the rest so each slide reads as visually distinct. */
function stepColors(theme: ReturnType<typeof useTheme>): string[] {
  return [theme.accent, theme.success, theme.calorieSurplus, theme.warning];
}

export type PlanTheoryModalProps = {
  visible: boolean;
  kicker: string;
  title: string;
  subtitle: string;
  steps: RoadmapStep[];
  ctaLabel: string;
  onPressCta: () => void;
  onClose: () => void;
};

/** A popup explaining the "why" behind a generated plan, as a swipeable,
 * color-coded carousel through its phases — reusing the same RoadmapStep
 * content shown once during onboarding, but pushed to feel more like a
 * reward to page through than a spec sheet, since the goal here is to
 * pull the user back toward actually following the plan. Unlike the
 * onboarding pager, the CTA below the carousel is always enabled (not
 * gated to the last slide): this is a quick-reference popup, not a
 * step-by-step flow, so the shortcut to the actual plan works from any
 * slide. */
export function PlanTheoryModal({ visible, kicker, title, subtitle, steps, ctaLabel, onPressCta, onClose }: PlanTheoryModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [pageIndex, setPageIndex] = useState(0);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const colors = stepColors(theme);

  // Driven by plain onScroll (not just onMomentumScrollEnd/onScrollEndDrag)
  // so the dots stay in sync on web, where a trackpad/mouse-wheel swipe
  // through a horizontal ScrollView doesn't reliably fire those two —
  // clamped since RN's elastic overscroll can momentarily push the offset
  // past either end.
  const syncPageFromScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (carouselWidth <= 0) return;
    const raw = Math.round(e.nativeEvent.contentOffset.x / carouselWidth);
    setPageIndex(Math.min(Math.max(raw, 0), steps.length - 1));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <GlassSurface
          level="overlay"
          radius={Radius.xlarge}
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <ThemedText type="label" themeColor="textSecondary">
                {kicker}
              </ThemedText>
              <ThemedText type="subtitle">{title}</ThemedText>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {subtitle}
          </ThemedText>

          <View onLayout={(e) => setCarouselWidth(e.nativeEvent.layout.width)}>
            {carouselWidth > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={syncPageFromScroll}
                scrollEventThrottle={16}
                onMomentumScrollEnd={syncPageFromScroll}
                onScrollEndDrag={syncPageFromScroll}>
                {steps.map((step, i) => (
                  <View key={step.title} style={{ width: carouselWidth }}>
                    <StepSlide step={step} index={i} total={steps.length} color={colors[i % colors.length]} />
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>

          {steps.length > 1 ? (
            <View style={styles.dots}>
              {steps.map((step, i) => {
                const active = i === pageIndex;
                return (
                  <View
                    key={step.title}
                    style={[
                      styles.dot,
                      active && styles.dotActive,
                      { backgroundColor: active ? colors[i % colors.length] : theme.border },
                    ]}
                  />
                );
              })}
            </View>
          ) : null}

          <PrimaryButton label={ctaLabel} onPress={onPressCta} trailingIcon="chevronRight" style={styles.cta} />
        </GlassSurface>
      </View>
    </Modal>
  );
}

function StepSlide({ step, index, total, color }: { step: RoadmapStep; index: number; total: number; color: string }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.08 }],
  }));

  return (
    <View style={styles.slide}>
      <LinearGradient
        colors={[withAlpha(color, 0.18), withAlpha(color, 0.03)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.slideWash}>
        <Animated.View
          style={[styles.slideIcon, { backgroundColor: withAlpha(color, 0.2), borderColor: withAlpha(color, 0.5) }, badgeStyle]}>
          <Icon name={step.icon} size={30} color={color} />
        </Animated.View>

        <View style={[styles.phasePill, { backgroundColor: withAlpha(color, 0.18) }]}>
          <ThemedText type="label" style={{ color }}>
            Fase {index + 1}/{total}
          </ThemedText>
        </View>

        <ThemedText type="caption" themeColor="textSecondary">
          {step.period}
        </ThemedText>
        <ThemedText type="subtitle" style={[styles.slideTitle, { color }]}>
          {step.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.slideDescription}>
          {step.description}
        </ThemedText>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    maxHeight: '85%',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  subtitle: {
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  slide: {
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.two,
  },
  slideWash: {
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 268,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.large,
  },
  slideIcon: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  phasePill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    marginBottom: 2,
  },
  slideTitle: {
    textAlign: 'center',
  },
  slideDescription: {
    textAlign: 'center',
    marginTop: 2,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 20,
  },
  cta: {
    width: '100%',
  },
});
