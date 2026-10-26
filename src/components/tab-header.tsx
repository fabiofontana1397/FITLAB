import { router, type Href } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { LiquidGlassButton } from '@/components/glass/liquid-glass';
import { ThemedText } from '@/components/themed-text';
import { BrandMark } from '@/components/ui/brand-mark';
import { Icon } from '@/components/ui/icon';
import { ProfileAvatarButton } from '@/components/ui/profile-avatar-button';
import { useTheme } from '@/hooks/use-theme';

/** Below this width everything on the line steps down so the title still fits. */
const NARROW = 360;

export type TabHeaderProps = {
  title: string;
  /** Small grey line under the title (Home: the selected day's full date). */
  subtitle?: string;
  /** Shows the calendar button before notifications and profile; omit it on pages with no calendar. */
  onCalendarPress?: () => void;
};

/**
 * The top bar of every main page, all on one line: the FitLab mark and the
 * page title (with an optional line under it) on the left; on the right, in
 * this order, calendar (when the page has one), notifications and profile.
 */
export function TabHeader({ title, subtitle, onCalendarPress }: TabHeaderProps) {
  const theme = useTheme();
  const narrow = useWindowDimensions().width < NARROW;
  const size = narrow ? 34 : 40;
  const iconSize = narrow ? 17 : 19;
  return (
    <View style={[styles.row, narrow && styles.rowNarrow]}>
      <BrandMark height={narrow ? 20 : 24} />
      <View style={styles.text}>
        <ThemedText style={[styles.title, narrow && styles.titleNarrow]} numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.subtitle, narrow && styles.subtitleNarrow]} themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <View style={[styles.actions, narrow && styles.actionsNarrow]}>
        {onCalendarPress ? (
          <LiquidGlassButton onPress={onCalendarPress} hitSlop={8} scaleTo={0.9} accessibilityLabel="Apri calendario" size={size}>
            <Icon name="calendar" size={iconSize} color={theme.text} />
          </LiquidGlassButton>
        ) : null}
        <LiquidGlassButton onPress={() => router.push('/notification-settings' as Href)} hitSlop={8} scaleTo={0.9} accessibilityLabel="Notifiche" size={size}>
          <Icon name="bell" size={iconSize} color={theme.text} />
        </LiquidGlassButton>
        <ProfileAvatarButton size={size} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  rowNarrow: { gap: 8 },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.4 },
  titleNarrow: { fontSize: 16, lineHeight: 20 },
  subtitle: { fontSize: 13, lineHeight: 17, fontWeight: '400' },
  subtitleNarrow: { fontSize: 12, lineHeight: 16 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionsNarrow: { gap: 6 },
});
