import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ACTIVITY_INTENSITY_OPTIONS, ACTIVITY_TYPE_OPTIONS, estimateActivityKcal, type ActivityIntensity, type ActivityType } from '@/lib/nutrition/activity-log';

const SHEET_MAX_WIDTH = 440;

export type LogActivityModalProps = {
  visible: boolean;
  weightKg: number;
  onClose: () => void;
  onSave: (activityType: ActivityType, intensity: ActivityIntensity, durationMinutes: number) => void;
};

/** Bottom-sheet quick-entry for "Aggiungi allenamento" — logs any session
 * (planned or not) by type/duration/intensity, estimating its kcal
 * contribution the same MET-based way targets.ts already does for the
 * generated plan's own workouts (see lib/nutrition/activity-log.ts). */
export function LogActivityModal({ visible, weightKg, onClose, onSave }: LogActivityModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <GlassSurface level="overlay" radius={Radius.xlarge} style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
          <LogActivityForm key={visible ? 'open' : 'closed'} theme={theme} weightKg={weightKg} onClose={onClose} onSave={onSave} />
        </GlassSurface>
      </View>
    </Modal>
  );
}

function LogActivityForm({
  theme,
  weightKg,
  onClose,
  onSave,
}: {
  theme: ReturnType<typeof useTheme>;
  weightKg: number;
  onClose: () => void;
  onSave: (activityType: ActivityType, intensity: ActivityIntensity, durationMinutes: number) => void;
}) {
  const [activityType, setActivityType] = useState<ActivityType>('gym');
  const [intensity, setIntensity] = useState<ActivityIntensity>('moderate');
  const [duration, setDuration] = useState('45');

  const durationMinutes = parseInt(duration, 10);
  const isValid = Number.isFinite(durationMinutes) && durationMinutes > 0;
  const estimatedKcal = isValid ? estimateActivityKcal(activityType, intensity, durationMinutes, weightKg || 75) : 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave(activityType, intensity, durationMinutes);
    onClose();
  };

  return (
    <>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText type="subtitle">Aggiungi allenamento</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Stima le calorie bruciate in base a tipo, durata e intensità
          </ThemedText>
        </View>
        <Pressable onPress={onClose} hitSlop={8}>
          <Icon name="close" size={22} color={theme.text} />
        </Pressable>
      </View>

      <View style={{ gap: Spacing.two }}>
        <ThemedText type="label" themeColor="textSecondary">
          Tipo di allenamento
        </ThemedText>
        <View style={styles.chipsRow}>
          {ACTIVITY_TYPE_OPTIONS.map((option) => {
            const selected = activityType === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setActivityType(option.value)}
                style={[styles.chip, { backgroundColor: selected ? theme.accent : theme.backgroundElement, borderColor: selected ? theme.accent : theme.border }]}>
                <ThemedText type="caption" style={{ color: selected ? theme.onAccent : theme.text, fontWeight: '600' }}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: Spacing.two, marginTop: Spacing.three }}>
        <ThemedText type="label" themeColor="textSecondary">
          Intensità
        </ThemedText>
        <View style={styles.chipsRow}>
          {ACTIVITY_INTENSITY_OPTIONS.map((option) => {
            const selected = intensity === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setIntensity(option.value)}
                style={[styles.chip, { backgroundColor: selected ? theme.accent : theme.backgroundElement, borderColor: selected ? theme.accent : theme.border }]}>
                <ThemedText type="caption" style={{ color: selected ? theme.onAccent : theme.text, fontWeight: '600' }}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.inputGroup, { marginTop: Spacing.three }]}>
        <ThemedText type="label" themeColor="textSecondary">
          Durata (minuti)
        </ThemedText>
        <TextInput
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
          placeholderTextColor={theme.textTertiary}
        />
      </View>

      <View style={[styles.estimateRow, { backgroundColor: theme.accentSoft }]}>
        <Icon name="training" size={18} color={theme.accent} />
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          Stima: ~{estimatedKcal} kcal
        </ThemedText>
      </View>

      <PrimaryButton label="Salva allenamento" icon="check" onPress={handleSave} disabled={!isValid} style={{ marginTop: Spacing.four }} />
    </>
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
    alignItems: 'flex-start',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
  },
  inputGroup: {
    gap: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    marginTop: Spacing.four,
  },
});
