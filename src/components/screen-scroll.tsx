import { LinearGradient } from 'expo-linear-gradient';
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
  const isLight = theme.tabBarBlur === 'light';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Soft top-to-bottom grey wash behind every light screen. */}
      {isLight ? (
        <LinearGradient
          colors={['#F2F2F1', theme.background, '#DEDEDD']}
          locations={[0, 0.45, 1]}
          style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
        />
      ) : null}
      <ScrollView
        ref={ref}
        style={styles.scrollView}
        contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
        {...rest}>
        <View
          style={[
            styles.inner,
            {
              paddingTop: insets.top + Platform.select({ web: Spacing.five, default: Spacing.two }),
              paddingBottom: BottomTabInset + Spacing.six,
            },
            contentContainerStyle,
          ]}>
          {children}
        </View>
      </ScrollView>
    </View>
  );
});

type ScreenScrollProps = ScrollViewProps;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
