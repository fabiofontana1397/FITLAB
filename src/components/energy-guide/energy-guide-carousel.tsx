import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { CalorieComparisonChart } from '@/components/energy-guide/calorie-comparison-chart';
import { EnergyExpenditureChart } from '@/components/energy-guide/energy-expenditure-chart';
import { FitLabChartDemo } from '@/components/energy-guide/fitlab-chart-demo';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useTheme } from '@/hooks/use-theme';
import { buildDemoDay, DEMO_CONFIG, type DemoDay, type DemoValues } from '@/lib/energy-guide/demo-example';

type Page = {
  id: string;
  title: string;
  body: (day: DemoDay) => string;
  /** Short phones skip the intro line (the chart's own notes say it). */
  skipBodyWhenCompact?: boolean;
  chart: (day: DemoDay, play: boolean, compact: boolean, overflowPx: number) => React.ReactNode;
};

const PAGES: Page[] = [
  {
    id: 'compare',
    title: 'Calorie assunte e consumate',
    body: () =>
      'Assunte: le calorie di cibi e bevande che registri. Consumate: tutta l’energia che il corpo usa nella giornata. Il grafico di FitLab parte da questo confronto.',
    chart: (day, play) => <CalorieComparisonChart eatenKcal={day.eatenKcal} burnedKcal={day.burnedKcal} play={play} />,
  },
  {
    id: 'expenditure',
    title: 'Da dove arrivano le calorie consumate?',
    body: () =>
      'Il consumo ha due parti e il totale è la loro somma: l’allenamento è già dentro il movimento, non viene contato due volte.',
    chart: (day, play) => <EnergyExpenditureChart basalKcal={day.basalKcal} movementKcal={day.movementKcal} trainingKcal={day.trainingKcal} play={play} />,
  },
  {
    id: 'fitlab',
    title: 'Come leggere il grafico di FitLab',
    body: () => 'Il grafico della Home, con i numeri dell’esempio.',
    skipBodyWhenCompact: true,
    chart: (day, play, compact, overflowPx) => <FitLabChartDemo day={day} play={play} compact={compact} overflowPx={overflowPx} />,
  },
];

export const ENERGY_GUIDE_PAGE_COUNT = PAGES.length;

/** Below this many px of room the pages go compact. */
const COMPACT_BELOW = 520;

/**
 * "Come leggere il grafico": three swipeable pages explaining Home's calorie
 * chart on a worked example, all on one screen (nothing scrolls vertically).
 *
 * The example's numbers come from the `values` prop (the demo config unless
 * given others, never a store) and every page derives from the same
 * buildDemoDay(values), so a change shows up on all of them at once and
 * swiping back and forth always lands on agreeing charts. A page's animation
 * plays the first time it is shown and is not replayed when swiping back.
 */
export function EnergyGuideCarousel({ onDone, values = DEMO_CONFIG.initial }: { onDone: () => void; values?: DemoValues }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  // How much room the pages have (below the sheet's title, above the buttons). Short ones — small phones, or a tall phone's insets —
  // give up the footnote and the Home columns, and the gauge shrinks to what is left, so the page stays on one screen.
  const [pagerHeight, setPagerHeight] = useState(0);
  const [pageHeights, setPageHeights] = useState<number[]>(() => PAGES.map(() => 0));
  const compact = pagerHeight > 0 && pagerHeight < COMPACT_BELOW;
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState<boolean[]>(() => PAGES.map((_, i) => i === 0));
  const day = useMemo(() => buildDemoDay(values), [values]);
  const isLast = index === PAGES.length - 1;

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
      <View onLayout={(e) => { onLayout(e); setPagerHeight(Math.round(e.nativeEvent.layout.height)); }} style={styles.pager}>
        {width > 0 ? (
          <ScrollView
            ref={scrollRef}
            testID="energy-guide-pager"
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={32}
            onScroll={onScroll}
            onMomentumScrollEnd={onScroll}>
            {PAGES.map((page, i) => (
              <View
                key={page.id}
                testID={`energy-guide-page-${i}`}
                style={[styles.page, { width }]}
                onLayout={(e) => {
                  const h = Math.ceil(e.nativeEvent.layout.height);
                  setPageHeights((hs) => (hs[i] === h ? hs : hs.map((old, j) => (j === i ? h : old))));
                }}
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
                <ThemedText style={styles.title} accessibilityRole="header">
                  {page.title}
                </ThemedText>
                {compact && page.skipBodyWhenCompact ? null : (
                  <ThemedText style={styles.body} themeColor="textSecondary">
                    {page.body(day)}
                  </ThemedText>
                )}
                <FlatCard style={[styles.card, compact && styles.cardCompact]}>{page.chart(day, visited[i], compact, pagerHeight > 0 ? Math.max(0, pageHeights[i] - pagerHeight) : 0)}</FlatCard>
                {compact ? null : (
                  <ThemedText style={styles.footnote} themeColor="textTertiary">
                    Valori dimostrativi, non sono i tuoi dati. Le calorie consumate sono una stima.
                  </ThemedText>
                )}
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View style={styles.dots}>
        {PAGES.map((page, i) => (
          <View key={page.id} style={[styles.dot, i === index ? { backgroundColor: theme.accent, width: 18 } : { backgroundColor: theme.textTertiary, opacity: 0.35, width: 7 }]} />
        ))}
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
    flex: 1,
    gap: 12,
  },
  pager: {
    flex: 1,
    overflow: 'hidden',
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
  title: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  card: {
    marginTop: 4,
    padding: 14,
  },
  cardCompact: {
    padding: 10,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
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
  nav: {
    flexDirection: 'row',
    gap: 10,
  },
});
