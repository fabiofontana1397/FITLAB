import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const TICK_SPACING = 10;

/** The segmented progress bar from the Figma Home/Nutrizione cards: a
 * pill-shaped fill with thin vertical tick lines running the full width
 * (darker over the filled part, a faint orange tint over the empty track)
 * so progress reads like a row of small cells rather than one smooth bar. */
export function TickProgressBar({ progress, height = 10, color }: { progress: number; height?: number; color?: string }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const fill = color ?? theme.accent;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const fillWidth = width * clamped;
  const tickCount = width > 0 ? Math.floor(width / TICK_SPACING) : 0;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View onLayout={onLayout} style={[styles.track, { height, borderRadius: height / 2, backgroundColor: theme.backgroundElement }]}>
      <View style={{ width: fillWidth, height, borderRadius: height / 2, backgroundColor: fill }} />
      {Array.from({ length: tickCount }, (_, i) => {
        const x = (i + 1) * TICK_SPACING;
        return (
          <View
            key={i}
            style={[
              styles.tick,
              { left: x, backgroundColor: x < fillWidth ? 'rgba(0,0,0,0.14)' : 'rgba(255,106,19,0.16)' },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
});
