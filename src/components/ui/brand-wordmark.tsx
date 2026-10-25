import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BrandMark } from '@/components/ui/brand-mark';

/** The FitLab logo for the welcome screen: the "F" mark, optionally with the "Build your best" tagline under it. */
export function BrandWordmark({ tagline = false, height = 72, style }: { tagline?: boolean; height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.root, style]}>
      <BrandMark height={height} />
      {tagline ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.tagline}>
          Build your best
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 12 },
  tagline: { letterSpacing: 1.2, textTransform: 'uppercase' },
});
