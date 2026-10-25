import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

const TRACK_W = 62;
const TRACK_H = 36;
const THUMB_W = 38;
const THUMB_H = 30;
const PAD = (TRACK_H - THUMB_H) / 2;
const TRAVEL = TRACK_W - THUMB_W - PAD * 2;

export type IosSwitchProps = {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
};

/**
 * The FitLab toggle, built to the reference: a pill-shaped white thumb that
 * slides over the track, with the iOS "On/Off" marks — a bar on the left when
 * on, a small ring on the right when off — so state never rests on colour alone.
 */
export function IosSwitch({ value, onValueChange, disabled }: IosSwitchProps) {
  const dark = useColorScheme() === 'dark';
  // The "on" track is the app's orange, like every other active control.
  const onColor = useTheme().accent;
  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 180 });
  }, [value, progress]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * TRAVEL }] }));
  const onMark = useAnimatedStyle(() => ({ opacity: progress.value }));
  const offMark = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));

  const offTrack = dark ? '#303036' : '#D6D6D8';
  const offLine = dark ? '#5C5C63' : '#B9B9BD';

  return (
    <Pressable
      onPress={() => onValueChange?.(!value)}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      aria-checked={value}
      style={[
        styles.track,
        value ? { backgroundColor: onColor, borderColor: onColor } : { backgroundColor: offTrack, borderColor: offLine },
        disabled && styles.disabled,
      ]}>
      <Animated.View style={[styles.mark, styles.onMark, onMark]}>
        <View style={styles.bar} />
      </Animated.View>
      <Animated.View style={[styles.mark, styles.offMark, offMark]}>
        <View style={[styles.ring, { borderColor: offLine }]} />
      </Animated.View>
      <Animated.View style={[styles.thumb, { borderColor: value ? '#FFFFFF' : offLine }, thumbStyle]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  thumb: {
    position: 'absolute',
    left: PAD - 1.5,
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: THUMB_H / 2,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 1px 3px rgba(0,0,0,0.18)',
  },
  mark: { position: 'absolute', top: 0, bottom: 0, width: TRACK_W - THUMB_W - PAD * 2, alignItems: 'center', justifyContent: 'center' },
  onMark: { left: PAD - 1.5 },
  offMark: { right: PAD - 1.5 },
  bar: { width: 2.5, height: 12, borderRadius: 1.25, backgroundColor: '#FFFFFF' },
  ring: { width: 11, height: 11, borderRadius: 5.5, borderWidth: 1.8 },
});
