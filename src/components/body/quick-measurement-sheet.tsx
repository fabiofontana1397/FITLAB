import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { GlassCloseButton } from '@/components/glass/liquid-glass';
import { AppTextInput } from '@/components/ui/app-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useMotionPreference } from '@/hooks/use-motion-preference';
import { useTheme } from '@/hooks/use-theme';
import { hapticSuccess } from '@/lib/haptics';

export type QuickMeasurementSheetProps = {
  visible: boolean;
  label: string;
  currentValueCm: number;
  onClose: () => void;
  onSave: (valueCm: number) => void;
};

/** Same small bottom-sheet pattern as QuickWeightSheet, generalized to any
 * cm measurement (Spalle, Petto, Bicipite, Vita, Fianchi, Coscia). */
export function QuickMeasurementSheet({ visible, label, currentValueCm, onClose, onSave }: QuickMeasurementSheetProps) {
  const { modalAnimation } = useMotionPreference();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(String(currentValueCm));

  const handleSave = () => {
    const num = parseFloat(value.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) return;
    onSave(num);
    hapticSuccess();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={modalAnimation('slide')}
      onRequestClose={onClose}
      onShow={() => setValue(String(currentValueCm))}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.backdrop, { backgroundColor: theme.scrim }]}>
        <GlassSurface swipeToDismiss={onClose} level="overlay" radius={Radius.xlarge} style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Nuova misura: {label}</ThemedText>
            <GlassCloseButton onPress={onClose} />
          </View>
          <View style={styles.inputRow}>
            <AppTextInput
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              autoFocus
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: 'transparent' }]}
            />
            <ThemedText type="title" themeColor="textSecondary">
              cm
            </ThemedText>
          </View>
          <PrimaryButton label="Salva" onPress={handleSave} />
        </GlassSurface>
      </View>
    </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    // Flush with the bottom edge, like every other popup.
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  input: {
    fontSize: 48,
    fontWeight: '700',
    borderBottomWidth: 2,
    minWidth: 140,
    textAlign: 'center',
    paddingVertical: 4,
  },
});
