import { forwardRef } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const ScreenScroll = forwardRef<ScrollView, ScreenScrollProps>(function ScreenScroll(
  { children, contentContainerStyle, ...rest },
  ref
) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      ref={ref}
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }}
      showsVerticalScrollIndicator={false}
      {...rest}>
      <View
        style={[
          styles.inner,
          {
            paddingTop: Platform.select({ web: Spacing.five, default: insets.top + Spacing.two }),
            paddingBottom: BottomTabInset + Spacing.six,
          },
          contentContainerStyle,
        ]}>
        {children}
      </View>
    </ScrollView>
  );
});

type ScreenScrollProps = ScrollViewProps;

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
});
