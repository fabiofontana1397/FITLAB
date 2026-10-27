import { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

import {
  ACTIVITY_CATEGORY,
  ACTIVITY_ICON,
} from "@/components/training/activity-presentation";
import { ThemedText } from "@/components/themed-text";
import { AppTextInput } from "@/components/ui/app-text";
import { FlatCard } from "@/components/ui/flat-card";
import { Icon, type IconName } from "@/components/ui/icon";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SheetScreen } from "@/components/ui/sheet-screen";
import { Layout, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { hapticSelection, hapticSuccess } from "@/lib/haptics";
import {
  ACTIVITY_INTENSITY_OPTIONS,
  ACTIVITY_TYPE_OPTIONS,
  estimateActivityKcal,
  type ActivityIntensity,
  type ActivityType,
} from "@/lib/nutrition/activity-log";

/** The tile beside the title: the chosen activity's glyph in the training green. */
const TILE = 52;
/** How far the − and + buttons move the duration, the shortest and longest session, and the quick picks. */
const DURATION_STEP = 5;
const DURATION_MIN = 5;
const DURATION_MAX = 360;
const DURATION_PRESETS = [15, 30, 45, 60, 90];

export type LogActivityModalProps = {
  visible: boolean;
  weightKg: number;
  onClose: () => void;
  onSave: (
    activityType: ActivityType,
    intensity: ActivityIntensity,
    durationMinutes: number,
  ) => void;
};

/** "Registra allenamento" as a bottom sheet, like Profilo, Promemoria and
 * "Allenamento registrato": logs any session (planned or not) by type /
 * duration / intensity, estimating its kcal contribution the same MET-based
 * way targets.ts already does for the generated plan's own workouts (see
 * lib/nutrition/activity-log.ts). */
export function LogActivityModal({
  visible,
  weightKg,
  onClose,
  onSave,
}: LogActivityModalProps) {
  return (
    // The sheet animates itself, so the Modal only has to be transparent.
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <LogActivityForm
        key={visible ? "open" : "closed"}
        weightKg={weightKg}
        onClose={onClose}
        onSave={onSave}
      />
    </Modal>
  );
}

function LogActivityForm({
  weightKg,
  onClose,
  onSave,
}: Omit<LogActivityModalProps, "visible">) {
  const theme = useTheme();
  const [activityType, setActivityType] = useState<ActivityType>("gym");
  const [intensity, setIntensity] = useState<ActivityIntensity>("moderate");
  const [duration, setDuration] = useState("45");

  const durationMinutes = parseInt(duration, 10);
  const isValid = Number.isFinite(durationMinutes) && durationMinutes > 0;
  const estimatedKcal = isValid
    ? estimateActivityKcal(
        activityType,
        intensity,
        durationMinutes,
        weightKg || 75,
      )
    : 0;
  const intensityLabel =
    ACTIVITY_INTENSITY_OPTIONS.find((o) => o.value === intensity)?.label ?? "";
  const iconOf = (type: ActivityType): IconName =>
    ACTIVITY_ICON[type] ?? "otherSport";

  const bump = (delta: number) => {
    hapticSelection();
    const base = Number.isFinite(durationMinutes) ? durationMinutes : 0;
    setDuration(
      String(Math.min(DURATION_MAX, Math.max(DURATION_MIN, base + delta))),
    );
  };

  return (
    <SheetScreen
      title="Registra allenamento"
      eyebrow="Stima le calorie bruciate"
      onClose={onClose}
      // One page on any normal phone; only a very short screen falls back to scrolling.
      scroll={useWindowDimensions().height < 740}
      leading={
        <View
          style={[styles.tile, { backgroundColor: theme.brandGreen + "1F" }]}
        >
          <Icon
            name={iconOf(activityType)}
            size={28}
            color={theme.brandGreen}
          />
        </View>
      }
    >
      {(close) => (
        <View style={styles.page}>
          {/* The estimate leads: kcal on the left, what it is based on on the right. */}
          <FlatCard radius={22} style={styles.hero}>
            <View style={[styles.flame, { backgroundColor: theme.accentSoft }]}>
              <Icon name="flame" size={24} color={theme.accent} />
            </View>
            <View style={styles.heroKcal}>
              <ThemedText
                style={styles.kcal}
                accessibilityLabel={`${estimatedKcal} kcal stimate`}
              >
                {isValid ? estimatedKcal : "—"}
              </ThemedText>
              <ThemedText style={styles.kcalUnit} themeColor="textSecondary">
                kcal stimate
              </ThemedText>
            </View>
            <View style={styles.heroFacts}>
              <ThemedText style={styles.fact} numberOfLines={1}>
                {ACTIVITY_CATEGORY[activityType]}
              </ThemedText>
              <ThemedText
                style={styles.factSub}
                themeColor="textSecondary"
                numberOfLines={1}
              >
                {isValid ? `${durationMinutes} min` : "—"} · {intensityLabel}
              </ThemedText>
            </View>
          </FlatCard>

          <View style={styles.block}>
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
                      {
                        backgroundColor: selected
                          ? theme.brandGreen + "1F"
                          : theme.backgroundElevated,
                        borderColor: selected
                          ? theme.brandGreen
                          : "transparent",
                      },
                    ]}
                  >
                    <Icon
                      name={iconOf(option.value)}
                      size={22}
                      color={selected ? theme.brandGreen : theme.textSecondary}
                    />
                    <ThemedText
                      style={[
                        styles.typeLabel,
                        { color: selected ? theme.text : theme.textSecondary },
                      ]}
                      numberOfLines={2}
                    >
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.block}>
            <ThemedText style={styles.sectionTitle} accessibilityRole="header">
              Intensità
            </ThemedText>
            <SegmentedControl
              options={ACTIVITY_INTENSITY_OPTIONS}
              value={intensity}
              onChange={setIntensity}
            />
          </View>

          <View style={styles.block}>
            <ThemedText style={styles.sectionTitle} accessibilityRole="header">
              Durata
            </ThemedText>
            <FlatCard radius={22} style={styles.durationCard}>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => bump(-DURATION_STEP)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Riduci la durata"
                  style={[
                    styles.stepButton,
                    { backgroundColor: theme.backgroundElement },
                  ]}
                >
                  <Icon name="minus" size={22} color={theme.text} />
                </Pressable>
                <View style={styles.durationField}>
                  <AppTextInput
                    value={duration}
                    onChangeText={(text) =>
                      setDuration(text.replace(/[^0-9]/g, "").slice(0, 3))
                    }
                    keyboardType="number-pad"
                    maxLength={3}
                    accessibilityLabel="Durata in minuti"
                    selectTextOnFocus
                    style={[styles.durationInput, { color: theme.text }]}
                    placeholderTextColor={theme.textTertiary}
                  />
                  <ThemedText
                    style={styles.durationUnit}
                    themeColor="textSecondary"
                  >
                    minuti
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => bump(DURATION_STEP)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Aumenta la durata"
                  style={[
                    styles.stepButton,
                    { backgroundColor: theme.backgroundElement },
                  ]}
                >
                  <Icon name="plus" size={22} color={theme.text} />
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
                      style={[
                        styles.preset,
                        {
                          backgroundColor: selected
                            ? theme.accent
                            : theme.backgroundElement,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.presetLabel,
                          { color: selected ? theme.onAccent : theme.text },
                        ]}
                      >
                        {minutes}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </FlatCard>
          </View>

          <View style={styles.footer}>
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
            <ThemedText style={styles.noteText} themeColor="textTertiary">
              Stima indicativa: varia con peso, ritmo e percorso.
            </ThemedText>
          </View>
        </View>
      )}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  // Everything shares the sheet's height: the blocks keep their size and the gaps give way.
  page: { flex: 1, gap: 12, justifyContent: "space-between" },
  block: { gap: 8 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: Layout.cardPadding,
  },
  flame: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  heroKcal: { flexShrink: 0 },
  kcal: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  kcalUnit: { fontSize: 13, lineHeight: 16, fontWeight: "500" },
  heroFacts: { flex: 1, minWidth: 0, alignItems: "flex-end", gap: 2 },
  fact: { fontSize: 15, lineHeight: 20, fontWeight: "700", textAlign: "right" },
  factSub: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "500",
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeTile: {
    width: "23.5%",
    flexGrow: 1,
    height: 62,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 4,
  },
  typeLabel: {
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  durationCard: { padding: 12, gap: 10 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  durationField: { alignItems: "center" },
  durationInput: {
    minWidth: 100,
    padding: 0,
    textAlign: "center",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  durationUnit: { fontSize: 13, lineHeight: 16, fontWeight: "500" },
  presets: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  preset: {
    flex: 1,
    alignItems: "center",
    borderRadius: Radius.pill,
    paddingVertical: 7,
  },
  presetLabel: { fontSize: 14, lineHeight: 19, fontWeight: "600" },
  footer: { gap: 6 },
  noteText: { fontSize: 12, lineHeight: 16, textAlign: "center" },
});
