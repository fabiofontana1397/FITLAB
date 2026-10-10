import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { FadeInView } from '@/components/ui/fade-in-view';
import { Icon } from '@/components/ui/icon';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import type { SaveOutcome } from '@/hooks/use-answers-editor';
import { useTheme } from '@/hooks/use-theme';
import { mealTimeline, summaryRows, type ProfileGroup, type SummaryRow } from '@/lib/questionnaire/profile-sections';
import type { AnswerValue } from '@/store/onboarding-store';

export const MODE_LABEL: Record<'diet' | 'training' | 'both', string> = {
  diet: 'Piano alimentare',
  training: 'Programma di allenamento',
  both: 'Piano alimentare + allenamento',
};

export type QuestionnaireSheetProps = {
  visible: boolean;
  onClose: () => void;
  groups: ProfileGroup[];
  answers: Record<string, AnswerValue>;
  mode: 'diet' | 'training' | 'both';
  onEdit: (group: ProfileGroup) => void;
  onRestart: () => void;
  saving: boolean;
  isGenerating: boolean;
  outcome: SaveOutcome | null;
  /** Rendered inside this modal (the edit sheet must sit on top of it on iOS). */
  children?: React.ReactNode;
};

/** "Il tuo questionario": every answer grouped by topic, each group with its own "Modifica". Opened from Profilo. */
export function QuestionnaireSheet({ visible, onClose, groups, answers, mode, onEdit, onRestart, saving, isGenerating, outcome, children }: QuestionnaireSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.background, paddingTop: Platform.OS === 'android' ? insets.top : 0 }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <ThemedText type="subtitle">Il tuo questionario</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              Le risposte da cui nascono i tuoi piani
            </ThemedText>
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Chiudi">
            <GlassSurface level="card" radius={Radius.pill} style={styles.closeButton}>
              <View style={styles.closeInner}>
                <Icon name="close" size={18} color={theme.text} />
              </View>
            </GlassSurface>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.five }]} showsVerticalScrollIndicator={false}>
          <View style={styles.inner}>
            <OutcomeBanner saving={saving} isGenerating={isGenerating} outcome={outcome} />

            <View style={[styles.modeRow, { borderColor: theme.border }]}>
              <Icon name="sparkle" size={16} color={theme.accent} />
              <View style={{ flex: 1 }}>
                <ThemedText type="caption" themeColor="textSecondary">
                  Percorso
                </ThemedText>
                <ThemedText type="smallBold">{MODE_LABEL[mode]}</ThemedText>
              </View>
              <Pressable onPress={onRestart} hitSlop={8}>
                <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '700' }}>
                  Cambia
                </ThemedText>
              </Pressable>
            </View>

            {groups.map((group) => (
              <GroupCard key={group.id} group={group} answers={answers} onEdit={() => onEdit(group)} />
            ))}
          </View>
        </ScrollView>
        {children}
      </View>
    </Modal>
  );
}

/** "Checking what changes… / Plans updated / Nothing to update" after a save. */
export function OutcomeBanner({ saving, isGenerating, outcome }: { saving: boolean; isGenerating: boolean; outcome: SaveOutcome | null }) {
  const theme = useTheme();
  if (!outcome && !saving) return null;
  const busy = saving || isGenerating || !outcome;
  return (
    <FadeInView>
      <GlassSurface level="subtle" radius={Radius.large} style={styles.outcome}>
        {busy ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : (
          <Icon name="checkCircle" size={18} color={outcome.diet || outcome.training ? theme.accent : theme.success} />
        )}
        <ThemedText type="caption" style={{ flex: 1 }}>
          {saving || !outcome ? 'Controllo cosa cambia nei tuoi piani…' : isGenerating ? 'Aggiornamento dei piani in corso…' : outcome.message}
        </ThemedText>
      </GlassSurface>
    </FadeInView>
  );
}

function GroupCard({ group, answers, onEdit }: { group: ProfileGroup; answers: Record<string, AnswerValue>; onEdit: () => void }) {
  const theme = useTheme();
  const rows = summaryRows(group, answers);
  const meals = group.id === 'meals' ? mealTimeline(answers) : [];

  // Long groups fold: each food list and the "usual meals" texts sit behind a one-line drop-down.
  const usualMeals = group.compact ? rows.filter((r) => r.kind === 'text' && r.id.startsWith('usual')) : [];
  const lines = group.compact ? rows.filter((r) => !usualMeals.includes(r)) : rows;

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

      {usualMeals.length > 0 ? (
        <Divided first={meals.length === 0}>
          <FoldRow
            label="Cosa mangi di solito"
            summary={`${usualMeals.filter((r) => r.kind === 'text' && r.value).length}/${usualMeals.length} pasti indicati`}>
            {usualMeals.map((r) => (
              <SummaryLine key={r.id} row={r} />
            ))}
          </FoldRow>
        </Divided>
      ) : null}

      {lines.map((row, i) => (
        <Divided key={row.id} first={i === 0 && meals.length === 0 && usualMeals.length === 0}>
          {group.compact && row.kind === 'chips' ? (
            <FoldRow label={row.label} summary={row.values.length === 0 ? 'Nessuna preferenza' : `${row.values.length} ${row.values.length === 1 ? 'alimento' : 'alimenti'}`}>
              <Chips values={row.values} />
            </FoldRow>
          ) : (
            <SummaryLine row={row} />
          )}
        </Divided>
      ))}
    </GlassSurface>
  );
}

function Divided({ first, children }: { first: boolean; children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={first ? null : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: Spacing.two }}>{children}</View>;
}

/** A row that folds its content behind a drop-down chevron. */
function FoldRow({ label, summary, children }: { label: string; summary: string; children: React.ReactNode }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: Spacing.two }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.settingRow} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <View style={styles.valueRight}>
          <ThemedText type="smallBold">{summary}</ThemedText>
          <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} color={theme.textTertiary} />
        </View>
      </Pressable>
      {open ? <View style={{ gap: Spacing.two }}>{children}</View> : null}
    </View>
  );
}

function Chips({ values }: { values: string[] }) {
  const theme = useTheme();
  if (values.length === 0) {
    return (
      <ThemedText type="caption" themeColor="textTertiary">
        Nessuna preferenza
      </ThemedText>
    );
  }
  return (
    <View style={styles.chipsWrap}>
      {values.map((v) => (
        <View key={v} style={[styles.valueChip, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="caption">{v}</ThemedText>
        </View>
      ))}
    </View>
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
        <Chips values={row.values} />
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: { width: 36, height: 36 },
  closeInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { alignItems: 'center', paddingTop: Spacing.four },
  inner: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four, gap: Spacing.three },
  outcome: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
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
  groupCard: { padding: Spacing.three, gap: Spacing.two },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.one },
  groupIcon: { width: 32, height: 32, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center' },
  editPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.two + 2, paddingVertical: 5, borderRadius: Radius.pill },
  timeline: { paddingTop: Spacing.one },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  timelineTime: { width: 48, textAlign: 'right' },
  timelineRail: { width: 10, alignItems: 'center', alignSelf: 'stretch', paddingTop: 6 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { width: 2, flex: 1, marginTop: 2 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.three },
  valueRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  alertDot: { width: 8, height: 8, borderRadius: 4 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  valueChip: { paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: Radius.pill },
});
