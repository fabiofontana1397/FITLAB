import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ACTIVITY_ICON } from '@/components/training/activity-presentation';
import { ThemedText } from '@/components/themed-text';
import { AppTextInput } from '@/components/ui/app-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { Layout, Radius } from '@/constants/theme';
import { HorizontalScrollDefaults } from '@/constants/scroll';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection, hapticSuccess } from '@/lib/haptics';
import {
  ACTIVITY_INTENSITY_OPTIONS,
  ACTIVITY_TYPE_OPTIONS,
  estimateActivityKcal,
  type ActivityIntensity,
  type ActivityType,
} from '@/lib/nutrition/activity-log';

/** How far the − and + buttons move the duration, the shortest and longest session, and the quick picks. */
const DURATION_STEP = 5;
const DURATION_MIN = 5;
const DURATION_MAX = 360;
/** Shorter names for the tiles, where the full ones would wrap mid-word. */
const TILE_LABEL: Partial<Record<ActivityType, string>> = {
  functional: 'CrossFit',
  boxing: 'Boxe',
  gym: 'Palestra',
  tennis: 'Padel',
  yoga: 'Yoga',
  skiing: 'Sci',
  hiking: 'Trekking',
};
const DURATION_PRESETS = [15, 30, 45, 60, 90];

export type LogActivityModalProps = {
  visible: boolean;
  weightKg: number;
  onClose: () => void;
  onSave: (activityType: ActivityType, intensity: ActivityIntensity, durationMinutes: number) => void;
};

/** "Registra allenamento" as a bottom sheet, like Profilo, Promemoria and
 * "Allenamento registrato": logs any session (planned or not) by type /
 * duration / intensity, estimating its kcal contribution the same MET-based
 * way targets.ts already does for the generated plan's own workouts (see
 * lib/nutrition/activity-log.ts). */
export function LogActivityModal({ visible, weightKg, onClose, onSave }: LogActivityModalProps) {
  return (
    // The sheet animates itself, so the Modal only has to be transparent.
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <LogActivityForm key={visible ? 'open' : 'closed'} weightKg={weightKg} onClose={onClose} onSave={onSave} />
    </Modal>
  );
}

function LogActivityForm({ weightKg, onClose, onSave }: Omit<LogActivityModalProps, 'visible'>) {
  const theme = useTheme();
  // Shorter screens get a smaller hero number, so the page still fits without scrolling.
  const compact = useWindowDimensions().height < 800;
  const [activityType, setActivityType] = useState<ActivityType>('gym');
  const [intensity, setIntensity] = useState<ActivityIntensity>('moderate');
  const [duration, setDuration] = useState('45');

  const durationMinutes = parseInt(duration, 10);
  const isValid = Number.isFinite(durationMinutes) && durationMinutes > 0;
  const estimatedKcal = isValid ? estimateActivityKcal(activityType, intensity, durationMinutes, weightKg || 75) : 0;
  const intensityLabel = ACTIVITY_INTENSITY_OPTIONS.find((o) => o.value === intensity)?.label ?? '';
  const iconOf = (type: ActivityType): IconName => ACTIVITY_ICON[type] ?? 'otherSport';

  const bump = (delta: number) => {
    hapticSelection();
    const base = Number.isFinite(durationMinutes) ? durationMinutes : 0;
    setDuration(String(Math.min(DURATION_MAX, Math.max(DURATION_MIN, base + delta))));
  };

  return (
    <SheetScreen
      title="Registra allenamento"
      onClose={onClose}
      // Always one page: the blocks are sized to the screen's height, nothing scrolls vertically.
      scroll={false}
    >
      {(close) => (
        <View style={styles.page}>
          {/* The calories burned lead the page: one big number, what it is based on in a quiet line under it. */}
          <View style={styles.hero} accessible accessibilityLabel={`${isValid ? estimatedKcal : 0} kcal bruciate`}>
            <View style={styles.heroNumberRow}>
              <ThemedText style={[styles.kcal, compact && styles.kcalCompact]} numberOfLines={1}>
                {isValid ? estimatedKcal.toLocaleString('it-IT') : '—'}
              </ThemedText>
              <ThemedText style={styles.kcalUnit} themeColor="textTertiary">
                kcal
              </ThemedText>
            </View>
            <ThemedText style={styles.heroSub} themeColor="textSecondary" numberOfLines={1}>
              bruciate · {isValid ? `${durationMinutes} min` : '—'} · {intensityLabel.toLowerCase()}
            </ThemedText>
          </View>

          {/* Every sport on one row that scrolls sideways: big round tiles, the picked one inverted. */}
          <View style={styles.block}>
            <ThemedText style={styles.sectionTitle} themeColor="textTertiary" accessibilityRole="header">
              SPORT
            </ThemedText>
            <ScrollView {...HorizontalScrollDefaults} style={styles.sportScroll} contentContainerStyle={styles.sportRow}>
              {ACTIVITY_TYPE_OPTIONS.map((option) => {
                const selected = activityType === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      if (!selected) hapticSelection();
                      setActivityType(option.value);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={option.label}
                    style={({ pressed }) => [styles.sport, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
                  >
                    <View style={[styles.sportDisc, { backgroundColor: selected ? theme.text : theme.backgroundElement }]}>
                      <Icon name={iconOf(option.value)} size={30} strokeWidth={1.6} color={selected ? theme.background : theme.text} />
                    </View>
                    <ThemedText
                      style={[styles.sportLabel, { color: selected ? theme.text : theme.textSecondary }, selected && styles.sportLabelOn]}
                      numberOfLines={1}
                    >
                      {TILE_LABEL[option.value] ?? option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.block}>
            <ThemedText style={styles.sectionTitle} themeColor="textTertiary" accessibilityRole="header">
              INTENSITÀ
            </ThemedText>
            <SegmentedControl options={ACTIVITY_INTENSITY_OPTIONS} value={intensity} onChange={setIntensity} />
          </View>

          <View style={styles.block}>
            <ThemedText style={styles.sectionTitle} themeColor="textTertiary" accessibilityRole="header">
              DURATA
            </ThemedText>
            <FlatCard radius={24} style={styles.durationCard}>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => bump(-DURATION_STEP)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Riduci la durata"
                  style={({ pressed }) => [styles.stepButton, { backgroundColor: theme.backgroundElement, transform: [{ scale: pressed ? 0.92 : 1 }] }]}
                >
                  <Icon name="minus" size={20} color={theme.text} />
                </Pressable>
                <View style={styles.durationField}>
                  <AppTextInput
                    value={duration}
                    onChangeText={(text) => setDuration(text.replace(/[^0-9]/g, '').slice(0, 3))}
                    keyboardType="number-pad"
                    maxLength={3}
                    accessibilityLabel="Durata in minuti"
                    selectTextOnFocus
                    style={[styles.durationInput, { color: theme.text }]}
                    placeholderTextColor={theme.textTertiary}
                  />
                  <ThemedText style={styles.durationUnit} themeColor="textTertiary">
                    min
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => bump(DURATION_STEP)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Aumenta la durata"
                  style={({ pressed }) => [styles.stepButton, { backgroundColor: theme.backgroundElement, transform: [{ scale: pressed ? 0.92 : 1 }] }]}
                >
                  <Icon name="plus" size={20} color={theme.text} />
                </Pressable>
              </View>
              <View style={styles.presets}>
                {DURATION_PRESETS.map((minutes) => {
                  const selected = durationMinutes === minutes;
                  return (
                    <Pressable
                      key={minutes}
                      onPress={() => {
                        if (!selected) hapticSelection();
                        setDuration(String(minutes));
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${minutes} minuti`}
                      style={[styles.preset, { backgroundColor: selected ? theme.text : 'transparent' }]}
                    >
                      <ThemedText style={[styles.presetLabel, { color: selected ? theme.background : theme.textSecondary }]}>{minutes}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </FlatCard>
          </View>

          <PrimaryButton
            label={isValid ? `Salva · ${estimatedKcal.toLocaleString('it-IT')} kcal` : 'Salva allenamento'}
            icon="check"
            disabled={!isValid}
            onPress={() => {
              if (!isValid) return;
              onSave(activityType, intensity, durationMinutes);
              hapticSuccess();
              close();
            }}
          />
        </View>
      )}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  // Everything shares the sheet's height: the blocks keep their size and the gaps give way.
  page: { flex: 1, gap: 14, justifyContent: 'space-between' },
  block: { gap: 10 },
  hero: { alignItems: 'center', paddingTop: 4 },
  heroNumberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  kcal: { fontSize: 64, lineHeight: 72, fontWeight: '300', letterSpacing: -2.5, fontVariant: ['tabular-nums'] },
  kcalCompact: { fontSize: 52, lineHeight: 60, letterSpacing: -2 },
  kcalUnit: { fontSize: 20, lineHeight: 24, fontWeight: '500' },
  heroSub: { marginTop: 2, fontSize: 14, lineHeight: 19, fontWeight: '500' },
  sectionTitle: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 1 },
  // The row runs to the sheet's edges, so the tiles slide out of view instead of being clipped by the padding.
  sportScroll: { marginHorizontal: -Layout.screenGutter, flexGrow: 0 },
  sportRow: { paddingHorizontal: Layout.screenGutter, gap: 6 },
  sport: { width: 76, alignItems: 'center', gap: 6 },
  sportDisc: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  sportLabel: { fontSize: 12, lineHeight: 16, fontWeight: '500', textAlign: 'center' },
  sportLabelOn: { fontWeight: '600' },
  durationCard: { padding: 12, gap: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  durationField: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4 },
  durationInput: {
    minWidth: 64,
    padding: 0,
    textAlign: 'center',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '300',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  durationUnit: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  presets: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  preset: { flex: 1, alignItems: 'center', borderRadius: Radius.pill, paddingVertical: 7 },
  presetLabel: { fontSize: 14, lineHeight: 19, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
