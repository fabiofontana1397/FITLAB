import { useMemo, useState } from 'react';
import { PanResponder, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { TimingQuick } from '@/constants/motion';
import { Brand, OnBrand, Palette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { hapticPress, hapticSelection } from '@/lib/haptics';

/** Track height: the knob (48 pt, over the HIG's 44 pt target) plus a 4 pt inset all round. */
const HEIGHT = 56;
const INSET = 4;
const KNOB = HEIGHT - INSET * 2;
/** Share of the run the knob must pass for a release to count as "start". */
const THRESHOLD = 0.9;
/** How far the knob travels (pt) before the label has faded out completely. */
const LABEL_FADE = 56;

export type SwipeToStartProps = {
  /** Called once the knob is dragged (almost) to the end and released. */
  onStart: () => void;
  /** What VoiceOver/TalkBack read; its "activate" action starts without a drag. */
  accessibilityLabel: string;
  label?: string;
  doneLabel?: string;
  testID?: string;
};

/**
 * "Scorri per iniziare": a soft orange track whose orange knob (with the play
 * triangle) is dragged to the right to start the session — a deliberate
 * gesture, so a stray tap on the card never launches a workout.
 * The label sits to the knob's right while it waits and moves to its left once
 * the knob has reached the end, so the two never overlap.
 */
export function SwipeToStart({ onStart, accessibilityLabel, label = 'Scorri per iniziare', doneLabel = 'Allenamento avviato', testID }: SwipeToStartProps) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const [done, setDone] = useState(false);
  const x = useSharedValue(0);
  // Shared values rather than refs: the handlers below read and write them while the finger is down.
  const run = useSharedValue(0);
  const locked = useSharedValue(false);
  const armed = useSharedValue(false);

  const finish = () => {
    if (done) return;
    locked.value = true;
    x.value = withTiming(run.value, TimingQuick);
    setDone(true);
    hapticPress();
    onStart();
    // The session opens over the tab; put the knob back for when it closes.
    setTimeout(() => {
      locked.value = false;
      setDone(false);
      x.value = 0;
    }, 1200);
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !locked.value,
        onMoveShouldSetPanResponder: () => !locked.value,
        // Keep the drag once it starts, even if the list around it wants to scroll.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          armed.value = false;
        },
        onPanResponderMove: (_, g) => {
          x.value = Math.min(run.value, Math.max(0, g.dx));
          const past = run.value > 0 && x.value >= run.value * THRESHOLD;
          if (past !== armed.value) {
            armed.value = past;
            if (past) hapticSelection();
          }
        },
        onPanResponderRelease: (_, g) => {
          if (run.value > 0 && g.dx >= run.value * THRESHOLD) finish();
          else x.value = withTiming(0, TimingQuick);
        },
        onPanResponderTerminate: () => {
          x.value = withTiming(0, TimingQuick);
        },
      }),
    // finish/onStart are read at call time; the shared values are stable handles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onStart]
  );

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  // The fill only shows once the knob moves, so at rest there is no ring around it.
  const fillStyle = useAnimatedStyle(() => ({ width: x.value + KNOB + INSET * 2, opacity: interpolate(x.value, [0, 16], [0, 1], 'clamp') }));
  const labelStyle = useAnimatedStyle(() => ({
    // Gone before the knob reaches the text, so the two never overlap.
    opacity: done ? 1 : interpolate(x.value, [0, LABEL_FADE], [1, 0], 'clamp'),
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    run.value = Math.max(0, e.nativeEvent.layout.width - INSET * 2 - KNOB);
  };
  const labelColor = dark ? theme.accent : Palette.orange[700];

  return (
    <View
      onLayout={onLayout}
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Scorri verso destra per iniziare"
      accessibilityActions={[{ name: 'activate' }, { name: 'increment' }]}
      onAccessibilityAction={() => finish()}
      style={[styles.track, { backgroundColor: theme.accentSoft }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.fill, { backgroundColor: dark ? 'rgba(255,122,0,0.22)' : Palette.orange[100] }, fillStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.labelBox, done ? { paddingLeft: 16, paddingRight: KNOB + INSET + 12 } : { paddingLeft: KNOB + INSET + 12, paddingRight: 16 }, labelStyle]}>
        <ThemedText style={[styles.label, { color: labelColor }]} numberOfLines={1}>
          {done ? doneLabel : label}
        </ThemedText>
      </Animated.View>
      <Animated.View
        {...pan.panHandlers}
        style={[styles.knob, { backgroundColor: theme.accent, boxShadow: `0px 4px 12px ${Brand.accentShadow}` }, Platform.OS === 'web' ? ({ touchAction: 'none', cursor: 'grab' } as object) : null, knobStyle]}>
        <View style={done ? undefined : styles.playNudge}>
          <Icon name={done ? 'check' : 'play'} size={done ? 22 : 20} color={OnBrand.text} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    marginTop: 12,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: HEIGHT / 2,
  },
  labelBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  knob: {
    position: 'absolute',
    left: INSET,
    top: INSET,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The triangle's weight sits to its left: nudge it so it reads as centred.
  playNudge: { paddingLeft: 3 },
});
