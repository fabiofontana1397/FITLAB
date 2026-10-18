import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// The app's haptic vocabulary — screens say what happened (a tap, a choice, a
// save), this file decides how it feels on each platform.
//
// Native only: on the web, expo-haptics falls back to navigator.vibrate,
// whose coarse buzz on every tap cheapens rather than polishes. Every call is
// fire-and-forget and swallows errors, so a dev build made before
// expo-haptics was added (module missing) simply stays silent.

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function fire(run: () => Promise<void>) {
  if (!enabled) return;
  run().catch(() => {});
}

/** Finger down on a button, tile or card. */
export function hapticTap() {
  fire(() =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  );
}

/** A firmer press, for the main call-to-action of a screen. */
export function hapticPress() {
  fire(() =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  );
}

/** Picking one option among several: tabs, segments, days, expanding a row. */
export function hapticSelection() {
  fire(() =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick)
      : Haptics.selectionAsync()
  );
}

/** Something was saved or completed (a meal, a workout, a weigh-in). */
export function hapticSuccess() {
  fire(() =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  );
}

/** Turning something on or off (switches, marking a day done). */
export function hapticToggle(on: boolean) {
  fire(() =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(on ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off)
      : Haptics.impactAsync(on ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
  );
}
