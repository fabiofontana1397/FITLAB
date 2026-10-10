import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { GlassSurface } from '@/components/glass/glass-surface';
import { EditAnswersSheet } from '@/components/profile/edit-answers-sheet';
import { IntegrationsSection } from '@/components/profile/integrations-section';
import { MODE_LABEL, OutcomeBanner, QuestionnaireSheet } from '@/components/profile/questionnaire-sheet';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Radius, Spacing } from '@/constants/theme';
import { useAnswersEditor, type SaveOutcome } from '@/hooks/use-answers-editor';
import { useTheme } from '@/hooks/use-theme';
import { latestSnapshot } from '@/lib/mock/body';
import { sportIcon, sportMeta } from '@/lib/mock';
import { goBackOr } from '@/lib/navigation/go-back';
import { answerText, findGroup, groupsForMode, type ProfileGroup } from '@/lib/questionnaire/profile-sections';
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
  const [questionnaireOpen, setQuestionnaireOpen] = useState(false);
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
    setQuestionnaireOpen(false);
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

  const editor = <EditAnswersSheet key={editing?.id ?? 'closed'} group={editing} answers={answers} onClose={() => setEditing(null)} onSave={onSave} />;

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

      <View style={{ gap: Spacing.two }}>
        <ThemedText type="subtitle">Questionario</ThemedText>
        <OutcomeBanner saving={saving && !questionnaireOpen} isGenerating={isGenerating && !questionnaireOpen} outcome={questionnaireOpen ? null : outcome} />
        <GlassSurface level="card" radius={Radius.large} style={styles.questionnaireCard}>
          <View style={styles.questionnaireTop}>
            <View style={[styles.questionnaireIcon, { backgroundColor: theme.accentSoft }]}>
              <Icon name="checkCircle" size={20} color={theme.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText type="smallBold">Il tuo questionario</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {MODE_LABEL[mode]} · {groups.length} sezioni
              </ThemedText>
            </View>
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            Le risposte da cui nascono i tuoi piani. Modificale quando cambia qualcosa: aggiorniamo i piani solo se serve.
          </ThemedText>
          <PrimaryButton label="Vedi e modifica il questionario" icon="edit" onPress={() => setQuestionnaireOpen(true)} />
          <Pressable onPress={restartOnboarding} hitSlop={8}>
            <ThemedText type="caption" style={{ textAlign: 'center', color: theme.accent, fontWeight: '700' }}>
              Rifai il questionario da capo
            </ThemedText>
          </Pressable>
        </GlassSurface>
      </View>

      <IntegrationsSection />

      <Pressable onPress={handleLogout} hitSlop={8}>
        <ThemedText type="caption" style={{ textAlign: 'center', color: theme.danger }}>
          Esci
        </ThemedText>
      </Pressable>

      <ThemedText type="caption" themeColor="textTertiary" style={{ textAlign: 'center' }}>
        FITLAB · v0.1.0 prototype
      </ThemedText>

      <QuestionnaireSheet
        visible={questionnaireOpen}
        onClose={() => setQuestionnaireOpen(false)}
        groups={groups}
        answers={answers}
        mode={mode}
        onEdit={setEditing}
        onRestart={restartOnboarding}
        saving={saving}
        isGenerating={isGenerating}
        outcome={outcome}>
        {questionnaireOpen ? editor : null}
      </QuestionnaireSheet>
      {questionnaireOpen ? null : editor}

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

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  questionnaireCard: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  questionnaireTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  questionnaireIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.medium,
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
});
