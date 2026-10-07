import { Pressable, StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type InfoPopoverProps = {
  visible: boolean;
  icon: IconName;
  title: string;
  body: string;
  onClose: () => void;
};

/** A small generic explainer — icon + title + one paragraph — for "what does
 * this number mean" taps on a metric or chart, shown as a centered glass
 * popup with the rest of the screen blurred. */
export function InfoPopover({ visible, icon, title, body, onClose }: InfoPopoverProps) {
  const theme = useTheme();
  return (
    <GlassPopup visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <View style={[styles.iconBadge, { backgroundColor: theme.accentSoft }]}>
          <Icon name={icon} size={18} color={theme.accent} />
        </View>
        <ThemedText type="subtitle" style={{ flex: 1 }}>
          {title}
        </ThemedText>
        <Pressable onPress={onClose} hitSlop={8}>
          <Icon name="close" size={22} color={theme.text} />
        </Pressable>
      </View>
      <ThemedText type="default" themeColor="textSecondary" style={styles.body}>
        {body}
      </ThemedText>
    </GlassPopup>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    lineHeight: 21,
  },
});
