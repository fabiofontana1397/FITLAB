import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { usePlayValue } from '@/components/energy-guide/use-play-value';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { OnBrand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection } from '@/lib/haptics';

const ROW_HEIGHT = 44;
const MAX_NODE = 30;
const MIN_NODE = 18;
const LINE = 3;
/** How far the selection ring stands off the node it surrounds. */
const RING_GAP = 4;

export type MonthTimelineProps = {
  months: number[];
  /** The month the person is living. */
  current: number;
  selected: number;
  /** How far along the plan is, in months (2.4 = 40% into the third month). */
  elapsedMonths: number;
  onSelect: (month: number) => void;
};

/**
 * The plan as a path: one stop per month on a line that fills as time passes. Months behind are solid with a check,
 * the one being lived is solid and breathes, the ones ahead are quiet numbers. A ring marks the chosen month and
 * slides to the next one when another is tapped. Every month fits the width, so nothing is cut off or scrolled.
 */
export function MonthTimeline({ months, current, selected, elapsedMonths, onSelect }: MonthTimelineProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const count = months.length;
  const cell = count > 0 ? width / count : 0;
  const node = Math.max(MIN_NODE, Math.min(MAX_NODE, cell - RING_GAP * 2 - 4));
  const ring = node + RING_GAP * 2;
  const lineLength = Math.max(0, cell * (count - 1));

  // The line fills from the first stop to where the plan stands today.
  const fill = usePlayValue(count > 1 ? Math.min(1, Math.max(0, elapsedMonths / (count - 1))) : 0, width > 0, 250);
  const fillStyle = useAnimatedStyle(() => ({ width: fill.value * lineLength }));

  // The ring glides to the chosen month.
  const selectedIndex = Math.max(0, months.indexOf(selected));
  const ringX = useSharedValue(-1);
  useEffect(() => {
    if (width === 0) return;
    const x = selectedIndex * cell + (cell - ring) / 2;
    ringX.set(ringX.get() < 0 || reduceMotion ? x : withSpring(x, { damping: 19, stiffness: 230, mass: 0.9 }));
  }, [selectedIndex, cell, ring, width, reduceMotion, ringX]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: ringX.value < 0 ? 0 : 1, transform: [{ translateX: Math.max(0, ringX.value) }] }));

  // The month being lived breathes: a halo that swells and fades, slowly.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(withDelay(900, withRepeat(withSequence(withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 }), withTiming(0, { duration: 700 })), -1)));
  }, [reduceMotion, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: 0.38 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 0.75 }] }));

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const selectedIsCurrent = selected === current;

  return (
    <View style={styles.row} onLayout={onLayout} accessibilityRole="tablist">
      {width > 0 ? (
        <>
          <View style={[styles.line, { left: cell / 2, width: lineLength, backgroundColor: theme.backgroundElement }]}>
            <Animated.View style={[styles.lineFill, fillStyle]}>
              <LinearGradient colors={['#FFA11E', '#FF5A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </View>

          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { width: ring, height: ring, borderRadius: ring / 2, top: (ROW_HEIGHT - ring) / 2, borderColor: selectedIsCurrent ? theme.accent : theme.textSecondary, backgroundColor: theme.backgroundElevated }, ringStyle]}
          />

          {months.map((m) => {
            const done = m < current;
            const running = m === current;
            const solid = done || running;
            return (
              <Pressable
                key={m}
                onPress={() => {
                  hapticSelection();
                  onSelect(m);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: m === selected }}
                accessibilityLabel={`Mese ${m}${done ? ', concluso' : running ? ', in corso' : ', non ancora sbloccato'}`}
                style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.6 : 1 }]}
              >
                {running ? <Animated.View pointerEvents="none" style={[styles.halo, { width: node, height: node, borderRadius: node / 2, backgroundColor: theme.accent }, pulseStyle]} /> : null}
                <View style={[styles.node, { width: node, height: node, borderRadius: node / 2, backgroundColor: solid ? theme.accent : theme.backgroundElement }]}>
                  {done ? (
                    <Icon name="check" size={Math.round(node * 0.5)} color={OnBrand.text} />
                  ) : (
                    <ThemedText style={[styles.number, { fontSize: node >= 26 ? 14 : 12, color: running ? OnBrand.text : m === selected ? theme.text : theme.textTertiary }]}>{m}</ThemedText>
                  )}
                </View>
              </Pressable>
            );
          })}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center' },
  line: { position: 'absolute', top: (ROW_HEIGHT - LINE) / 2, height: LINE, borderRadius: LINE / 2, overflow: 'hidden' },
  lineFill: { height: '100%', borderRadius: LINE / 2, overflow: 'hidden' },
  ring: { position: 'absolute', left: 0, borderWidth: 2 },
  cell: { flex: 1, height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  node: { alignItems: 'center', justifyContent: 'center' },
  number: { lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
