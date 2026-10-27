import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BrandMark } from '@/components/ui/brand-mark';
import { useTheme } from '@/hooks/use-theme';

/** The FitLab logo for the welcome screen: the "F" mark optionally with the "FITLAB" name and the "Build your best" tagline between two orange rules. */
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
  return (
    <View style={[styles.root, style]}>
      <View style={styles.nameRow}>
        <BrandMark height={name ? height * 0.72 : height} />
        {name ? <ThemedText style={[styles.name, { fontSize: height * 0.95, lineHeight: height * 1.1 }]}>FITLAB</ThemedText> : null}
      </View>
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontStyle: 'italic', fontWeight: '900', letterSpacing: -1.5 },
  taglineRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rule: { width: 30, height: 2 },
  tagline: { fontSize: 15, lineHeight: 20, fontStyle: 'italic', fontWeight: '600', letterSpacing: 5, textTransform: 'uppercase' },
});
