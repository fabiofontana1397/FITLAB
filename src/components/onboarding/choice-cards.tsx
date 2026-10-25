import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { SpringPressIn, SpringPressOut, TimingQuick } from '@/constants/motion';
import { Radius, Spacing } from '@/constants/theme';
import { hapticSelection } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';
import { optionDescription, optionIcon } from '@/lib/questionnaire/presentation';
import type { QuestionOption } from '@/lib/questionnaire/schema';

export type ChoiceCardsProps = {
  questionId: string;
  options: QuestionOption[];
  multi: boolean;
  value: string | string[] | undefined;
  onChange: (value: string | string[] | undefined) => void;
  /** Options that can't coexist with any other (e.g. equipment's "Nessuna"):
   * picking one clears the rest, picking anything else clears it. */
  exclusiveValues?: string[];
};

/**
 * The questionnaire's single- and multiple-choice questions as full-width
 * cards: icon, label, optional one-liner, and a selection state that is
 * carried by border, fill AND a check mark, never by colour alone.
 */
export function ChoiceCards({ questionId, options, multi, value, onChange, exclusiveValues = [] }: ChoiceCardsProps) {
  const selected = new Set(multi ? ((value as string[] | undefined) ?? []) : value ? [value as string] : []);

  const toggle = (optionValue: string) => {
    hapticSelection();
    if (!multi) {
      onChange(optionValue);
      return;
    }
    const next = new Set(selected);
    if (next.has(optionValue)) next.delete(optionValue);
    else next.add(optionValue);
    if (exclusiveValues.includes(optionValue) && next.has(optionValue)) {
      onChange([optionValue]);
      return;
    }
    for (const exclusive of exclusiveValues) if (next.size > 1) next.delete(exclusive);
    onChange(next.size > 0 ? [...next] : undefined);
  };

  return (
    <View style={styles.list}>
      {options.map((option, index) => (
        <ChoiceCard
          key={option.value}
          index={index}
          label={option.label}
          description={optionDescription(questionId, option.value)}
          icon={optionIcon(questionId, option.value)}
          selected={selected.has(option.value)}
          multi={multi}
          onPress={() => toggle(option.value)}
        />
      ))}
    </View>
  );
}

type ChoiceCardProps = {
  index: number;
  label: string;
  description?: string;
  icon?: IconName;
  selected: boolean;
  multi: boolean;
  onPress: () => void;
};

function ChoiceCard({ index, label, description, icon, selected, multi, onPress }: ChoiceCardProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const enter = useSharedValue(reduceMotion ? 1 : 0);

  // Cards drop in one after another: the screen assembles itself rather than
  // appearing all at once, which is what makes a question-per-screen flow
  // feel like a sequence instead of a slideshow.
  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withDelay(index * 45, withTiming(1, { ...TimingQuick, duration: 260 }));
  }, [enter, index, reduceMotion]);

  const selectedValue = useDerivedValue(
    () => (reduceMotion ? (selected ? 1 : 0) : withTiming(selected ? 1 : 0, { ...TimingQuick, duration: 180 })),
    [selected, reduceMotion]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: (1 - enter.value) * 14 },
      { scale: (1 - pressed.value * 0.02) * (0.99 + selectedValue.value * 0.01) },
    ],
  }));

  const surfaceStyle = useAnimatedStyle(() => ({
    borderWidth: 1 + selectedValue.value * 0.5,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => (pressed.value = withSpring(1, SpringPressIn))}
        onPressOut={() => (pressed.value = withSpring(0, SpringPressOut))}
        accessibilityRole={multi ? 'checkbox' : 'radio'}
        accessibilityState={{ checked: selected }}
        accessibilityLabel={description ? `${label}. ${description}` : label}>
        <Animated.View
          style={[
            styles.card,
            surfaceStyle,
            {
              backgroundColor: selected ? theme.accentSoft : theme.backgroundElement,
              borderColor: selected ? theme.accent : theme.border,
            },
          ]}>
          {icon ? (
            <View style={[styles.iconWrap, { backgroundColor: selected ? theme.accent : theme.backgroundSelected }]}>
              <Icon name={icon} size={20} color={selected ? theme.onAccent : theme.textSecondary} />
            </View>
          ) : null}
          <View style={styles.body}>
            <ThemedText type="subtitle">{label}</ThemedText>
            {description ? (
              <ThemedText type="small" themeColor="textSecondary">
                {description}
              </ThemedText>
            ) : null}
          </View>
          <View
            style={[
              styles.mark,
              multi && styles.markSquare,
              {
                borderColor: selected ? theme.accent : theme.borderStrong,
                backgroundColor: selected ? theme.accent : 'transparent',
              },
            ]}>
            {selected ? <Icon name="check" size={14} color={theme.onAccent} /> : null}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    minHeight: 64,
  },
  iconWrap: { width: 40, height: 40, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  mark: { width: 24, height: 24, borderRadius: Radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  markSquare: { borderRadius: 8 },
});
