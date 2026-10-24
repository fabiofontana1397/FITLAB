import { Suspense, lazy, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { ChatOrb } from '@/components/chat/chat-orb';
import { Palette } from '@/constants/theme';

/**
 * The AI coach's avatar, web build.
 *
 * On the web the orb becomes a real shader gradient (shadergradient, which
 * renders through three.js). That stack is around a megabyte, and the orb
 * is a 30–56px circle, so it is never part of the initial bundle:
 *
 * - It is behind `lazy()`, so the chunk is only fetched when an orb is
 *   actually on screen.
 * - It is only ever fetched on the web. Native resolves coach-orb.tsx
 *   instead, which has no reference to this file, so three.js never
 *   reaches the iOS or Android bundle at all.
 * - It is skipped entirely under Reduce Motion, where a continuously
 *   animating gradient is exactly what the setting asks us not to show.
 *
 * Until (or unless) it loads, and in every case above, the orb is the
 * hand-drawn one from chat-orb.tsx — which is also what native shows. It
 * renders underneath the whole time rather than in place of a spinner, so
 * the shader fades in over a finished orb instead of over a hole.
 */
const ShaderLayer = lazy(() => import('@/components/chat/coach-orb-shader.web'));

export function CoachOrb({ size = 56 }: { size?: number }) {
  const reduceMotion = useReducedMotion();
  // Mount the shader only after the first paint, so it never competes with
  // the screen it appears on for the main thread.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(id);
  }, [reduceMotion]);

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: Palette.orange[500] }}>
      <ChatOrb size={size} />
      {ready ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* No fallback: the orb above is already the fallback. */}
          <Suspense fallback={null}>
            <ShaderLayer size={size} />
          </Suspense>
        </View>
      ) : null}
    </View>
  );
}
