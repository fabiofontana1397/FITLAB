import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

// Half the size of the reference toggle (62 × 36): 31 × 18 pt, with every part scaled with it.
const TRACK_W = 31;
const TRACK_H = 18;
const THUMB_W = 19;
const THUMB_H = 15;
const BORDER = 1;
const PAD = (TRACK_H - THUMB_H) / 2;
const TRAVEL = TRACK_W - THUMB_W - PAD * 2;
// The visible switch is small, but its touch area still reaches the HIG's 44 × 44 pt.
const HIT_SLOP = { top: (44 - TRACK_H) / 2, bottom: (44 - TRACK_H) / 2, left: (44 - TRACK_W) / 2, right: (44 - TRACK_W) / 2 };

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
      hitSlop={HIT_SLOP}
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
    borderWidth: BORDER,
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  thumb: {
    position: 'absolute',
    left: PAD - BORDER,
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: THUMB_H / 2,
    borderWidth: BORDER,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 1px 2px rgba(0,0,0,0.2)',
  },
  mark: { position: 'absolute', top: 0, bottom: 0, width: TRACK_W - THUMB_W - PAD * 2, alignItems: 'center', justifyContent: 'center' },
  onMark: { left: PAD - BORDER },
  offMark: { right: PAD - BORDER },
  bar: { width: 1.5, height: 6, borderRadius: 0.75, backgroundColor: '#FFFFFF' },
  ring: { width: 6, height: 6, borderRadius: 3, borderWidth: 1 },
});
