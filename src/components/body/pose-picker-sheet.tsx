import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useMotionPreference } from '@/hooks/use-motion-preference';
import { useTheme } from '@/hooks/use-theme';
import { POSE_LABELS, POSE_ORDER, type BodyPhotoPose } from '@/store/body-store';

export type PosePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (pose: BodyPhotoPose) => void;
};

/** Asks which of the 6 fixed shots (see the instructions card) a new photo
 * is before handing off to the image picker, so every photo can be grouped
 * and compared by pose later. */
export function PosePickerSheet({ visible, onClose, onSelect }: PosePickerSheetProps) {
  const { modalAnimation } = useMotionPreference();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType={modalAnimation('slide')} onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.scrim }]}>
        <GlassSurface swipeToDismiss={onClose} level="overlay" radius={Radius.xlarge} style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Che posa è?</ThemedText>
            <Pressable onPress={onClose} hitSlop={11} accessibilityRole="button" accessibilityLabel="Chiudi">
              <Icon name="close" size={22} color={theme.text} />
            </Pressable>
          </View>
          <View style={{ gap: Spacing.two }}>
            {POSE_ORDER.map((pose) => (
              <Pressable key={pose} onPress={() => onSelect(pose)} style={[styles.option, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small">{POSE_LABELS[pose]}</ThemedText>
                <Icon name="chevronRight" size={16} color={theme.textTertiary} />
              </Pressable>
            ))}
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
  },
});
