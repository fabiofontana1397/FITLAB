import { useState } from 'react';
import { View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { ChatFab } from '@/components/chat/chat-fab';
import { useHealthSync } from '@/hooks/use-health-energy';

// Auth/onboarding gating now lives in the root layout (src/app/_layout.tsx)
// so it applies to every route, not just this tab group.
//
// ChatFab is a sibling here, not nested inside AppTabs' TabList — expo-router
// /ui's <TabList asChild> apparently resolves taps anywhere in that subtree
// to "nearest known tab route" (nesting it inside the floating bar's row
// made every tap on the chat button silently navigate to a tab instead of
// opening chat). Keeping it external and only visually docked beside the
// bar (via matching absolute-position math in ChatFab) avoids that.
//
// barHeight is measured off the tab bar's own rendered layout (rather than
// assumed) and handed to ChatFab so the button matches the bar's actual
// height. Locked to the FIRST measurement only (the bar's content never
// actually changes size, but its onLayout can still refire with a fresh
// value on every tab switch) — accepting later re-measurements fed a
// "changed" size into ChatFab/ChatOrb on every navigation, which read as
// the orb visibly jumping the moment you switched tabs.
export default function TabLayout() {
  const [barHeight, setBarHeight] = useState<number | null>(null);
  useHealthSync();

  return (
    <View style={{ flex: 1 }}>
      <AppTabs onBarHeightChange={(height) => setBarHeight((current) => current ?? height)} />
      <ChatFab size={barHeight} />
    </View>
  );
}
