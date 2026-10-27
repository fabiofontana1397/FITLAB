import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ACTIVITY_CATEGORY, ACTIVITY_ICON } from '@/components/training/activity-presentation';
import { ThemedText } from '@/components/themed-text';
import { AppTextInput } from '@/components/ui/app-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { Layout, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection, hapticSuccess } from '@/lib/haptics';
import { ACTIVITY_INTENSITY_OPTIONS, ACTIVITY_TYPE_OPTIONS, estimateActivityKcal, type ActivityIntensity, type ActivityType } from '@/lib/nutrition/activity-log';

/** The tile beside the title: the chosen activity's glyph in the training green. */
const TILE = 64;
/** How far the − and + buttons move the duration, the shortest and longest session, and the quick picks. */
const DURATION_STEP = 5;
const DURATION_MIN = 5;
const DURATION_MAX = 360;
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
      eyebrow="Stima le calorie bruciate"
      onClose={onClose}
      leading={
        <View style={[styles.tile, { backgroundColor: theme.brandGreen + '1F' }]}>
          <Icon name={iconOf(activityType)} size={34} color={theme.brandGreen} />
        </View>
      }>
      {(close) => (
        <>
          <FlatCard radius={24} style={styles.hero}>
            <View style={[styles.flame, { backgroundColor: theme.accentSoft }]}>
              <Icon name="flame" size={26} color={theme.accent} />
            </View>
            <ThemedText style={styles.kcal} accessibilityLabel={`${estimatedKcal} kcal stimate`}>
              {isValid ? estimatedKcal : '—'}
            </ThemedText>
            <ThemedText style={styles.kcalUnit} themeColor="textSecondary">
              kcal stimate
            </ThemedText>

            <View style={[styles.rule, { backgroundColor: theme.border }]} />

            <View style={styles.stats}>
              <Stat icon="clock" label="Durata" value={isValid ? `${durationMinutes} min` : '—'} />
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <Stat icon="gauge" label="Intensità" value={intensityLabel} />
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <Stat icon={iconOf(activityType)} label="Attività" value={ACTIVITY_CATEGORY[activityType]} />
            </View>
          </FlatCard>

          <FlatCard radius={24} style={styles.section}>
            <ThemedText style={styles.sectionTitle} accessibilityRole="header">
              Tipo di allenamento
            </ThemedText>
            <View style={styles.grid}>
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
                    style={[
                      styles.typeTile,
                      { backgroundColor: selected ? theme.brandGreen + '1F' : theme.backgroundElement, borderColor: selected ? theme.brandGreen : 'transparent' },
                    ]}>
                    <Icon name={iconOf(option.value)} size={26} color={selected ? theme.brandGreen : theme.textSecondary} />
                    <ThemedText style={[styles.typeLabel, { color: selected ? theme.text : theme.textSecondary }]} numberOfLines={2}>
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </FlatCard>

          <FlatCard radius={24} style={styles.section}>
            <ThemedText style={styles.sectionTitle} accessibilityRole="header">
              Intensità
            </ThemedText>
            <SegmentedControl options={ACTIVITY_INTENSITY_OPTIONS} value={intensity} onChange={setIntensity} />
          </FlatCard>

          <FlatCard radius={24} style={styles.section}>
            <ThemedText style={styles.sectionTitle} accessibilityRole="header">
              Durata
            </ThemedText>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => bump(-DURATION_STEP)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Riduci la durata"
                style={[styles.stepButton, { backgroundColor: theme.backgroundElement }]}>
                <Icon name="minus" size={26} color={theme.text} />
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
                <ThemedText style={styles.durationUnit} themeColor="textSecondary">
                  minuti
                </ThemedText>
              </View>
              <Pressable
                onPress={() => bump(DURATION_STEP)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Aumenta la durata"
                style={[styles.stepButton, { backgroundColor: theme.backgroundElement }]}>
                <Icon name="plus" size={26} color={theme.text} />
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
                    style={[styles.preset, { backgroundColor: selected ? theme.accent : theme.backgroundElement }]}>
                    <ThemedText style={[styles.presetLabel, { color: selected ? theme.onAccent : theme.text }]}>{minutes} min</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </FlatCard>

          <View style={styles.note}>
            <Icon name="info" size={20} color={theme.textTertiary} />
            <ThemedText style={styles.noteText} themeColor="textSecondary">
              Il consumo calorico è una stima e può variare in base a peso, ritmo e percorso.
            </ThemedText>
          </View>

          <PrimaryButton
            label="Salva allenamento"
            icon="check"
            disabled={!isValid}
            onPress={() => {
              if (!isValid) return;
              onSave(activityType, intensity, durationMinutes);
              hapticSuccess();
              close();
            }}
          />
        </>
      )}
    </SheetScreen>
  );
}

function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={26} color={theme.textTertiary} />
      <ThemedText style={styles.statLabel} themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    padding: Layout.cardPadding,
  },
  flame: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kcal: {
    marginTop: Spacing.two,
    fontSize: 64,
    lineHeight: 72,
    fontWeight: '800',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  kcalUnit: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
  },
  rule: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.three,
  },
  stats: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    lineHeight: 21,
    textAlign: 'center',
    fontWeight: '700',
  },
  section: {
    padding: Layout.cardPadding,
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  typeTile: {
    width: '31.5%',
    flexGrow: 1,
    minHeight: 84,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  typeLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationField: {
    alignItems: 'center',
  },
  durationInput: {
    minWidth: 110,
    padding: 0,
    textAlign: 'center',
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  durationUnit: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  preset: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
  },
  presetLabel: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  note: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: 4,
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
