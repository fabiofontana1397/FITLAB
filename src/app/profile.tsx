import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { seedOneMonthOfTestData } from '@/lib/dev/seed-test-data';
import { sportIcon, sportMeta } from '@/lib/mock';
import { findQuestion, labelFor } from '@/lib/questionnaire/schema';
import { useAppStore, type AppearanceMode } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { useOnboardingStore } from '@/store/onboarding-store';
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

// Multi-select answers (e.g. supplements) join every selected option's
// label — labelFor only resolves a single string value.
function multiLabelFor(questionId: string, value: unknown): string | undefined {
  const question = findQuestion(questionId);
  if (!question?.options || !Array.isArray(value) || value.length === 0) return undefined;
  const labels = value.map((v) => question.options!.find((o) => o.value === v)?.label).filter((l): l is string => Boolean(l));
  return labels.length > 0 ? labels.join(', ') : undefined;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const currentUser = useUserStore();
  const onboardingAnswers = useOnboardingStore((s) => s.answers);
  const appearance = useAppStore((s) => s.appearance);
  const setAppearance = useAppStore((s) => s.setAppearance);
  const setHasOnboarded = useAppStore((s) => s.setHasOnboarded);
  const logout = useAuthStore((s) => s.logout);

  const restartOnboarding = () => {
    setHasOnboarded(false);
    router.replace('/onboarding');
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/welcome');
  };

  const handleSeedTestData = () => {
    seedOneMonthOfTestData();
    Alert.alert('Fatto', 'Un mese di dati di test (peso, pasti, allenamenti) è stato generato.');
  };

  const reviewNutritionTarget = useUserStore((s) => s.reviewNutritionTarget);
  const [isReviewingTarget, setIsReviewingTarget] = useState(false);

  const handleReviewTarget = async () => {
    setIsReviewingTarget(true);
    try {
      const decision = await reviewNutritionTarget();
      if (decision.action === 'none') {
        Alert.alert('Target invariato', decision.reason);
      } else {
        const verb = decision.action === 'increase' ? 'aumentate' : 'ridotte';
        Alert.alert('Target aggiornato', `Calorie giornaliere ${verb} di ${decision.deltaKcal} kcal.\n\n${decision.reason}`);
      }
    } catch (err) {
      console.warn('reviewNutritionTarget failed', err);
      Alert.alert('Errore', 'Non è stato possibile rivedere il target ora. Riprova più tardi.');
    } finally {
      setIsReviewingTarget(false);
    }
  };

  // "Keep-no-algoritmo" fields (spec §11/§13 point 4) — collected in the
  // questionnaire but deliberately never fed into any calculation; surfaced
  // here read-only for the user/coach's own reference instead of staying
  // invisible after being answered.
  const habitRows = [
    { label: 'Mangia fuori', value: labelFor(findQuestion('eatingOut'), onboardingAnswers.eatingOut) },
    { label: 'Livello di fame', value: labelFor(findQuestion('hungerLevel'), onboardingAnswers.hungerLevel) },
    { label: 'Caffè', value: labelFor(findQuestion('coffeeIntake'), onboardingAnswers.coffeeIntake) },
    { label: 'Alcol', value: labelFor(findQuestion('alcoholIntake'), onboardingAnswers.alcoholIntake) },
    { label: 'Integratori', value: multiLabelFor('supplements', onboardingAnswers.supplements) },
  ].filter((r): r is { label: string; value: string } => Boolean(r.value));

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <ThemedText type="title">Profilo</ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <GlassSurface level="card" radius={Radius.pill} style={styles.closeButton}>
            <View style={styles.closeInner}>
              <Icon name="close" size={18} color={theme.text} />
            </View>
          </GlassSurface>
        </Pressable>
      </View>

      <GlassSurface level="card" radius={Radius.large} style={styles.identityCard}>
        <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="title" style={{ color: theme.accent }}>
            {currentUser.name.charAt(0)}
          </ThemedText>
        </View>
        <View>
          <ThemedText type="subtitle">{currentUser.name}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Obiettivo: {GOAL_LABEL[currentUser.goal]}
          </ThemedText>
        </View>
      </GlassSurface>

      <View>
        <SectionHeader title="Aspetto" />
        <SegmentedControl options={APPEARANCE_OPTIONS} value={appearance} onChange={setAppearance} />
      </View>

      <View>
        <SectionHeader title="Sport praticati" action="Modifica" onActionPress={() => router.push('/onboarding')} />
        <View style={styles.sportsGrid}>
          {currentUser.sports.map((sport) => (
            <View key={sport} style={[styles.sportChip, { backgroundColor: theme.backgroundElement }]}>
              <Icon name={sportIcon[sport] as IconName} size={16} color={theme.accent} />
              <ThemedText type="caption">{sportMeta[sport].label}</ThemedText>
            </View>
          ))}
        </View>
      </View>

      <View>
        <SectionHeader title="Dati di partenza" />
        <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Row label="Altezza" value={`${currentUser.heightCm} cm`} />
          <Row label="Peso obiettivo" value={`${currentUser.targetWeightKg} kg`} />
        </GlassSurface>
      </View>

      <View>
        <SectionHeader title="Obiettivi nutrizionali" />
        <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Row label="Calorie giornaliere" value={`${currentUser.dailyCalorieTarget} kcal`} />
          <Row label="Proteine" value={`${currentUser.macroTargetsG.protein} g`} />
          <Row label="Carboidrati" value={`${currentUser.macroTargetsG.carbs} g`} />
          <Row label="Grassi" value={`${currentUser.macroTargetsG.fats} g`} />
          <Row label="Idratazione" value={`${(currentUser.hydrationTargetMl / 1000).toFixed(1)} L`} />
          <Pressable onPress={handleReviewTarget} disabled={isReviewingTarget} hitSlop={8} style={styles.reviewTargetRow}>
            {isReviewingTarget ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <ThemedText type="caption" style={{ color: theme.accent }}>
                Rivedi il mio target (beta)
              </ThemedText>
            )}
          </Pressable>
          <ThemedText type="caption" themeColor="textTertiary">
            Confronta peso e calorie registrate negli ultimi giorni e propone una piccola correzione se il trend non è in linea con l'obiettivo — non sostituisce il consiglio di un professionista.
          </ThemedText>
        </GlassSurface>
      </View>

      {habitRows.length > 0 ? (
        <View>
          <SectionHeader title="Abitudini" />
          <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.three, gap: Spacing.two }}>
            {habitRows.map((row) => (
              <Row key={row.label} label={row.label} value={row.value} />
            ))}
            <ThemedText type="caption" themeColor="textTertiary">
              Informazioni raccolte nel questionario, mostrate qui per riferimento — non influenzano il calcolo del piano.
            </ThemedText>
          </GlassSurface>
        </View>
      ) : null}

      <View>
        <SectionHeader title="Integrazioni" />
        <GlassSurface level="card" radius={Radius.large} style={styles.integrationRow}>
          <Icon name="bolt" size={18} color={theme.textTertiary} />
          <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
            Connetti Apple Health, Garmin o Whoop
          </ThemedText>
          <ThemedText type="caption" themeColor="textTertiary">
            Presto
          </ThemedText>
        </GlassSurface>
      </View>

      <View>
        <SectionHeader title="Strumenti di sviluppo" />
        <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.three, gap: Spacing.two }}>
          <ThemedText type="caption" themeColor="textSecondary">
            Genera un mese di peso, pasti e allenamenti registrati (dove esiste già un piano) per provare i grafici
            con dati realistici. Sovrascrive quanto già presente su questo dispositivo.
          </ThemedText>
          <Pressable onPress={handleSeedTestData} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              Genera dati di test
            </ThemedText>
          </Pressable>
        </GlassSurface>
      </View>

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
    </ScreenScroll>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportsGrid: {
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
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  integrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
});
