import { useState } from 'react';
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

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RoadmapStep } from '@/lib/planning/roadmap-content';

const SHEET_MAX_WIDTH = 440;

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

/** A popup explaining the "why" behind a generated plan, as a swipeable
 * carousel through its phases — reusing the same RoadmapStep content shown
 * once during onboarding. Unlike the onboarding pager, the CTA below the
 * carousel is always enabled (not gated to the last slide): this is a
 * quick-reference popup, not a step-by-step flow, so the shortcut to the
 * actual plan should work from any slide. */
export function PlanTheoryModal({ visible, kicker, title, subtitle, steps, ctaLabel, onPressCta, onClose }: PlanTheoryModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [pageIndex, setPageIndex] = useState(0);
  const [carouselWidth, setCarouselWidth] = useState(0);

  const syncPageFromScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (carouselWidth <= 0) return;
    setPageIndex(Math.round(e.nativeEvent.contentOffset.x / carouselWidth));
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
                onMomentumScrollEnd={syncPageFromScroll}
                onScrollEndDrag={syncPageFromScroll}>
                {steps.map((step) => (
                  <View key={step.title} style={{ width: carouselWidth }}>
                    <StepSlide step={step} />
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>

          {steps.length > 1 ? (
            <View style={styles.dots}>
              {steps.map((step, i) => (
                <View
                  key={step.title}
                  style={[styles.dot, { backgroundColor: i === pageIndex ? theme.accent : theme.border }]}
                />
              ))}
            </View>
          ) : null}

          <PrimaryButton label={ctaLabel} onPress={onPressCta} trailingIcon="chevronRight" style={styles.cta} />
        </GlassSurface>
      </View>
    </Modal>
  );
}

function StepSlide({ step }: { step: RoadmapStep }) {
  const theme = useTheme();
  return (
    <View style={styles.slide}>
      <View style={[styles.slideIcon, { backgroundColor: theme.accentSoft }]}>
        <Icon name={step.icon} size={26} color={theme.accent} />
      </View>
      <ThemedText type="caption" themeColor="textSecondary">
        {step.period}
      </ThemedText>
      <ThemedText type="subtitle" style={{ textAlign: 'center' }}>
        {step.title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {step.description}
      </ThemedText>
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
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.two,
  },
  slideIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Spacing.four,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cta: {
    width: '100%',
  },
});
