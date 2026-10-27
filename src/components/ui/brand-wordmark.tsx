import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BrandMark } from '@/components/ui/brand-mark';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

const LOGO_BLACK = require('@/assets/images/fitlab-logo-black.webp');
const LOGO_WHITE = require('@/assets/images/fitlab-logo-white.webp');
/** The official logo artwork's width / height. */
const LOGO_RATIO = 1000 / 167;

/** The FitLab logo for the welcome screen: the "F" mark alone, or (`name`) the full FITLAB artwork, optionally with the "Build your best" tagline between two orange rules. */
export function BrandWordmark({
  tagline = false,
  name = false,
  height = 72,
  style,
}: {
  tagline?: boolean;
  name?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const logoHeight = height * 0.75;
  return (
    <View style={[styles.root, style]}>
      {name ? (
        <Image
          source={dark ? LOGO_WHITE : LOGO_BLACK}
          style={{ width: logoHeight * LOGO_RATIO, height: logoHeight }}
          contentFit="contain"
          accessibilityLabel="FitLab"
        />
      ) : (
        <BrandMark height={height} />
      )}
      {tagline ? (
        <View style={styles.taglineRow}>
          <View style={[styles.rule, { backgroundColor: theme.accent }]} />
          <ThemedText style={styles.tagline}>Build your best</ThemedText>
          <View style={[styles.rule, { backgroundColor: theme.accent }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 10 },
  taglineRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rule: { width: 30, height: 2 },
  tagline: { fontSize: 15, lineHeight: 20, fontStyle: 'italic', fontWeight: '600', letterSpacing: 5, textTransform: 'uppercase' },
});
