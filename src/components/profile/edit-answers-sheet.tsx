import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass/glass-surface';
import { QuestionBlock } from '@/components/onboarding/question-block';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { buildUserContext } from '@/domain/user-context';
import { useTheme } from '@/hooks/use-theme';
import { groupQuestions, type ProfileGroup } from '@/lib/questionnaire/profile-sections';
import { isAnswered } from '@/lib/questionnaire/step-questions';
import type { AnswerValue } from '@/store/onboarding-store';

export type EditAnswersSheetProps = {
  group: ProfileGroup | null;
  answers: Record<string, AnswerValue>;
  onClose: () => void;
  onSave: (group: ProfileGroup, draft: Record<string, AnswerValue>) => void;
};

/** Full-screen sheet that edits one Profilo group with the same question widgets and checks as the onboarding questionnaire. */
export function EditAnswersSheet({ group, answers, onClose, onSave }: EditAnswersSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Mounted fresh (keyed by group) on every opening, so the draft always starts from what is saved.
  const [draft, setDraft] = useState<Record<string, AnswerValue>>(answers);

  const questions = useMemo(() => (group ? groupQuestions(group, draft) : []), [group, draft]);
  const missing = questions.filter((q) => !q.optional && !isAnswered(q, draft[q.id]));
  const blocking = useMemo(() => {
    if (!group) return [];
    const ids = new Set(questions.map((q) => q.id));
    return buildUserContext(draft).issues.filter((i) => i.severity === 'error' && ids.has(i.field));
  }, [group, questions, draft]);
  const canSave = missing.length === 0 && blocking.length === 0;
  const usualMeals = questions.filter((q) => q.id.startsWith('usual'));

  return (
    <Modal visible={group != null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.background, paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Chiudi">
            <GlassSurface level="card" radius={Radius.pill} style={styles.closeButton}>
              <View style={styles.closeInner}>
                <Icon name="close" size={18} color={theme.text} />
              </View>
            </GlassSurface>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <ThemedText type="caption" themeColor="textSecondary">
              Modifica
            </ThemedText>
            <ThemedText type="smallBold">{group?.title ?? ''}</ThemedText>
          </View>
          <View style={styles.closeButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.inner}>
            <GlassSurface level="subtle" radius={Radius.large} style={styles.hint}>
              <Icon name="sparkle" size={16} color={theme.accent} />
              <ThemedText type="caption" themeColor="textSecondary" style={{ flex: 1 }}>
                Quando salvi, FITLAB controlla se le modifiche cambiano davvero i tuoi piani e li aggiorna solo se serve, senza toccare i mesi già trascorsi.
              </ThemedText>
            </GlassSurface>
            {questions.map((question) => {
              const block = (
                <QuestionBlock
                  key={question.id}
                  question={question}
                  compact={group?.compact}
                  value={draft[question.id]}
                  onChange={(value) => setDraft((d) => ({ ...d, [question.id]: value }))}
                />
              );
              // Compact groups: the "what do you usually eat" texts fold behind one drop-down, opened only when needed.
              if (!group?.compact || !question.id.startsWith('usual')) return block;
              if (question.id !== usualMeals[0]?.id) return null;
              const filled = usualMeals.filter((q) => isAnswered(q, draft[q.id])).length;
              return (
                <FoldSection key="usualMeals" title="Cosa mangi di solito" summary={`${filled}/${usualMeals.length} pasti indicati`}>
                  {usualMeals.map((q) => (
                    <QuestionBlock key={q.id} question={q} compact value={draft[q.id]} onChange={(value) => setDraft((d) => ({ ...d, [q.id]: value }))} />
                  ))}
                </FoldSection>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing.three, backgroundColor: theme.background }]}>
          <View style={styles.footerInner}>
            {!canSave ? (
              <ThemedText type="caption" style={{ color: theme.danger, textAlign: 'center' }}>
                {blocking[0]?.message ?? 'Completa le domande obbligatorie per salvare'}
              </ThemedText>
            ) : null}
            <PrimaryButton label="Salva modifiche" disabled={!canSave} onPress={() => group && onSave(group, draft)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FoldSection({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <GlassSurface level="card" radius={Radius.medium} style={[styles.fold, open && { borderColor: theme.accent }]}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.foldHeader} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">
            {title}
            <ThemedText type="caption" themeColor="textTertiary">
              {'  (facoltativo)'}
            </ThemedText>
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {summary}
          </ThemedText>
        </View>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={18} color={theme.textTertiary} />
      </Pressable>
      {open ? <View style={styles.foldBody}>{children}</View> : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 36,
    height: 36,
  },
  closeInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  fold: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  foldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  foldBody: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  footer: {
    alignItems: 'center',
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.two,
  },
});
