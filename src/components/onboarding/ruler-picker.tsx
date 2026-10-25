import { memo, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { hapticSelection } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';

/** Ticks kept mounted on each side of the one under the needle. A full
 * 35–200 kg ruler at 0.1 kg is ~1 650 ticks; only this window exists at any
 * moment, so the scale stays smooth however long the range is. */
const WINDOW_RADIUS = 90;
/** How far the needle may travel before the window is re-centred. */
const WINDOW_SLACK = 45;
/** Quiet time after the last scroll event before the value under the needle
 * is accepted. React Native Web never fires onMomentumScrollEnd or
 * onScrollEndDrag (its ScrollView only emits onScroll — see
 * react-native-web/dist/exports/ScrollView/ScrollViewBase.js), so without
 * this the ruler would never commit in Safari or the installed PWA. The
 * native end-of-scroll callbacks still commit immediately on iOS and
 * Android; this only catches what they miss. */
const SCROLL_IDLE_MS = 140;

export type RulerPickerProps = {
  axis: 'horizontal' | 'vertical';
  /** Bounds and precision in the unit currently on screen, not in the stored unit. */
  min: number;
  max: number;
  step: number;
  /** Every n-th tick is long and carries a label. */
  majorEvery: number;
  /** undefined = unanswered: the ruler parks on `fallback`, dimmed, and commits nothing until dragged. */
  value: number | undefined;
  fallback: number;
  onChange: (value: number) => void;
  formatMajor: (value: number) => string;
  /** The big read-out above (horizontal) or beside (vertical) the scale. */
  renderValue: (value: number) => React.ReactNode;
  accessibilityLabel: string;
};

const TICK_GAP = { horizontal: 9, vertical: 11 } as const;
const SCALE_SIZE = { horizontal: 84, vertical: 240 } as const;

/**
 * The graduated scale behind the height and weight questions: a ruler that
 * slides under a fixed needle, with the value read out in large type.
 *
 * It works purely in the unit on screen — the screens above convert to and
 * from the questionnaire's canonical cm/kg, and a unit toggle alone never
 * commits a value, so switching kg ⇄ lb can't nudge the weight through
 * repeated rounding.
 */
export function RulerPicker({
  axis,
  min,
  max,
  step,
  majorEvery,
  value,
  fallback,
  onChange,
  formatMajor,
  renderValue,
  accessibilityLabel,
}: RulerPickerProps) {
  const theme = useTheme();
  const horizontal = axis === 'horizontal';
  const gap = TICK_GAP[axis];
  const scrollRef = useRef<ScrollView>(null);
  const [viewport, setViewport] = useState(0);
  const count = Math.max(1, Math.round((max - min) / step) + 1);

  // Vertical rulers read like a real tape measure: the largest value at the top.
  const valueAt = (index: number) => Number((horizontal ? min + index * step : max - index * step).toFixed(2));
  const indexOf = (v: number) => {
    const clamped = Math.min(max, Math.max(min, v));
    return Math.min(count - 1, Math.max(0, Math.round((horizontal ? clamped - min : max - clamped) / step)));
  };

  const committedIndex = indexOf(value ?? fallback);
  const [liveIndex, setLiveIndex] = useState(committedIndex);
  const [windowCentre, setWindowCentre] = useState(committedIndex);
  const lastCommitted = useRef<number | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-position only for a value that changed somewhere else (mount, Back to
  // an answered question, a unit switch) — never under the user's own finger.
  useEffect(() => {
    if (lastCommitted.current === committedIndex || viewport === 0) return;
    lastCommitted.current = committedIndex;
    setLiveIndex(committedIndex);
    setWindowCentre(committedIndex);
    const target = committedIndex * gap;
    scrollRef.current?.scrollTo(horizontal ? { x: target, animated: false } : { y: target, animated: false });
  }, [committedIndex, gap, horizontal, viewport]);

  const commitIndex = (index: number) => {
    lastCommitted.current = index;
    onChange(valueAt(index));
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const position = horizontal ? e.nativeEvent.contentOffset.x : e.nativeEvent.contentOffset.y;
    const index = Math.min(count - 1, Math.max(0, Math.round(position / gap)));
    if (index !== liveIndex) {
      setLiveIndex(index);
      if (index % majorEvery === 0) hapticSelection();
    }
    if (Math.abs(index - windowCentre) > WINDOW_SLACK) setWindowCentre(index);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => commitIndex(index), SCROLL_IDLE_MS);
  };

  const commit = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const position = horizontal ? e.nativeEvent.contentOffset.x : e.nativeEvent.contentOffset.y;
    commitIndex(Math.min(count - 1, Math.max(0, Math.round(position / gap))));
  };

  useEffect(
    () => () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    },
    []
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const size = horizontal ? e.nativeEvent.layout.width : e.nativeEvent.layout.height;
    setViewport(size);
  };

  const pad = viewport > 0 ? viewport / 2 : 0;
  const contentSize = (count - 1) * gap;
  const unanswered = value == null;

  const scale = (
    <View
      style={[
        styles.scaleWrap,
        // A horizontal ruler must be pinned to the column's width: left to
        // size itself it takes the width of its content — 1 650 ticks, i.e.
        // hundreds of thousands of pixels — and drags the whole page into a
        // horizontal scroll instead of scrolling inside itself.
        horizontal ? { height: SCALE_SIZE.horizontal, alignSelf: 'stretch' } : { height: SCALE_SIZE.vertical, width: 96 },
      ]}>
      <ScrollView
        ref={scrollRef}
        horizontal={horizontal}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        snapToInterval={gap}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onLayout={onLayout}
        onScroll={onScroll}
        onMomentumScrollEnd={commit}
        onScrollEndDrag={commit}
        accessibilityLabel={accessibilityLabel}
        contentContainerStyle={horizontal ? undefined : styles.verticalContent}>
        {/* The ticks live in a plain, explicitly sized box and carry the
            half-viewport lead-in in their own offsets. Hanging them off the
            scroll view's own padding instead looks equivalent but isn't:
            absolutely positioned children don't resolve against that padding
            on the web, which silently slid the whole scale half a screen away
            from the needle. */}
        {viewport > 0 ? (
          <View
            style={
              horizontal
                ? { width: contentSize + pad * 2, height: SCALE_SIZE.horizontal }
                : { height: contentSize + pad * 2, width: 96 }
            }>
            <TickWindow
              axis={axis}
              signature={`${min}:${max}:${step}:${majorEvery}:${pad}`}
              centre={windowCentre}
              count={count}
              gap={gap}
              lead={pad}
              majorEvery={majorEvery}
              valueAt={valueAt}
              formatMajor={formatMajor}
              tickColor={theme.textTertiary}
              labelColor={theme.textSecondary}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Needle */}
      <View
        pointerEvents="none"
        style={[
          styles.needle,
          { backgroundColor: theme.accent },
          horizontal
            ? { width: 3, height: 44, left: '50%', marginLeft: -1.5, top: 6 }
            : { height: 3, width: 56, top: '50%', marginTop: -1.5, right: 0 },
        ]}
      />
    </View>
  );

  const readout = (
    <View style={[styles.readout, unanswered && styles.readoutDim]} accessibilityElementsHidden={false}>
      {renderValue(valueAt(liveIndex))}
    </View>
  );

  return (
    <View style={styles.root}>
      {horizontal ? (
        <>
          {readout}
          {scale}
        </>
      ) : (
        <View style={styles.verticalRow}>
          {scale}
          {readout}
        </View>
      )}
      {unanswered ? (
        <ThemedText type="caption" themeColor="textTertiary" style={styles.hint}>
          Scorri la scala per selezionare
        </ThemedText>
      ) : null}
    </View>
  );
}

type TickWindowProps = {
  axis: 'horizontal' | 'vertical';
  /** Changes whenever the scale itself changes (range, precision, unit) —
   * the memo below compares this instead of the `valueAt`/`formatMajor`
   * closures, which are new on every render and would defeat it. */
  signature: string;
  centre: number;
  count: number;
  gap: number;
  /** Half a viewport of empty scale before the first tick, so tick 0 can sit under the needle. */
  lead: number;
  majorEvery: number;
  valueAt: (index: number) => number;
  formatMajor: (value: number) => string;
  tickColor: string;
  labelColor: string;
};

/**
 * The ticks currently near the needle, laid out absolutely at `index * gap`.
 * Memoised on the window's centre so dragging only re-renders it once every
 * WINDOW_SLACK ticks — the large read-out above updates every frame, the
 * scale itself does not.
 */
const TickWindow = memo(function TickWindow({
  axis,
  centre,
  count,
  gap,
  lead,
  majorEvery,
  valueAt,
  formatMajor,
  tickColor,
  labelColor,
}: TickWindowProps) {
  const horizontal = axis === 'horizontal';
  const from = Math.max(0, centre - WINDOW_RADIUS);
  const to = Math.min(count - 1, centre + WINDOW_RADIUS);
  const ticks = [];
  for (let index = from; index <= to; index += 1) {
    const major = index % majorEvery === 0;
    const medium = !major && index % Math.max(1, Math.round(majorEvery / 2)) === 0;
    const length = major ? 34 : medium ? 22 : 14;
    ticks.push(
      <View
        key={index}
        style={[
          styles.tickSlot,
          horizontal
            ? { left: lead + index * gap - gap / 2, width: gap, top: 0 }
            : { top: lead + index * gap - gap / 2, height: gap, left: 0, right: 0 },
        ]}>
        <View
          style={[
            { backgroundColor: tickColor, opacity: major ? 0.9 : 0.4, borderRadius: 1 },
            horizontal ? { width: 2, height: length, marginTop: 10 } : { height: 2, width: length, alignSelf: 'flex-end', marginTop: (gap - 2) / 2 },
          ]}
        />
        {major ? (
          <ThemedText
            type="caption"
            style={[
              styles.tickLabel,
              { color: labelColor },
              horizontal ? { top: 48 } : { right: 42, top: -6 },
            ]}>
            {formatMajor(valueAt(index))}
          </ThemedText>
        ) : null}
      </View>
    );
  }
  return <>{ticks}</>;
},
(prev, next) =>
  prev.signature === next.signature &&
  prev.centre === next.centre &&
  prev.count === next.count &&
  prev.gap === next.gap &&
  prev.lead === next.lead &&
  prev.majorEvery === next.majorEvery &&
  prev.axis === next.axis &&
  prev.tickColor === next.tickColor &&
  prev.labelColor === next.labelColor);

const styles = StyleSheet.create({
  root: { gap: Spacing.three, alignItems: 'center' },
  verticalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  scaleWrap: { position: 'relative', overflow: 'hidden', borderRadius: Radius.small },
  verticalContent: { alignItems: 'flex-end' },
  tickSlot: { position: 'absolute', alignItems: 'center' },
  tickLabel: { position: 'absolute', fontWeight: '600' },
  needle: { position: 'absolute', borderRadius: 2 },
  readout: { alignItems: 'center', justifyContent: 'center' },
  readoutDim: { opacity: 0.45 },
  hint: { textAlign: 'center' },
});
