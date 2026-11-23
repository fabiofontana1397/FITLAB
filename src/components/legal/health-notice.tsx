import { router } from 'expo-router';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { AI_NOTICE_SHORT, HEALTH_NOTICE_SHORT } from '@/lib/legal/content';

/**
 * The short health disclaimer, shown under plans, workouts, meal tracking and the AI coach (App Store guideline 1.4.1:
 * remind people to check with a doctor). Tapping it opens the full Avvertenza sulla salute.
 */
export function HealthNotice({ variant = 'health', style }: { variant?: 'health' | 'ai'; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/legal', params: { doc: 'disclaimer' } })}
      accessibilityRole="link"
      accessibilityLabel="Avvertenza sulla salute"
      hitSlop={6}
      style={[styles.row, style]}>
      <View style={styles.icon}>
        <Icon name="info" size={14} color={theme.textTertiary} />
      </View>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.text}>
        {variant === 'ai' ? `${AI_NOTICE_SHORT} ` : ''}
        {HEALTH_NOTICE_SHORT}{' '}
        <ThemedText type="caption" style={{ color: theme.accent }}>
          Avvertenza completa
        </ThemedText>
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', paddingVertical: 4 },
  icon: { marginTop: 2 },
  text: { flex: 1 },
});
