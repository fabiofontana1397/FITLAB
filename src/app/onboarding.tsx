import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ChoiceCards } from '@/components/onboarding/choice-cards';
import { OnboardingFooter } from '@/components/onboarding/onboarding-footer';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { QuestionMedia } from '@/components/onboarding/question-media';
import { QuestionRenderer } from '@/components/onboarding/question-renderer';
import { ThemedText } from '@/components/themed-text';
import { BrandWordmark } from '@/components/ui/brand-wordmark';
import { FadeInView } from '@/components/ui/fade-in-view';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { initialTargets } from '@/domain/plan-engine';
import { profileFromContext } from '@/domain/profile';
import { buildUserContext, cleanAnswersForMode } from '@/domain/user-context';
import { daysAgoISO } from '@/lib/mock/dates';
import { sportIcon } from '@/lib/mock/training';
import { buildFlow, flowProgress, resumeIndex } from '@/lib/questionnaire/flow';
import { parseNumericAnswer } from '@/lib/questionnaire/parse-answer';
import { mediaIcon, screenSubtitle, screenTitle } from '@/lib/questionnaire/presentation';
import {
  ACTIVITY_TO_SPORT,
  buildActivityQuestions,
  practicedActivities,
  findQuestion,
  labelFor,
  type OnboardingMode,
} from '@/lib/questionnaire/schema';
import { isAnswered } from '@/lib/questionnaire/step-questions';
import { useBodyStore } from '@/store/body-store';
import { useOnboardingStore, type AnswerValue } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';
import { useUserStore } from '@/store/user-store';

const MODE_OPTIONS = [
  { value: 'diet', label: 'Piano alimentare' },
  { value: 'training', label: 'Programma di allenamento' },
  { value: 'both', label: 'Entrambi' },
];

/**
 * The questionnaire, one question per screen.
 *
 * Every question, option, dependency and validation rule still comes from
 * `lib/questionnaire/schema.ts` — this screen only walks the flat flow that
 * `lib/questionnaire/flow.ts` builds from it, so a conditional question
 * appears exactly where it always did and the summary still re-validates
 * the whole questionnaire before the profile is submitted.
 */
export default function OnboardingScreen() {
  const answers = useOnboardingStore((s) => s.answers);
  const setAnswer = useOnboardingStore((s) => s.setAnswer);
  const replaceAnswers = useOnboardingStore((s) => s.replaceAnswers);
  const finalizeOnboarding = useUserStore((s) => s.finalizeOnboarding);
  const resetStartingWeight = useBodyStore((s) => s.resetStartingWeight);
  const generatePlans = usePlanStore((s) => s.generatePlans);

  const [mode, setMode] = useState<OnboardingMode | null>((answers.mode as OnboardingMode) ?? null);
  // Answers are saved question by question, so the flow opens where it was
  // left off rather than at the top — see resumeIndex.
  const [cursor, setCursor] = useState(() => {
    const saved = (answers.mode as OnboardingMode) ?? null;
    const savedFlow = buildFlow(saved, answers);
    const start = saved ? resumeIndex(savedFlow, answers) : 0;
    return { id: savedFlow[start].id, index: start };
  });
  const [direction, setDirection] = useState<1 | -1>(1);
  const [submitting, setSubmitting] = useState(false);

  const flow = useMemo(() => buildFlow(mode, answers), [mode, answers]);

  // Position is held as the *id* of the screen being shown, with its last
  // known index only as a fallback: answering a question can insert or remove
  // later screens (a snack time, the home-equipment list, the per-activity
  // questions), and an index alone would quietly slide onto a different
  // question when that happens.
  const index = (() => {
    if (flow[cursor.index]?.id === cursor.id) return cursor.index;
    const found = flow.findIndex((item) => item.id === cursor.id);
    return found === -1 ? Math.min(cursor.index, flow.length - 1) : found;
  })();

  const screen = flow[index];
  const isSummary = screen.kind === 'summary';

  const activitiesPracticed = useMemo(() => practicedActivities(answers.activitiesPracticed), [answers.activitiesPracticed]);
  const activityQuestions = useMemo(() => buildActivityQuestions(activitiesPracticed), [activitiesPracticed]);

  // The single place the questionnaire becomes numbers: the same context and engine the plans will use.
  const results = useMemo(() => {
    if (!isSummary) return null;
    const ctx = buildUserContext(cleanAnswersForMode(answers));
    return { ctx, targets: initialTargets(ctx), issues: ctx.issues };
  }, [isSummary, answers]);

  const blockingIssues = results?.issues.filter((issue) => issue.severity === 'error') ?? [];

  // The summary's "Conferma" doesn't just trust that every earlier "Continua"
  // press already validated its own question — it re-checks every mandatory
  // question across the whole questionnaire, so there's a single real gate on
  // the action that submits the profile and starts generating plans.
  const summaryComplete = useMemo(() => {
    if (!isSummary || !mode) return false;
    return flow.every((item) => item.kind !== 'question' || item.question.optional || isAnswered(item.question, answers[item.question.id]));
  }, [isSummary, mode, flow, answers]);

  const canContinue = (() => {
    if (screen.kind === 'intro') return mode != null;
    if (screen.kind === 'summary') return summaryComplete && blockingIssues.length === 0 && !submitting;
    return screen.question.optional || isAnswered(screen.question, answers[screen.question.id]);
  })();

  const goNext = () => {
    if (index >= flow.length - 1) return;
    setDirection(1);
    setCursor({ id: flow[index + 1].id, index: index + 1 });
  };

  const goBack = () => {
    if (index === 0) return;
    setDirection(-1);
    setCursor({ id: flow[index - 1].id, index: index - 1 });
  };

  const selectMode = (value: string) => {
    setMode(value as OnboardingMode);
    setAnswer('mode', value);
  };

  const confirmProfile = () => {
    // Defense in depth: the button is already disabled unless canContinue is
    // true, and `submitting` makes a double tap a no-op rather than a second
    // profile submission and a second plan generation.
    if (!results || !canContinue || submitting) return;
    setSubmitting(true);

    // Stale answers from an earlier questionnaire (other mode) are dropped before anything is computed.
    const cleaned = cleanAnswersForMode(answers);
    replaceAnswers(cleaned as Record<string, AnswerValue>);
    finalizeOnboarding(profileFromContext(results.ctx, results.targets));
    resetStartingWeight(results.ctx.weightKg, daysAgoISO(0));
    // Fire-and-forget: the congratulations/roadmap screens don't need the plan
    // immediately, and the AI strategy call can take a few seconds — onboarding
    // never blocks on it (generatePlans handles every failure itself).
    void generatePlans(cleaned, { trigger: 'onboarding' });
    router.push('/onboarding-created');
  };

  const header =
    screen.kind === 'intro' ? (
      <OnboardingHeader progress={0} />
    ) : (
      <OnboardingHeader
        progress={flowProgress(index, flow.length)}
        onBack={goBack}
        kicker={screen.kind === 'question' ? `${screen.step.title} · ${screen.stepNumber}/${screen.stepCount}` : 'Riepilogo'}
      />
    );

  const footer = (() => {
    if (screen.kind === 'intro') return <OnboardingFooter label="Continua" onPress={goNext} disabled={!canContinue} />;
    if (screen.kind === 'summary') {
      return (
        <OnboardingFooter
          label={submitting ? 'Un attimo…' : 'Conferma'}
          onPress={confirmProfile}
          disabled={!canContinue}
          note={blockingIssues.length > 0 ? blockingIssues[0].message : undefined}
        />
      );
    }
    const { question } = screen;
    const answered = isAnswered(question, answers[question.id]);
    return (
      <OnboardingFooter
        label="Continua"
        onPress={goNext}
        disabled={!canContinue}
        secondary={question.optional && !answered ? { label: 'Salta', onPress: goNext } : undefined}
        note={footerNote(question.id, answers)}
      />
    );
  })();

  return (
    <OnboardingShell screenKey={screen.id} direction={direction} header={header} footer={footer}>
      {screen.kind === 'intro' ? (
        <IntroScreen mode={mode} onSelect={selectMode} />
      ) : screen.kind === 'summary' ? (
        <SummaryScreen answers={answers} mode={mode} activitiesPracticed={activitiesPracticed} activityQuestions={activityQuestions} issues={blockingIssues} />
      ) : (
        <QuestionScreenBody
          key={screen.question.id}
          screen={screen}
          answers={answers}
          onChange={(value) => setAnswer(screen.question.id, value)}
        />
      )}
    </OnboardingShell>
  );
}

/** A derived fact about the answer just given — never a new question. */
function footerNote(questionId: string, answers: Record<string, AnswerValue>): string | undefined {
  if (questionId !== 'targetWeightKg') return undefined;
  const current = parseNumericAnswer(answers.currentWeightKg);
  const target = parseNumericAnswer(answers.targetWeightKg);
  if (current == null || target == null) return undefined;
  const delta = target - current;
  if (Math.abs(delta) < 0.05) return 'Stesso peso di oggi: punteremo al mantenimento.';
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${Math.abs(delta).toFixed(1).replace('.', ',')} kg rispetto al peso attuale.`;
}

function IntroScreen({ mode, onSelect }: { mode: OnboardingMode | null; onSelect: (value: string) => void }) {
  return (
    <View style={{ gap: Spacing.five }}>
      <View style={{ gap: Spacing.three, alignItems: 'center' }}>
        <BrandWordmark style={{ width: 128, height: 34 }} />
        <View style={{ gap: Spacing.two }}>
          <ThemedText type="display" style={{ textAlign: 'center' }}>
            Prima di iniziare
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            Per costruirti un piano davvero su misura ti faremo qualche domanda sul tuo profilo, le tue abitudini e i tuoi
            obiettivi. Bastano pochi minuti e potrai rivedere le risposte in qualsiasi momento dal tuo profilo.
          </ThemedText>
        </View>
      </View>
      <View style={{ gap: Spacing.three }}>
        <ThemedText type="subtitle">Cosa vuoi costruire con FITLAB?</ThemedText>
        <ChoiceCards questionId="mode" options={MODE_OPTIONS} multi={false} value={mode ?? undefined} onChange={(value) => onSelect(value as string)} />
      </View>
    </View>
  );
}

type QuestionScreen = Extract<ReturnType<typeof buildFlow>[number], { kind: 'question' }>;

function QuestionScreenBody({
  screen,
  answers,
  onChange,
}: {
  screen: QuestionScreen;
  answers: Record<string, AnswerValue>;
  onChange: (value: AnswerValue) => void;
}) {
  const theme = useTheme();
  const { question, step, isStepOpener } = screen;
  const subtitle = screenSubtitle(question);
  const media = mediaIcon(question);

  return (
    <View style={{ gap: Spacing.four }}>
      {isStepOpener && step.banner ? (
        <GlassSurface level="subtle" radius={Radius.large} style={styles.banner}>
          <Icon name="alert" size={18} color={theme.warning} />
          <ThemedText type="caption" style={{ flex: 1 }}>
            {step.banner}
          </ThemedText>
        </GlassSurface>
      ) : null}

      {media ? <QuestionMedia icon={media} /> : null}

      <View style={{ gap: Spacing.two }}>
        <ThemedText type="display" style={{ textAlign: 'center' }} accessibilityRole="header">
          {screenTitle(question)}
          {question.optional ? (
            <ThemedText type="default" themeColor="textTertiary">
              {'  facoltativa'}
            </ThemedText>
          ) : null}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="default" themeColor="textSecondary" style={{ textAlign: 'center' }}>
            {subtitle}
          </ThemedText>
        ) : null}
        {isStepOpener && step.subtitle && step.subtitle !== subtitle ? (
          <ThemedText type="caption" themeColor="textTertiary" style={{ textAlign: 'center' }}>
            {step.subtitle}
          </ThemedText>
        ) : null}
      </View>

      <QuestionRenderer question={question} value={answers[question.id]} onChange={onChange} answers={answers} />
    </View>
  );
}

function SummaryScreen({
  answers,
  mode,
  activitiesPracticed,
  activityQuestions,
  issues,
}: {
  answers: Record<string, AnswerValue>;
  mode: OnboardingMode | null;
  activitiesPracticed: string[];
  activityQuestions: ReturnType<typeof buildActivityQuestions>;
  issues: { message: string }[];
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: Spacing.five }}>
      <View style={{ gap: Spacing.one }}>
        {/* The header above already reads "RIEPILOGO". */}
        <ThemedText type="display">La tua scheda profilo</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Controlla i dati raccolti: sono la base su cui costruiamo il tuo piano su misura.
        </ThemedText>
      </View>

      {issues.length > 0 ? (
        <GlassSurface level="subtle" radius={Radius.large} style={styles.banner}>
          <Icon name="alert" size={18} color={theme.danger} />
          <View style={{ flex: 1, gap: 2 }}>
            {issues.map((issue) => (
              <ThemedText key={issue.message} type="caption">
                {issue.message}
              </ThemedText>
            ))}
          </View>
        </GlassSurface>
      ) : null}

      <FadeInView delay={80}>
        <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.four }}>
          <View style={styles.factsGrid}>
            <FactTile icon="target" label="Obiettivo" value={labelFor(findQuestion('goal'), answers.goal) ?? '–'} />
            <FactTile
              icon="scale"
              label="Peso attuale → obiettivo"
              value={`${answers.currentWeightKg ?? '–'} → ${answers.targetWeightKg ?? '–'} kg`}
            />
            <FactTile icon="ruler" label="Altezza" value={`${answers.heightCm ?? '–'} cm`} />
            <FactTile
              icon="calendar"
              label="Età · Sesso"
              value={`${answers.age ?? '–'} anni · ${labelFor(findQuestion('sex'), answers.sex) ?? '–'}`}
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
              label="Pasti selezionati"
              value={
                Array.isArray(answers.mealsSelected) && answers.mealsSelected.length > 0
                  ? answers.mealsSelected.map((m) => labelFor(findQuestion('mealsSelected'), m) ?? m).join(', ')
                  : '–'
              }
            />
            {answers.allergiesIntolerances ? <InfoRow label="Allergie/intolleranze" value={String(answers.allergiesIntolerances)} /> : null}
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
            <InfoRow label="Giorni disponibili" value={labelFor(findQuestion('availableDays'), answers.availableDays) ?? '–'} />
            <InfoRow label="Durata sessione" value={labelFor(findQuestion('sessionDuration'), answers.sessionDuration) ?? '–'} />
            <InfoRow label="Dove ti alleni" value={labelFor(findQuestion('trainingLocation'), answers.trainingLocation) ?? '–'} />
          </SummarySection>
        </FadeInView>
      ) : null}
    </View>
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
