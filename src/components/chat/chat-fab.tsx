import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BUBBLE, TAB_BUBBLE_OVERLAP } from '@/components/app-tabs';
import { ChatOrb } from '@/components/chat/chat-orb';
import { LiquidGlass } from '@/components/glass/liquid-glass';
import { Radius, Spacing } from '@/constants/theme';


/** The AI-coach entry point. Kept as an independent overlay (not nested
 * inside AppTabs' <TabList>) — expo-router/ui resolves any tap within a
 * TabList's asChild subtree to "nearest known tab route", so a tab-bar-
 * internal chat button silently navigated to a tab instead of opening chat.
 * Its bottom offset matches the floating tab bar's own (see app-tabs.tsx's
 * floatWrapper) and its right offset puts it in the slot the bar reserves
 * as the last bubble of its chain, so it docks visually as one of the
 * bubbles without sharing its tap-resolution subtree.
 *
 * `size` is the tab bar's own measured height (see _layout.tsx), so the
 * button always stands exactly as tall as the bar beside it — width tracks
 * height 1:1 (rather than a fixed 48) so it stays a perfect circle instead
 * of stretching into an oval whenever the bar's height changes.
 *
 * Its face is a small animated ChatOrb rather than a static chat-bubble
 * icon — a living "AI entity" cue that's always drifting, never a still
 * image, so the coach reads as present rather than a dormant button. */
export function ChatFab({ size }: { size?: number | null }) {
  const insets = useSafeAreaInsets();
  const bottomOffset = Platform.select({ web: Math.max(insets.bottom, Spacing.four), default: insets.bottom || Spacing.three });
  const { width } = useWindowDimensions();
  const buttonSize = size ?? TAB_BUBBLE;
  const orbSize = Math.round(buttonSize * 0.9);
  // The last bubble of the tab bar's centered chain (four tabs, then this).
  const chainWidth = 5 * TAB_BUBBLE - 4 * TAB_BUBBLE_OVERLAP;
  const right = Math.max(Spacing.three, (width - chainWidth) / 2);

  return (
    <Pressable
      onPress={() => router.push('/chat')}
      style={[styles.wrapper, { bottom: bottomOffset, right }]}
      hitSlop={8}>
      <LiquidGlass
        variant="clear"
        radius={Radius.pill}
        style={[styles.button, { width: buttonSize, height: buttonSize }]}
        interactive>
        <ChatOrb size={orbSize} />
      </LiquidGlass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: 10,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
