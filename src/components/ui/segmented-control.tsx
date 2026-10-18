import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection } from '@/lib/haptics';

export type SegmentOption<T extends string> = { value: T; label: string };

export type SegmentedControlProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  scrollable?: boolean;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  scrollable,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [positions, setPositions] = useState<Record<string, number>>({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  const activeWidth = widths[value];
  const activeX = positions[value];

  useEffect(() => {
    if (activeWidth != null && activeX != null) {
      indicatorX.value = withTiming(activeX, { duration: 220 });
      indicatorWidth.value = withTiming(activeWidth, { duration: 220 });
    }
  }, [activeWidth, activeX, indicatorX, indicatorWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  const onItemLayout = (key: string) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setWidths((prev) => ({ ...prev, [key]: width }));
    setPositions((prev) => ({ ...prev, [key]: x }));
  };

  const content = (
    <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
      {activeWidth != null && (
        <Animated.View
          style={[
            styles.indicator,
            indicatorStyle,
            { backgroundColor: theme.accent, shadowColor: theme.accent },
          ]}
        />
      )}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onLayout={onItemLayout(option.value)}
            onPress={() => {
              if (option.value !== value) hapticSelection();
              onChange(option.value);
            }}
            style={styles.item}
            hitSlop={4}>
            <ThemedText
              type="smallBold"
              style={{ color: active ? theme.onAccent : theme.textSecondary }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        {content}
      </ScrollView>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: Radius.pill,
    padding: Spacing.half,
    position: 'relative',
  },
  item: {
    flex: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    position: 'absolute',
    top: Spacing.half,
    bottom: Spacing.half,
    borderRadius: Radius.pill,
    ...Platform.select({
      web: { boxShadow: '0px 3px 8px rgba(255,106,0,0.35)' },
      default: { shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
    }),
  },
});
