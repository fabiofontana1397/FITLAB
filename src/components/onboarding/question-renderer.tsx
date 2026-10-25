import { StyleSheet, View } from 'react-native';

import { ChoiceCards } from '@/components/onboarding/choice-cards';
import { FoodPicker } from '@/components/onboarding/food-picker';
import { HeightPicker, WeightPicker } from '@/components/onboarding/measure-picker';
import { NumberWheel } from '@/components/onboarding/number-wheel';
import { ScaleSlider } from '@/components/onboarding/scale-slider';
import { TimePicker } from '@/components/onboarding/time-picker';
import { ThemedText } from '@/components/themed-text';
import { AppTextInput } from '@/components/ui/app-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseNumericAnswer } from '@/lib/questionnaire/parse-answer';
import { inputForQuestion } from '@/lib/questionnaire/presentation';
import type { Question } from '@/lib/questionnaire/schema';
import type { AnswerValue } from '@/store/onboarding-store';

/** Options that can't coexist with anything else in their multi-select.
 * "Nessuna attrezzatura" is the questionnaire's only one: it and a rack
 * describe two different homes, and no exercise has ever matched 'none'
 * anyway (see lib/planning/exercise-constraints.ts), so this fixes a
 * contradictory answer without changing a single generated plan. */
const EXCLUSIVE_OPTIONS: Record<string, string[]> = { equipment: ['none'] };

export type QuestionRendererProps = {
  question: Question;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  /** Every answer so far — a couple of controls park on a related one (the
   * goal weight starts from the current weight rather than from thin air). */
  answers: Record<string, AnswerValue>;
};

/**
 * Picks the control a question gets on its own screen. The question itself,
 * its options and its validation all still come from schema.ts — this only
 * decides what the answer area looks like (see lib/questionnaire/presentation.ts).
 */
export function QuestionRenderer({ question, value, onChange, answers }: QuestionRendererProps) {
  const input = inputForQuestion(question);

  switch (input.kind) {
    case 'cards':
      return (
        <ChoiceCards
          questionId={question.id}
          options={question.options ?? []}
          multi={question.type === 'multi'}
          value={value as string | string[] | undefined}
          onChange={onChange}
          exclusiveValues={EXCLUSIVE_OPTIONS[question.id]}
        />
      );

    case 'wheel':
      return (
        <NumberWheel
          min={question.min ?? 0}
          max={question.max ?? 100}
          step={input.step}
          value={parseNumericAnswer(value) ?? undefined}
          fallback={input.fallback}
          onChange={onChange}
          suffix={input.suffix}
          accessibilityLabel={question.label}
        />
      );

    case 'ruler':
      return input.measure === 'length' ? (
        <HeightPicker
          value={parseNumericAnswer(value) ?? undefined}
          onChange={onChange}
          min={question.min ?? 130}
          max={question.max ?? 220}
        />
      ) : (
        <WeightPicker
          value={parseNumericAnswer(value) ?? undefined}
          onChange={onChange}
          min={question.min ?? 35}
          max={question.max ?? 200}
          fallbackKg={
            // The goal weight starts where the person is today, so the first
            // drag is a nudge rather than a journey across the whole scale.
            (question.id === 'targetWeightKg' ? parseNumericAnswer(answers.currentWeightKg) : null) ?? input.fallback
          }
        />
      );

    case 'time':
      return (
        <TimePicker
          value={typeof value === 'string' ? value : undefined}
          onChange={onChange}
          placeholder={question.placeholder}
          accessibilityLabel={question.label}
        />
      );

    case 'slider':
      return (
        <ScaleSlider
          min={question.min ?? 1}
          max={question.max ?? 5}
          value={parseNumericAnswer(value) ?? undefined}
          onChange={onChange}
          accessibilityLabel={question.label}
        />
      );

    case 'foodPicker':
      return <FoodPicker question={question} value={value} onChange={onChange} />;

    default:
      return <TextAnswer question={question} value={value} onChange={onChange} />;
  }
}

function TextAnswer({ question, value, onChange }: { question: Question; value: AnswerValue; onChange: (value: AnswerValue) => void }) {
  const theme = useTheme();
  const long = question.type === 'longtext';

  return (
    <View style={{ gap: Spacing.two }}>
      <AppTextInput
        value={(value as string) ?? ''}
        onChangeText={(text) => onChange(text === '' ? undefined : text)}
        placeholder={question.placeholder ?? (long ? 'Scrivi qui…' : '')}
        placeholderTextColor={theme.textTertiary}
        multiline={long}
        accessibilityLabel={question.label}
        style={[
          styles.input,
          long && styles.inputLong,
          { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}
      />
      {question.optional ? (
        <ThemedText type="caption" themeColor="textTertiary">
          Puoi lasciare vuoto e proseguire.
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: 16,
    fontSize: 16,
  },
  inputLong: { minHeight: 120, textAlignVertical: 'top', paddingTop: 16 },
});
