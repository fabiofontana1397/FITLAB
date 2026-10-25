import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { CalorieComparisonChart } from '@/components/energy-guide/calorie-comparison-chart';
import { DemoControls } from '@/components/energy-guide/demo-controls';
import { EnergyBalanceChart } from '@/components/energy-guide/energy-balance-chart';
import { EnergyExpenditureChart } from '@/components/energy-guide/energy-expenditure-chart';
import { FitLabChartDemo } from '@/components/energy-guide/fitlab-chart-demo';
import { ThemedText } from '@/components/themed-text';
import { TimingQuick } from '@/constants/motion';
import { FlatCard } from '@/components/ui/flat-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useTheme } from '@/hooks/use-theme';
import { applyDemoPreset, buildDemoDay, clampDemoValues, DEMO_CONFIG, type DemoDay, type DemoValues } from '@/lib/energy-guide/demo-example';
import { formatKcal } from '@/lib/format-kcal';

type Page = {
  id: string;
  title: string;
  body: (day: DemoDay) => string;
  chart: (day: DemoDay, play: boolean) => React.ReactNode;
};

const PAGES: Page[] = [
  {
    id: 'compare',
    title: 'Calorie assunte e consumate',
    body: () =>
      'Le calorie assunte sono quelle di cibi e bevande che registri. Le calorie consumate sono tutta l’energia che il corpo usa nella giornata. Il grafico di FitLab parte dal confronto tra queste due.',
    chart: (day, play) => <CalorieComparisonChart eatenKcal={day.eatenKcal} burnedKcal={day.burnedKcal} play={play} />,
  },
  {
    id: 'expenditure',
    title: 'Da dove arrivano le calorie consumate?',
    body: () =>
      'Il consumo della giornata ha due parti. Il totale è la loro somma e niente di più: l’allenamento fa già parte del movimento, quindi non viene aggiunto una seconda volta.',
    chart: (day, play) => <EnergyExpenditureChart basalKcal={day.basalKcal} movementKcal={day.movementKcal} trainingKcal={day.trainingKcal} play={play} />,
  },
  {
    id: 'balance',
    title: 'Deficit, equilibrio e surplus',
    body: (day) =>
      `Il bilancio è calorie assunte meno calorie consumate. Se consumi di più sei in deficit, se assumi di più sei in surplus. In questo esempio consideriamo “in equilibrio” uno scarto entro ±${formatKcal(day.toleranceKcal)} kcal: è una convenzione di lettura, non una soglia fisiologica.`,
    chart: (day, play) => (
      <EnergyBalanceChart balanceKcal={day.balanceKcal} halfRangeKcal={day.reading.halfRangeKcal} toleranceKcal={day.toleranceKcal} play={play} />
    ),
  },
  {
    id: 'fitlab',
    title: 'Come leggere il grafico di FitLab',
    body: () =>
      'Ecco il grafico della Home con i numeri dell’esempio. Anello e semicerchio raccontano lo stesso bilancio a due scale: il confronto tra le due quantità e la distanza dal tuo obiettivo.',
    chart: (day, play) => <FitLabChartDemo day={day} play={play} />,
  },
];

export const ENERGY_GUIDE_PAGE_COUNT = PAGES.length;

/**
 * "Come leggere il grafico": four swipeable pages explaining Home's calorie
 * chart on a worked example.
 *
 * The example lives in this component's state only (never in a store), so
 * it starts fresh on every opening; every page derives its numbers from the
 * same buildDemoDay(values), so a change on the controls shows up on all of
 * them at once and swiping back and forth always lands on agreeing charts.
 * A page's animation plays the first time it is shown and is not replayed
 * when swiping back to it.
 */
export function EnergyGuideCarousel({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState<boolean[]>(() => PAGES.map((_, i) => i === 0));
  const [values, setValues] = useState<DemoValues>(DEMO_CONFIG.initial);
  const day = useMemo(() => buildDemoDay(values), [values]);
  const isLast = index === PAGES.length - 1;

  // The pager takes the height of the page on screen, so the controls sit
  // right under a short chart instead of under the tallest page.
  const [heights, setHeights] = useState<number[]>(() => PAGES.map(() => 0));
  const pagerHeight = useSharedValue(0);
  const shownHeight = heights[index];
  useEffect(() => {
    if (shownHeight <= 0) return;
    const first = pagerHeight.get() === 0;
    pagerHeight.set(first || reduceMotion ? shownHeight : withTiming(shownHeight, TimingQuick));
  }, [shownHeight, reduceMotion, pagerHeight]);
  const pagerStyle = useAnimatedStyle(() => (pagerHeight.value > 0 ? { height: pagerHeight.value } : {}));
  const measurePage = (i: number) => (e: LayoutChangeEvent) => {
    const h = Math.ceil(e.nativeEvent.layout.height);
    setHeights((hs) => (hs[i] === h ? hs : hs.map((old, j) => (j === i ? h : old))));
  };

  const show = (next: number) => {
    const clamped = Math.max(0, Math.min(next, PAGES.length - 1));
    setIndex(clamped);
    setVisited((v) => (v[clamped] ? v : v.map((seen, i) => seen || i === clamped)));
  };

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(next, PAGES.length - 1));
    scrollRef.current?.scrollTo({ x: clamped * width, animated: !reduceMotion });
    show(clamped);
  };

  // A page counts as shown once it is more than half on screen.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) show(next);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w === width) return;
    setWidth(w);
    // Keep the current page in place when the width changes (rotation, web resize).
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: index * w, animated: false }));
  };

  return (
    <View style={styles.root}>
      <Animated.View onLayout={onLayout} style={[styles.pager, pagerStyle]}>
        {width > 0 ? (
          <ScrollView
            ref={scrollRef}
            testID="energy-guide-pager"
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={32}
            onScroll={onScroll}
            onMomentumScrollEnd={onScroll}
            contentContainerStyle={styles.pagerContent}>
            {PAGES.map((page, i) => (
              <View
                key={page.id}
                testID={`energy-guide-page-${i}`}
                onLayout={measurePage(i)}
                style={[styles.page, { width }]}
                accessibilityElementsHidden={i !== index}
                importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}>
                <View style={styles.kickerRow}>
                  <ThemedText type="label" themeColor="textSecondary">
                    {i + 1} di {PAGES.length}
                  </ThemedText>
                  <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
                    <ThemedText style={[styles.badgeText, { color: theme.accent }]}>Esempio</ThemedText>
                  </View>
                </View>
                <ThemedText type="title" accessibilityRole="header">
                  {page.title}
                </ThemedText>
                <ThemedText style={styles.body} themeColor="textSecondary">
                  {page.body(day)}
                </ThemedText>
                <FlatCard style={styles.card}>{page.chart(day, visited[i])}</FlatCard>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </Animated.View>

      <View style={styles.dots}>
        {PAGES.map((page, i) => (
          <View key={page.id} style={[styles.dot, i === index ? { backgroundColor: theme.accent, width: 18 } : { backgroundColor: theme.textTertiary, opacity: 0.35, width: 7 }]} />
        ))}
      </View>

      <View style={styles.controls}>
        <DemoControls
          values={values}
          onChange={(v) => setValues(clampDemoValues(v))}
          onPreset={(preset) => setValues((v) => applyDemoPreset(v, preset))}
          onReset={() => setValues(DEMO_CONFIG.initial)}
        />
        <ThemedText style={styles.footnote} themeColor="textTertiary">
          Valori dimostrativi: non sono i tuoi dati e non vengono salvati. Le calorie consumate sono sempre una stima.
        </ThemedText>
      </View>

      <View style={styles.nav}>
        {index > 0 ? <PrimaryButton variant="ghost" label="Indietro" onPress={() => goTo(index - 1)} style={{ flex: 1 }} /> : null}
        <PrimaryButton label={isLast ? 'Ho capito' : 'Avanti'} onPress={isLast ? onDone : () => goTo(index + 1)} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 14,
  },
  pager: {
    overflow: 'hidden',
  },
  pagerContent: {
    alignItems: 'flex-start',
  },
  page: {
    gap: 8,
    paddingHorizontal: 2,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  card: {
    marginTop: 8,
    padding: 18,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  controls: {
    gap: 8,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  nav: {
    flexDirection: 'row',
    gap: 10,
  },
});
