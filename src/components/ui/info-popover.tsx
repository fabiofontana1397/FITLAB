import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SHEET_MAX_WIDTH = 440;

export type InfoPopoverProps = {
  visible: boolean;
  icon: IconName;
  title: string;
  body: string;
  onClose: () => void;
};

/** A small generic explainer sheet — icon + title + one paragraph — for
 * "what does this number mean" taps on a metric or chart, without the
 * weight of a full feature-specific modal. */
export function InfoPopover({ visible, icon, title, body, onClose }: InfoPopoverProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <GlassSurface
          level="overlay"
          radius={Radius.xlarge}
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
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
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
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
