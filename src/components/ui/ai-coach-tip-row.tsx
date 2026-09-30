import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AiCoachTipRowProps = {
  tip: string;
};

/** A short contextual nudge toward the real AI chat, shown at the bottom
 * of a meal/exercise card. Tapping it opens the same chat the FAB does —
 * not a canned reply rendered inline — so the "coach" framing stays
 * honest about what's actually AI-generated versus a static prompt. */
export function AiCoachTipRow({ tip }: AiCoachTipRowProps) {
  const theme = useTheme();
  return (
    <Pressable onPress={() => router.push('/chat')} style={[styles.row, { borderTopColor: theme.border }]}>
      <Icon name="bulb" size={14} color={theme.accent} />
      <ThemedText type="caption" themeColor="textSecondary" style={{ flex: 1 }} numberOfLines={2}>
        {tip}
      </ThemedText>
      <Icon name="chevronRight" size={14} color={theme.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
