import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { GlassSurface } from '@/components/glass/glass-surface';
import { EditAnswersSheet } from '@/components/profile/edit-answers-sheet';
import { IntegrationsSection } from '@/components/profile/integrations-section';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { FadeInView } from '@/components/ui/fade-in-view';
import { Icon, type IconName } from '@/components/ui/icon';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Radius, Spacing } from '@/constants/theme';
import { useAnswersEditor, type SaveOutcome } from '@/hooks/use-answers-editor';
import { useTheme } from '@/hooks/use-theme';
import { latestSnapshot } from '@/lib/mock/body';
import { sportIcon, sportMeta } from '@/lib/mock';
import { goBackOr } from '@/lib/navigation/go-back';
import {
  answerText,
  findGroup,
  groupsForMode,
  mealTimeline,
  summaryRows,
  type ProfileGroup,
  type SummaryRow,
} from '@/lib/questionnaire/profile-sections';
import type { OnboardingMode } from '@/lib/questionnaire/schema';
import { useAppStore, type AppearanceMode } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { useBodyStore } from '@/store/body-store';
import { useOnboardingStore, type AnswerValue } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';
import { useUserStore } from '@/store/user-store';

const GOAL_LABEL: Record<string, string> = {
  loseFat: 'Perdere grasso',
  gainMuscle: 'Aumentare massa muscolare',
  maintainImprove: 'Mantenimento e forma fisica',
  gainStrength: 'Aumentare forza',
  improveEndurance: 'Migliorare resistenza',
  generalHealth: 'Salute generale',
};

const MODE_LABEL: Record<OnboardingMode, string> = {
  diet: 'Piano alimentare',
  training: 'Programma di allenamento',
  both: 'Piano alimentare + allenamento',
};

const APPEARANCE_OPTIONS: { value: AppearanceMode; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Chiaro' },
  { value: 'dark', label: 'Scuro' },
];

const AVATAR_SIZE = 88;

export default function ProfileScreen() {
  const theme = useTheme();
  const currentUser = useUserStore();
  const setAvatarUri = useUserStore((s) => s.setAvatarUri);
  const answers = useOnboardingStore((s) => s.answers);
  const bodyEntries = useBodyStore((s) => s.entries);
  const isGenerating = usePlanStore((s) => s.isGenerating);
  const appearance = useAppStore((s) => s.appearance);
  const setAppearance = useAppStore((s) => s.setAppearance);
  const setHasOnboarded = useAppStore((s) => s.setHasOnboarded);
  const logout = useAuthStore((s) => s.logout);
  const saveAnswers = useAnswersEditor();

  const [editing, setEditing] = useState<ProfileGroup | null>(null);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [saving, setSaving] = useState(false);

  // The save feedback stays until the plans are rebuilt, then fades after a few seconds.
  useEffect(() => {
    if (!outcome || isGenerating) return;
    const t = setTimeout(() => setOutcome(null), 6000);
    return () => clearTimeout(t);
  }, [outcome, isGenerating]);

  const mode: OnboardingMode = (answers.mode as OnboardingMode | undefined) ?? 'both';
  const groups = groupsForMode(mode);
  const latestWeight = latestSnapshot(bodyEntries).weightKg;
  const weightKg = latestWeight > 0 ? latestWeight : Number(answers.currentWeightKg) || 0;
  const toGoal = currentUser.targetWeightKg > 0 && weightKg > 0 ? Math.round((currentUser.targetWeightKg - weightKg) * 10) / 10 : null;
  const sexLabel = answerText('sex', answers);

  const restartOnboarding = () => {
    setHasOnboarded(false);
    router.replace('/onboarding');
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/welcome');
  };

  const pickPhoto = async (source: 'library' | 'camera') => {
    setPhotoMenuOpen(false);
    const permission =
      source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.35, base64: true };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    // Kept as a data: URI so the photo survives restarts (the picker's file:// is a temporary cache file).
    setAvatarUri(asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri);
  };

  const onAvatarPress = () => {
    if (!currentUser.avatarUri && Platform.OS === 'web') void pickPhoto('library');
    else setPhotoMenuOpen(true);
  };

  const onSave = (group: ProfileGroup, draft: Record<string, AnswerValue>) => {
    setEditing(null);
    setSaving(true);
    // The impact check runs the plan engine twice (a few hundred ms): let the sheet close first.
    setTimeout(() => {
      setOutcome(saveAnswers(group, draft));
      setSaving(false);
    }, 60);
  };

  // spec §0.3/§4.1 bis, "initial_estimate vs current_target": once the
  // Adaptive Nutrition Engine has actually nudged the live target away from
  // what the questionnaire first computed, show both instead of only the
  // current one — otherwise the correction is invisible to the user.
  const initialEstimate = currentUser.initialEstimate;
  const hasAdaptedCalories = initialEstimate != null && initialEstimate.calories !== currentUser.dailyCalorieTarget;

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <ThemedText type="title">Profilo</ThemedText>
        <Pressable onPress={() => goBackOr('/')} hitSlop={8}>
          <GlassSurface level="card" radius={Radius.pill} style={styles.closeButton}>
            <View style={styles.closeInner}>
              <Icon name="close" size={18} color={theme.text} />
            </View>
          </GlassSurface>
        </Pressable>
      </View>

      <GlassSurface level="raised" radius={Radius.xlarge} style={styles.identityCard}>
        <View style={styles.identityTop}>
          <Pressable onPress={onAvatarPress} accessibilityRole="button" accessibilityLabel="Cambia foto profilo">
            <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
              {currentUser.avatarUri ? (
                <Image source={{ uri: currentUser.avatarUri }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <ThemedText type="display" style={{ color: theme.accent }}>
                  {currentUser.name.charAt(0).toUpperCase() || '?'}
                </ThemedText>
              )}
            </View>
            <View style={[styles.cameraBadge, { backgroundColor: theme.accent, borderColor: theme.backgroundElevated }]}>
              <Icon name="camera" size={14} color={theme.onAccent} />
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <ThemedText type="title" numberOfLines={1}>
              {currentUser.name || 'Il tuo profilo'}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {[currentUser.age > 0 ? `${currentUser.age} anni` : null, sexLabel].filter(Boolean).join(' · ') || 'Completa i tuoi dati'}
            </ThemedText>
          </View>
          <Pressable onPress={() => setEditing(findGroup('identity'))} hitSlop={8} accessibilityLabel="Modifica profilo">
            <View style={[styles.editButton, { backgroundColor: theme.backgroundElement }]}>
              <Icon name="edit" size={17} color={theme.text} />
            </View>
          </Pressable>
        </View>

        <View style={[styles.goalBanner, { backgroundColor: theme.accentSoft }]}>
          <Icon name="target" size={18} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <ThemedText type="caption" themeColor="textSecondary">
              Obiettivo
            </ThemedText>
            <ThemedText type="smallBold">{GOAL_LABEL[currentUser.goal]}</ThemedText>
          </View>
          {toGoal != null && toGoal !== 0 ? (
            <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '700' }}>
              {toGoal > 0 ? '+' : '−'}
              {Math.abs(toGoal).toLocaleString('it-IT')} kg al traguardo
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <StatBox icon="ruler" label="Altezza" value={currentUser.heightCm > 0 ? `${currentUser.heightCm}` : '—'} unit="cm" />
          <StatBox icon="scale" label="Peso" value={weightKg > 0 ? weightKg.toLocaleString('it-IT') : '—'} unit="kg" />
          <StatBox
            icon="trophy"
            label="Traguardo"
            value={currentUser.targetWeightKg > 0 ? currentUser.targetWeightKg.toLocaleString('it-IT') : '—'}
            unit={currentUser.targetWeightKg > 0 ? 'kg' : undefined}
          />
        </View>

        <View style={{ gap: Spacing.two }}>
          <ThemedText type="caption" themeColor="textSecondary">
            Sport praticati
          </ThemedText>
          <View style={styles.chipsWrap}>
            {currentUser.sports.length === 0 ? (
              <ThemedText type="caption" themeColor="textTertiary">
                Nessuno: hai scelto un piano solo alimentare.
              </ThemedText>
            ) : null}
            {currentUser.sports.map((sport) => {
              const freq = answerText(`freq_${sport}`, answers);
              return (
                <Pressable key={sport} onPress={() => setEditing(findGroup('training'))}>
                  <View style={[styles.sportChip, { backgroundColor: theme.backgroundElement }]}>
                    <Icon name={sportIcon[sport]} size={16} color={theme.accent} />
                    <ThemedText type="caption" style={{ fontWeight: '700' }}>
                      {sportMeta[sport].label}
                    </ThemedText>
                    {freq ? (
                      <ThemedText type="caption" themeColor="textSecondary">
                        {freq.replace(' a settimana', '/sett.')}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </GlassSurface>

      <View>
        <SectionHeader title="Aspetto" />
        <SegmentedControl options={APPEARANCE_OPTIONS} value={appearance} onChange={setAppearance} />
      </View>

      <View style={{ gap: Spacing.three }}>
        <View style={{ gap: 4 }}>
          <ThemedText type="subtitle">Il tuo questionario</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Le risposte da cui nascono i tuoi piani. Modificale quando cambia qualcosa: aggiorniamo i piani solo se serve.
          </ThemedText>
        </View>

        {outcome || saving ? (
          <FadeInView>
            <GlassSurface level="subtle" radius={Radius.large} style={styles.outcome}>
              {saving || isGenerating || !outcome ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : (
                <Icon name="checkCircle" size={18} color={outcome.diet || outcome.training ? theme.accent : theme.success} />
              )}
              <ThemedText type="caption" style={{ flex: 1 }}>
                {saving || !outcome ? 'Controllo cosa cambia nei tuoi piani…' : isGenerating ? 'Aggiornamento dei piani in corso…' : outcome.message}
              </ThemedText>
            </GlassSurface>
          </FadeInView>
        ) : null}

        <View style={[styles.modeRow, { borderColor: theme.border }]}>
          <Icon name="sparkle" size={16} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <ThemedText type="caption" themeColor="textSecondary">
              Percorso
            </ThemedText>
            <ThemedText type="smallBold">{MODE_LABEL[mode]}</ThemedText>
          </View>
          <Pressable onPress={restartOnboarding} hitSlop={8}>
            <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '700' }}>
              Cambia
            </ThemedText>
          </Pressable>
        </View>

        {groups.map((group) => (
          <GroupCard key={group.id} group={group} answers={answers} onEdit={() => setEditing(group)} />
        ))}
      </View>

      <View>
        <SectionHeader title="Obiettivi nutrizionali" />
        <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Row label={hasAdaptedCalories ? 'Target attuale' : 'Calorie giornaliere'} value={`${currentUser.dailyCalorieTarget} kcal`} />
          {hasAdaptedCalories ? (
            <Row label="Stima iniziale (questionario)" value={`${initialEstimate.calories} kcal`} />
          ) : null}
          <Row label="Proteine" value={`${currentUser.macroTargetsG.protein} g`} />
          <Row label="Carboidrati" value={`${currentUser.macroTargetsG.carbs} g`} />
          <Row label="Grassi" value={`${currentUser.macroTargetsG.fats} g`} />
          <Row label="Idratazione" value={`${(currentUser.hydrationTargetMl / 1000).toFixed(1)} L`} />
          <Pressable onPress={() => router.push('/monthly-checkin')} hitSlop={8} style={styles.reviewTargetRow}>
            <ThemedText type="caption" style={{ color: theme.accent }}>
              Check-in mensile
            </ThemedText>
          </Pressable>
          <ThemedText type="caption" themeColor="textTertiary">
            Alla fine di ogni mese confronti i progressi con il piano: calorie e allenamento vengono rivisti insieme per il mese successivo. Non sostituisce il consiglio di un professionista.
          </ThemedText>
        </GlassSurface>
      </View>

      <IntegrationsSection />

      <Pressable onPress={restartOnboarding} hitSlop={8}>
        <ThemedText type="caption" style={{ textAlign: 'center', color: theme.accent }}>
          Rifai il questionario
        </ThemedText>
      </Pressable>

      <Pressable onPress={handleLogout} hitSlop={8}>
        <ThemedText type="caption" style={{ textAlign: 'center', color: theme.danger }}>
          Esci
        </ThemedText>
      </Pressable>

      <ThemedText type="caption" themeColor="textTertiary" style={{ textAlign: 'center' }}>
        FITLAB · v0.1.0 prototype
      </ThemedText>

      <EditAnswersSheet key={editing?.id ?? 'closed'} group={editing} answers={answers} onClose={() => setEditing(null)} onSave={onSave} />

      <GlassPopup visible={photoMenuOpen} onClose={() => setPhotoMenuOpen(false)} style={{ gap: Spacing.two }}>
        <ThemedText type="subtitle" style={{ marginBottom: Spacing.one }}>
          Foto profilo
        </ThemedText>
        <MenuItem icon="addCircle" label="Scegli dalla galleria" onPress={() => void pickPhoto('library')} />
        {Platform.OS !== 'web' ? <MenuItem icon="camera" label="Scatta una foto" onPress={() => void pickPhoto('camera')} /> : null}
        {currentUser.avatarUri ? (
          <MenuItem
            icon="trash"
            label="Rimuovi foto"
            danger
            onPress={() => {
              setAvatarUri(null);
              setPhotoMenuOpen(false);
            }}
          />
        ) : null}
      </GlassPopup>
    </ScreenScroll>
  );
}

function GroupCard({ group, answers, onEdit }: { group: ProfileGroup; answers: Record<string, AnswerValue>; onEdit: () => void }) {
  const theme = useTheme();
  const rows = summaryRows(group, answers);
  const meals = group.id === 'meals' ? mealTimeline(answers) : [];

  return (
    <GlassSurface level="card" radius={Radius.large} style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <View style={[styles.groupIcon, { backgroundColor: theme.accentSoft }]}>
          <Icon name={group.icon} size={17} color={theme.accent} />
        </View>
        <ThemedText type="smallBold" style={{ flex: 1 }}>
          {group.title}
        </ThemedText>
        <Pressable onPress={onEdit} hitSlop={8} accessibilityLabel={`Modifica ${group.title}`}>
          <View style={[styles.editPill, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="edit" size={14} color={theme.text} />
            <ThemedText type="caption" style={{ fontWeight: '700' }}>
              Modifica
            </ThemedText>
          </View>
        </Pressable>
      </View>

      {meals.length > 0 ? (
        <View style={styles.timeline}>
          {meals.map((meal, i) => (
            <View key={meal.id} style={styles.timelineRow}>
              <ThemedText type="smallBold" style={styles.timelineTime}>
                {meal.time ?? '—'}
              </ThemedText>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, { backgroundColor: theme.accent }]} />
                {i < meals.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: theme.border }]} /> : null}
              </View>
              <ThemedText type="small" style={{ flex: 1, paddingBottom: Spacing.two }}>
                {meal.label}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {rows.map((row, i) => (
        <View key={row.id} style={[i > 0 || meals.length > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: Spacing.two } : null]}>
          <SummaryLine row={row} />
        </View>
      ))}
    </GlassSurface>
  );
}

function SummaryLine({ row }: { row: SummaryRow }) {
  const theme = useTheme();
  if (row.kind === 'chips') {
    return (
      <View style={{ gap: 6 }}>
        <ThemedText type="small" themeColor="textSecondary">
          {row.label}
        </ThemedText>
        {row.values.length === 0 ? (
          <ThemedText type="caption" themeColor="textTertiary">
            Nessuna preferenza
          </ThemedText>
        ) : (
          <View style={styles.chipsWrap}>
            {row.values.map((v) => (
              <View key={v} style={[styles.valueChip, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="caption">{v}</ThemedText>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }
  if (row.kind === 'text') {
    return (
      <View style={{ gap: 2 }}>
        <ThemedText type="small" themeColor="textSecondary">
          {row.label}
        </ThemedText>
        <ThemedText type={row.value ? 'small' : 'caption'} themeColor={row.value ? 'text' : 'textTertiary'}>
          {row.value ?? 'Non indicato'}
        </ThemedText>
      </View>
    );
  }
  return (
    <View style={styles.settingRow}>
      <ThemedText type="small" themeColor="textSecondary" style={{ flexShrink: 0 }}>
        {row.label}
      </ThemedText>
      <View style={styles.valueRight}>
        {row.alert ? <View style={[styles.alertDot, { backgroundColor: theme.warning }]} /> : null}
        <ThemedText type="smallBold" themeColor={row.value ? 'text' : 'textTertiary'} style={{ textAlign: 'right', flexShrink: 1 }}>
          {row.value ?? 'Non indicato'}
        </ThemedText>
      </View>
    </View>
  );
}

function StatBox({ icon, label, value, unit }: { icon: IconName; label: string; value: string; unit?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.statBox, { backgroundColor: theme.backgroundElement }]}>
      <Icon name={icon} size={16} color={theme.textSecondary} />
      <View style={styles.statValueRow}>
        <ThemedText type="subtitle">{value}</ThemedText>
        {unit ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {unit}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

function MenuItem({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const theme = useTheme();
  const color = danger ? theme.danger : theme.text;
  return (
    <Pressable onPress={onPress} style={[styles.menuItem, { backgroundColor: theme.backgroundElement }]}>
      <Icon name={icon} size={18} color={color} />
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewTargetRow: {
    alignItems: 'center',
    paddingTop: Spacing.one,
  },
  closeButton: {
    width: 40,
    height: 40,
  },
  closeInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCard: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  identityTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statBox: {
    flex: 1,
    gap: 4,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  sportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  valueChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  outcome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.large,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  groupCard: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  groupIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  timeline: {
    paddingTop: Spacing.one,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  timelineTime: {
    width: 48,
    textAlign: 'right',
  },
  timelineRail: {
    width: 10,
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingTop: 6,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  valueRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
});
