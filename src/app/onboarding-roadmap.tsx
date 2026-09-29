import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { FadeInView } from '@/components/ui/fade-in-view';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  DIET_STEPS,
  TRAINING_STEPS_BEGINNER,
  TRAINING_STEPS_EXPERIENCED,
  goalCategory,
  isExperiencedLifter,
  type RoadmapStep,
} from '@/lib/planning/roadmap-content';
import type { OnboardingMode } from '@/lib/questionnaire/schema';
import { useAppStore } from '@/store/app-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';

const GENERATING_MESSAGES = [
  'Stiamo creando il tuo piano personalizzato…',
  'Analizziamo i tuoi obiettivi e le tue abitudini…',
  'Costruiamo la struttura mese per mese…',
  'Quasi pronto…',
];

type RoadmapPage = { id: string; kicker: string; title: string; subtitle: string; steps: RoadmapStep[] };

function buildPages(mode: OnboardingMode, goal?: string, gymSkillLevel?: string): RoadmapPage[] {
  const pages: RoadmapPage[] = [];
  if (mode !== 'training') {
    pages.push({
      id: 'diet',
      kicker: 'Piano alimentare',
      title: 'Come evolve la tua dieta',
      subtitle: 'Un percorso a fasi, non una dieta fissa: si adatta a te mese dopo mese.',
      steps: DIET_STEPS[goalCategory(goal)],
    });
  }
  if (mode !== 'diet') {
    const experienced = isExperiencedLifter(gymSkillLevel);
    pages.push({
      id: 'training',
      kicker: 'Allenamento',
      title: 'Come evolve il tuo allenamento',
      subtitle: experienced
        ? 'Un piano già al tuo livello, non una scaletta da principiante: progressione costante con aggiornamenti mensili.'
        : 'Progressione costante, con recupero programmato e aggiornamenti mensili.',
      steps: experienced ? TRAINING_STEPS_EXPERIENCED : TRAINING_STEPS_BEGINNER,
    });
  }
  pages.push({
    id: 'ready',
    kicker: 'Tutto pronto',
    title: 'Si comincia!',
    subtitle: 'Il tuo piano ti aspetta nella dashboard. Si aggiornerà con te, mese dopo mese.',
    steps: [],
  });
  return pages;
}

export default function OnboardingRoadmapScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const answers = useOnboardingStore((s) => s.answers);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const isGenerating = usePlanStore((s) => s.isGenerating);

  const mode = (answers.mode as OnboardingMode) ?? 'both';
  const pages = useMemo(
    () => buildPages(mode, answers.goal as string | undefined, answers.gymSkillLevel as string | undefined),
    [mode, answers.goal, answers.gymSkillLevel]
  );
  const isLastPage = pageIndex === pages.length - 1;

  const goToPage = (index: number) => {
    const clamped = Math.max(0, Math.min(index, pages.length - 1));
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
    setPageIndex(clamped);
  };

  const syncPageFromScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPageIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  // generatePlans is fire-and-forget from onboarding.tsx (a real AI call,
  // 1-2 minutes) — tapping through here often outpaces it. Rather than
  // drop the user into a Home/Training tab that looks broken ("nessun
  // piano generato") for a minute, show that it's still working and only
  // navigate once isGenerating actually flips false. If it's already done
  // by the time they get here, this resolves on the very next render.
  useEffect(() => {
    if (isFinishing && !isGenerating) {
      completeOnboarding();
      router.replace('/');
    }
  }, [isFinishing, isGenerating, completeOnboarding]);

  const finish = () => {
    setIsFinishing(true);
  };

  if (isFinishing) {
    return <GeneratingPlanView />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={syncPageFromScroll}
        onScrollEndDrag={syncPageFromScroll}
        style={{ flex: 1 }}>
        {pages.map((page) => (
          <View key={page.id} style={{ width, height: '100%' }}>
            <ScrollView contentContainerStyle={styles.pageInner} showsVerticalScrollIndicator={false}>
              <View style={{ gap: Spacing.one }}>
                <ThemedText type="label" themeColor="textSecondary">
                  {page.kicker}
                </ThemedText>
                <ThemedText type="display">{page.title}</ThemedText>
                <ThemedText type="default" themeColor="textSecondary">
                  {page.subtitle}
                </ThemedText>
              </View>

              {page.steps.length > 0 ? (
                <View>
                  {page.steps.map((step, i) => (
                    <FadeInView key={step.title} delay={i * 90}>
                      <TimelineRow step={step} isLast={i === page.steps.length - 1} />
                    </FadeInView>
                  ))}
                </View>
              ) : (
                <FadeInView delay={120} style={{ alignItems: 'center', paddingTop: Spacing.six }}>
                  <View style={[styles.readyBadge, { backgroundColor: theme.accentSoft }]}>
                    <Icon name="sparkle" size={32} color={theme.accent} />
                  </View>
                </FadeInView>
              )}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.four }]}>
        <View style={styles.dots}>
          {pages.map((page, i) => (
            <View
              key={page.id}
              style={[styles.dot, { backgroundColor: i === pageIndex ? theme.accent : theme.backgroundElement }]}
            />
          ))}
        </View>
        <View style={styles.navRow}>
          {pageIndex > 0 ? (
            <PrimaryButton
              variant="ghost"
              label="Indietro"
              onPress={() => goToPage(pageIndex - 1)}
              style={{ flex: 1 }}
            />
          ) : null}
          <PrimaryButton
            label={isLastPage ? 'Vai alla dashboard' : 'Continua'}
            onPress={isLastPage ? finish : () => goToPage(pageIndex + 1)}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </View>
  );
}

/** Shown between "Vai alla dashboard" and actually landing on Home while
 * generatePlans (a real AI call — web search + RAG, 1-2 minutes) is still
 * running — see the isFinishing effect above. Cycles through a few
 * status lines so a full-minute wait doesn't look stalled. */
function GeneratingPlanView() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pulse = useSharedValue(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
  }, [pulse]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, GENERATING_MESSAGES.length - 1));
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.12 }],
    opacity: 0.7 + pulse.value * 0.3,
  }));

  return (
    <View
      style={[
        styles.container,
        styles.generatingContainer,
        { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
      <Animated.View style={[styles.readyBadge, { backgroundColor: theme.accentSoft }, badgeStyle]}>
        <Icon name="sparkle" size={32} color={theme.accent} />
      </Animated.View>
      <View style={{ gap: Spacing.two, alignItems: 'center' }}>
        <ThemedText type="display" style={{ textAlign: 'center' }}>
          Un attimo…
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={{ textAlign: 'center', maxWidth: 320 }}>
          {GENERATING_MESSAGES[messageIndex]}
        </ThemedText>
      </View>
    </View>
  );
}

function TimelineRow({ step, isLast }: { step: RoadmapStep; isLast: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineIcon, { backgroundColor: theme.accentSoft }]}>
          <Icon name={step.icon} size={18} color={theme.accent} />
        </View>
        {!isLast ? <View style={[styles.timelineLine, { backgroundColor: theme.border }]} /> : null}
      </View>
      <View style={styles.timelineBody}>
        <ThemedText type="caption" themeColor="textSecondary">
          {step.period}
        </ThemedText>
        <ThemedText type="smallBold">{step.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {step.description}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  generatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  pageInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    // Room to scroll past the last timeline row instead of it landing
    // flush against (or under) the fixed dots/nav footer below the pager.
    paddingBottom: Spacing.six,
    gap: Spacing.five,
  },
  readyBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  timelineRail: {
    alignItems: 'center',
    width: 40,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginVertical: 4,
  },
  timelineBody: {
    flex: 1,
    paddingBottom: Spacing.four,
    gap: 2,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  navRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
});
