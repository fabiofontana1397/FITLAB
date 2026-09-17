import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { QuestionBlock } from '@/components/onboarding/question-block';
import { StepProgress } from '@/components/onboarding/step-progress';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { FadeInView } from '@/components/ui/fade-in-view';
import { Icon, type IconName } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  ACTIVITY_TO_SPORT,
  buildActivityQuestions,
  findQuestion,
  isQuestionVisible,
  labelFor,
  stepsForMode,
  type OnboardingMode,
  type OnboardingStep,
  type Question,
} from '@/lib/questionnaire/schema';
import { computeNutritionTargets, deriveWeeklyTrainingDays } from '@/lib/nutrition/targets';
import { daysAgoISO } from '@/lib/mock/dates';
import { sportIcon } from '@/lib/mock/training';
import type { Goal, Sex, Sport } from '@/lib/mock/types';
import { useBodyStore } from '@/store/body-store';
import { useOnboardingStore, type AnswerValue } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';
import { useUserStore } from '@/store/user-store';

const MODE_OPTIONS: { value: OnboardingMode; label: string }[] = [
  { value: 'diet', label: 'Piano alimentare' },
  { value: 'training', label: 'Programma di allenamento' },
  { value: 'both', label: 'Entrambi' },
];

function isAnswered(value: AnswerValue): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== '';
}

function getStepQuestions(step: OnboardingStep, answers: Record<string, AnswerValue>): Question[] {
  const questions =
    step.id === 'training'
      ? [...step.questions, ...buildActivityQuestions((answers.activitiesPracticed as string[]) ?? [])]
      : step.questions;
  return questions.filter((q) => isQuestionVisible(q, answers));
}

function sportsFromAnswers(answers: Record<string, AnswerValue>): Sport[] {
  const activitiesPracticed = (answers.activitiesPracticed as string[]) ?? [];
  return [...new Set(activitiesPracticed.map((a) => ACTIVITY_TO_SPORT[a]).filter(Boolean))] as Sport[];
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const answers = useOnboardingStore((s) => s.answers);
  const setAnswer = useOnboardingStore((s) => s.setAnswer);
  const finalizeOnboarding = useUserStore((s) => s.finalizeOnboarding);
  const resetStartingWeight = useBodyStore((s) => s.resetStartingWeight);
  const generatePlans = usePlanStore((s) => s.generatePlans);

  const [mode, setMode] = useState<OnboardingMode | null>((answers.mode as OnboardingMode) ?? null);
  const [screenIndex, setScreenIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Each step is a fresh set of questions — landing mid-scroll from the
  // previous (often longer) step made it easy to miss the step title and
  // the first question or two entirely.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [screenIndex]);

  const activeSteps = useMemo(() => (mode ? stepsForMode(mode) : []), [mode]);
  const isIntroScreen = screenIndex === 0;
  const isResultsScreen = mode != null && screenIndex === activeSteps.length + 1;
  const step = !isIntroScreen && !isResultsScreen ? activeSteps[screenIndex - 1] : null;
  const stepQuestions = useMemo(() => (step ? getStepQuestions(step, answers) : []), [step, answers]);
  const sports = useMemo(() => sportsFromAnswers(answers), [answers]);
  const activitiesPracticed = useMemo(() => (answers.activitiesPracticed as string[]) ?? [], [answers.activitiesPracticed]);
  const activityQuestions = useMemo(() => buildActivityQuestions(activitiesPracticed), [activitiesPracticed]);

  const canContinue = useMemo(() => {
    if (isIntroScreen) return mode != null;
    if (!step) return true;
    return stepQuestions.every((q) => q.optional || isAnswered(answers[q.id]));
  }, [isIntroScreen, mode, step, stepQuestions, answers]);

  const results = useMemo(() => {
    if (!isResultsScreen) return null;
    return computeNutritionTargets({
      sex: (answers.sex as Sex) ?? 'unspecified',
      ageRange: (answers.ageRange as string) ?? '25-34',
      heightCm: Number(answers.heightCm) || 180,
      currentWeightKg: Number(answers.currentWeightKg) || 80,
      goal: (answers.goal as Goal) ?? 'generalHealth',
      jobActivity: answers.jobActivity as string,
      weeklyTrainingDays: deriveWeeklyTrainingDays(answers),
    });
  }, [isResultsScreen, answers]);

  const selectMode = (value: OnboardingMode) => {
    setMode(value);
    setAnswer('mode', value);
  };

  const goNext = () => {
    if (isIntroScreen && mode == null) return;
    setScreenIndex(screenIndex + 1);
  };

  const goBack = () => {
    if (screenIndex > 0) setScreenIndex(screenIndex - 1);
  };

  const confirmProfile = () => {
    if (!results) return;

    finalizeOnboarding({
      goal: (answers.goal as Goal) ?? 'generalHealth',
      sports: sports.length > 0 ? sports : ['gym'],
      sex: (answers.sex as Sex) ?? 'unspecified',
      ageRange: (answers.ageRange as string) ?? '25-34',
      heightCm: Number(answers.heightCm) || 180,
      targetWeightKg: Number(answers.targetWeightKg) || 75,
      dailyCalorieTarget: results.dailyCalorieTarget,
      macroTargetsG: results.macroTargetsG,
      hydrationTargetMl: results.hydrationTargetMl,
    });
    resetStartingWeight(Number(answers.currentWeightKg) || 80, daysAgoISO(0));
    // Fire-and-forget, same as before this became AI-assisted: the
    // congratulations/roadmap screens don't need the plan immediately, and
    // the AI strategy call (web search + RAG) can take a few seconds —
    // onboarding should never block on it. `fetchPlanStrategy` never
    // throws (falls back to null on any failure), so this is safe.
    void generatePlans(answers, { dailyCalorieTarget: results.dailyCalorieTarget, macroTargetsG: results.macroTargetsG });
    router.push('/onboarding-created');
  };

  return (
    <ScreenScroll ref={scrollRef} contentContainerStyle={{ justifyContent: 'space-between', flex: 1 }}>
      <View style={{ gap: Spacing.five }}>
        {isIntroScreen ? (
          <View style={{ gap: Spacing.four }}>
            <View style={{ gap: Spacing.two }}>
              <ThemedText type="display">Prima di iniziare</ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                Per costruirti un piano davvero su misura ti faremo qualche domanda sul tuo profilo, le tue abitudini e i
                tuoi obiettivi. Bastano pochi minuti e potrai rivedere le risposte in qualsiasi momento dal tuo profilo.
              </ThemedText>
            </View>
            <View style={{ gap: Spacing.two }}>
              <ThemedText type="smallBold">Cosa vuoi costruire con FITLAB?</ThemedText>
              <View style={{ gap: Spacing.three }}>
                {MODE_OPTIONS.map((option) => {
                  const selected = mode === option.value;
                  return (
                    <Pressable key={option.value} onPress={() => selectMode(option.value)}>
                      <GlassSurface
                        level={selected ? 'raised' : 'card'}
                        radius={Radius.large}
                        style={[styles.optionRow, selected && ({ borderColor: theme.accent } as any)]}>
                        <View style={styles.optionInner}>
                          <ThemedText type="smallBold" style={{ flex: 1 }}>
                            {option.label}
                          </ThemedText>
                          {selected ? <Icon name="checkCircle" size={20} color={theme.accent} /> : null}
                        </View>
                      </GlassSurface>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {step ? (
          <>
            <StepProgress
              stepIndex={screenIndex - 1}
              stepCount={activeSteps.length}
              stepTitle={step.title}
              onBack={goBack}
            />
            <View style={{ gap: Spacing.one }}>
              <ThemedText type="display">{step.title}</ThemedText>
              {step.subtitle ? (
                <ThemedText type="default" themeColor="textSecondary">
                  {step.subtitle}
                </ThemedText>
              ) : null}
            </View>
            {step.banner ? (
              <GlassSurface level="subtle" radius={Radius.large} style={styles.banner}>
                <Icon name="alert" size={18} color={theme.warning} />
                <ThemedText type="caption" style={{ flex: 1 }}>
                  {step.banner}
                </ThemedText>
              </GlassSurface>
            ) : null}
            <View style={{ gap: Spacing.four }}>
              {stepQuestions.map((question) => (
                <QuestionBlock
                  key={question.id}
                  question={question}
                  value={answers[question.id]}
                  onChange={(value) => setAnswer(question.id, value)}
                />
              ))}
            </View>
          </>
        ) : null}

        {isResultsScreen ? (
          <View style={{ gap: Spacing.five }}>
            <View style={{ gap: Spacing.one }}>
              <ThemedText type="label" themeColor="textSecondary">
                Riepilogo
              </ThemedText>
              <ThemedText type="display">La tua scheda profilo</ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                Controlla i dati raccolti: sono la base su cui costruiamo il tuo piano su misura.
              </ThemedText>
            </View>

            <FadeInView delay={80}>
              <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.four }}>
                <View style={styles.factsGrid}>
                  <FactTile
                    icon="target"
                    label="Obiettivo"
                    value={labelFor(findQuestion('goal'), answers.goal) ?? '–'}
                  />
                  <FactTile
                    icon="scale"
                    label="Peso attuale → obiettivo"
                    value={`${answers.currentWeightKg ?? '–'} → ${answers.targetWeightKg ?? '–'} kg`}
                  />
                  <FactTile icon="ruler" label="Altezza" value={`${answers.heightCm ?? '–'} cm`} />
                  <FactTile
                    icon="calendar"
                    label="Età · Sesso"
                    value={`${labelFor(findQuestion('ageRange'), answers.ageRange) ?? '–'} · ${labelFor(findQuestion('sex'), answers.sex) ?? '–'}`}
                  />
                </View>
              </GlassSurface>
            </FadeInView>

            {mode !== 'training' ? (
              <FadeInView delay={160}>
                <SummarySection icon="nutrition" title="Alimentazione">
                  <InfoRow
                    label="Pattern alimentare"
                    value={labelFor(findQuestion('dietaryPattern'), answers.dietaryPattern) ?? 'Nessuna preferenza'}
                  />
                  <InfoRow
                    label="Pasti al giorno"
                    value={labelFor(findQuestion('mealsPerDay'), answers.mealsPerDay) ?? '–'}
                  />
                  {answers.allergies ? <InfoRow label="Allergie" value={String(answers.allergies)} /> : null}
                  {answers.intolerances ? <InfoRow label="Intolleranze" value={String(answers.intolerances)} /> : null}
                </SummarySection>
              </FadeInView>
            ) : null}

            {mode !== 'diet' ? (
              <FadeInView delay={240}>
                <SummarySection icon="training" title="Allenamento">
                  {activitiesPracticed.length > 0 ? (
                    <View style={styles.sportsRow}>
                      {activitiesPracticed.map((activity) => {
                        const freqLabel = labelFor(
                          activityQuestions.find((q) => q.id === `freq_${activity}`),
                          answers[`freq_${activity}`]
                        );
                        const activityLabel = labelFor(findQuestion('activitiesPracticed'), activity) ?? activity;
                        return (
                          <View key={activity} style={[styles.sportChip, { backgroundColor: theme.accentSoft }]}>
                            <Icon name={sportIcon[ACTIVITY_TO_SPORT[activity]] ?? 'otherSport'} size={16} color={theme.accent} />
                            <ThemedText type="caption">
                              {activityLabel}
                              {freqLabel ? ` · ${freqLabel}` : ''}
                            </ThemedText>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                  <InfoRow
                    label="Giorni disponibili"
                    value={labelFor(findQuestion('availableDays'), answers.availableDays) ?? '–'}
                  />
                  <InfoRow
                    label="Durata sessione"
                    value={labelFor(findQuestion('sessionDuration'), answers.sessionDuration) ?? '–'}
                  />
                  <InfoRow
                    label="Dove ti alleni"
                    value={labelFor(findQuestion('trainingLocation'), answers.trainingLocation) ?? '–'}
                  />
                </SummarySection>
              </FadeInView>
            ) : null}
          </View>
        ) : null}
      </View>

      <PrimaryButton
        label={isResultsScreen ? 'Conferma' : 'Continua'}
        onPress={isResultsScreen ? confirmProfile : goNext}
        disabled={!canContinue}
        style={{ marginTop: Spacing.five }}
      />
    </ScreenScroll>
  );
}

function FactTile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.factTile}>
      <View style={[styles.factIcon, { backgroundColor: theme.accentSoft }]}>
        <Icon name={icon} size={16} color={theme.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText type="caption" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="smallBold">{value}</ThemedText>
      </View>
    </View>
  );
}

function SummarySection({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.two }}>
      <View style={styles.sectionHeaderRow}>
        <View style={[styles.sectionIcon, { backgroundColor: theme.accentSoft }]}>
          <Icon name={icon} size={16} color={theme.accent} />
        </View>
        <ThemedText type="smallBold">{title}</ThemedText>
      </View>
      <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.four, gap: Spacing.three }}>
        {children}
      </GlassSurface>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={{ flex: 1, textAlign: 'right' }}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  optionRow: {
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  factsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  factTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minWidth: '45%',
    flexGrow: 1,
  },
  factIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportsRow: {
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
});
