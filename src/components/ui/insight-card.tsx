import { StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type InsightTone = 'positive' | 'warning' | 'neutral';

export type InsightCardProps = {
  icon?: IconName;
  tone?: InsightTone;
  headline: string;
  body: string;
};

export function InsightCard({ icon = 'sparkle', tone = 'neutral', headline, body }: InsightCardProps) {
  const theme = useTheme();
  const toneColor = tone === 'positive' ? theme.success : tone === 'warning' ? theme.warning : theme.accent;

  return (
    <GlassSurface level="card" radius={Radius.large} style={styles.wrapper}>
      <View style={[styles.accentBar, { backgroundColor: toneColor }]} />
      <View style={styles.body}>
        <View style={styles.iconBubble}>
          <Icon name={icon} size={20} color={theme.text} />
        </View>
        <View style={styles.textCol}>
          <ThemedText type="smallBold">{headline}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.bodyText}>
            {body}
          </ThemedText>
        </View>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    alignItems: 'flex-start',
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  bodyText: {
    marginTop: 2,
  },
});
