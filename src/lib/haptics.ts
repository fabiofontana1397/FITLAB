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

/** Tests (which run on the web, where nothing vibrates) set `globalThis.__FITLAB_HAPTIC_LOG__ = []` to read back what was fired. */
type HapticLog = { __FITLAB_HAPTIC_LOG__?: string[] };

function fire(name: string, run: () => Promise<void>) {
  (globalThis as HapticLog).__FITLAB_HAPTIC_LOG__?.push(name);
  if (!enabled) return;
  run().catch(() => {});
}

/** Finger down on a button, tile or card. */
export function hapticTap() {
  fire('tap', () =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  );
}

/** A firmer press, for the main call-to-action of a screen. */
export function hapticPress() {
  fire('press', () =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  );
}

/** Picking one option among several: tabs, segments, days, expanding a row. */
export function hapticSelection() {
  fire('selection', () =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick)
      : Haptics.selectionAsync()
  );
}

/** Something was saved or completed (a meal, a workout, a weigh-in). */
export function hapticSuccess() {
  fire('success', () =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  );
}

/** Turning something on or off (switches, marking a day done). */
export function hapticToggle(on: boolean) {
  fire(on ? 'toggle-on' : 'toggle-off', () =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(on ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off)
      : Haptics.impactAsync(on ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
  );
}

/** A soft thud as something rises into view or settles away: sheets and popups opening and closing. */
export function hapticSoft() {
  fire('soft', () =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Gesture_End)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)
  );
}

/** The sharp "pop" of a force-press: a threshold was crossed (a swipe far enough to commit, a drag far enough to dismiss). */
export function hapticRigid() {
  fire('rigid', () =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)
  );
}

/** A heavy thump for something weighty and final: deleting, finishing a whole workout. */
export function hapticHeavy() {
  fire('heavy', () =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
  );
}

/** A heads-up: a destructive action is about to happen (signing out). */
export function hapticWarning() {
  fire('warning', () =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  );
}

/** Something went wrong (a wrong password, a failed save). */
export function hapticError() {
  fire('error', () =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  );
}
