import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { hapticSelection } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';

export type ScaleSliderProps = {
  min: number;
  max: number;
  step?: number;
  value: number | undefined;
  onChange: (value: number) => void;
  /** Words at the two ends ("Per niente" / "Moltissimo"), when the question has them. */
  minLabel?: string;
  maxLabel?: string;
  accessibilityLabel: string;
};

/**
 * The slider behind the schema's `scale` questions: a value dragged along a
 * track, shown live, with every stop also reachable by tap, by the ±
 * accessibility actions and through VoiceOver's adjustable role.
 *
 * Built on React Native's own touch responder (no gesture-handler provider
 * needed at the app root), so it behaves the same on iOS, Android and web.
 */
export function ScaleSlider({ min, max, step = 1, value, onChange, minLabel, maxLabel, accessibilityLabel }: ScaleSliderProps) {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const lastEmitted = useRef<number | null>(null);

  const stops = useMemo(() => {
    const out: number[] = [];
    for (let v = min; v <= max; v += step) out.push(Number(v.toFixed(2)));
    return out;
  }, [min, max, step]);

  const current = value ?? min;
  const currentIndex = stops.indexOf(nearest(stops, current));
  const ratio = stops.length > 1 ? currentIndex / (stops.length - 1) : 0;

  const emitAt = (x: number) => {
    if (trackWidth <= 0) return;
    const index = Math.round((Math.min(trackWidth, Math.max(0, x)) / trackWidth) * (stops.length - 1));
    const next = stops[index];
    if (lastEmitted.current === next) return;
    lastEmitted.current = next;
    hapticSelection();
    onChange(next);
  };

  const nudge = (delta: number) => {
    const next = stops[Math.min(stops.length - 1, Math.max(0, currentIndex + delta))];
    if (next === value) return;
    hapticSelection();
    onChange(next);
  };

  return (
    <View style={styles.root}>
      <ThemedText style={[styles.value, { color: value == null ? theme.textTertiary : theme.text }]}>{current}</ThemedText>

      <View
        style={styles.trackArea}
        onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => emitAt(e.nativeEvent.locationX)}
        onResponderMove={(e) => emitAt(e.nativeEvent.locationX)}
        onResponderRelease={() => {
          lastEmitted.current = null;
        }}
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min, max, now: current }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
        <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: theme.accent }]} />
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            { left: Math.max(0, ratio * trackWidth - 14), backgroundColor: theme.background, borderColor: theme.accent },
          ]}
        />
      </View>

      <View style={styles.endLabels}>
        <Pressable onPress={() => onChange(stops[0])} hitSlop={6} accessibilityRole="button">
          <ThemedText type="caption" themeColor="textSecondary">
            {minLabel ?? min}
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => onChange(stops[stops.length - 1])} hitSlop={6} accessibilityRole="button">
          <ThemedText type="caption" themeColor="textSecondary">
            {maxLabel ?? max}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function nearest(stops: number[], value: number): number {
  return stops.reduce((best, stop) => (Math.abs(stop - value) < Math.abs(best - value) ? stop : best), stops[0]);
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  value: { fontSize: 48, lineHeight: 54, fontWeight: '700', textAlign: 'center', letterSpacing: -1.4, fontVariant: ['tabular-nums'] },
  trackArea: { height: 44, justifyContent: 'center' },
  track: { height: 8, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  thumb: { position: 'absolute', width: 28, height: 28, borderRadius: Radius.pill, borderWidth: 3 },
  endLabels: { flexDirection: 'row', justifyContent: 'space-between' },
});
