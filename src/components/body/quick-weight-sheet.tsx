import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppTextInput } from '@/components/ui/app-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type QuickWeightSheetProps = {
  visible: boolean;
  currentWeightKg: number;
  onClose: () => void;
  onSave: (weightKg: number) => void;
};

export function QuickWeightSheet({ visible, currentWeightKg, onClose, onSave }: QuickWeightSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(String(currentWeightKg));

  const handleSave = () => {
    const num = parseFloat(value.replace(',', '.'));
    if (!Number.isFinite(num) || num <= 0) return;
    onSave(num);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setValue(String(currentWeightKg))}>
      <View style={styles.backdrop}>
        <GlassSurface level="overlay" radius={Radius.xlarge} style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Peso di oggi</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="close" size={22} color={theme.text} />
            </Pressable>
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
              kg
            </ThemedText>
          </View>
          <PrimaryButton label="Salva" onPress={handleSave} />
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
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
