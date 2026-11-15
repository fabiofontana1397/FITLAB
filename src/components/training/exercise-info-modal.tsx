import { Image, Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ListGroup } from '@/components/ui/list-group';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ExerciseMedia } from '@/lib/exercise-media/exercise-media';

const EXERCISE_IMAGE = 232;

/** "2-0-1" / "3-1-1-0" — the standard tempo notation used across the
 * plan: eccentric (lowering) - pause at the bottom - concentric
 * (lifting) - an optional final pause at the top. Returns null for any
 * value that doesn't parse as 3 or 4 dash-separated numbers, so a
 * custom/free-text tempo just renders as-is with no breakdown rather
 * than a broken one. */
const TEMPO_PHASE_LABELS: Record<3 | 4, string[]> = {
  3: ['Fase eccentrica (discesa)', 'Pausa in basso', 'Fase concentrica (spinta)'],
  4: ['Fase eccentrica (discesa)', 'Pausa in basso', 'Fase concentrica (spinta)', 'Pausa in alto'],
};
function describeTempo(tempo: string): { phase: string; seconds: string }[] | null {
  const parts = tempo.split('-').map((p) => p.trim());
  if ((parts.length !== 3 && parts.length !== 4) || parts.some((p) => p === '' || Number.isNaN(Number(p)))) return null;
  const labels = TEMPO_PHASE_LABELS[parts.length as 3 | 4];
  return parts.map((seconds, i) => ({ phase: labels[i], seconds }));
}

export type ExerciseInfoModalProps = {
  visible: boolean;
  exerciseName: string;
  media: ExerciseMedia | undefined;
  sets: number;
  reps: string;
  tempo: string;
  restLabel: string;
  onClose: () => void;
};

/**
 * The exercise as a bottom sheet, in the same language as the recipe: the demonstration on top, the prescription
 * (sets, reps, rest) in one strip, then grouped lists for the tempo of each phase, what to do and what to avoid.
 */
export function ExerciseInfoModal({ visible, onClose, ...content }: ExerciseInfoModalProps) {
  return (
    // The sheet animates itself, so the Modal only has to be transparent.
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {visible ? <ExerciseInfoContent {...content} onClose={onClose} /> : null}
    </Modal>
  );
}

function ExerciseInfoContent({ exerciseName, media, sets, reps, tempo, restLabel, onClose }: Omit<ExerciseInfoModalProps, 'visible'>) {
  const theme = useTheme();
  const tempoPhases = describeTempo(tempo);
  const numbers: { label: string; value: string }[] = [
    ...(sets > 0 ? [{ label: 'serie', value: String(sets) }] : []),
    ...(reps ? [{ label: 'ripetizioni', value: reps }] : []),
    ...(restLabel ? [{ label: 'recupero', value: restLabel }] : []),
  ];

  return (
    <SheetScreen title={exerciseName} eyebrow={media?.target} onClose={onClose} contentContainerStyle={styles.content}>
      {media ? (
        <View style={styles.hero}>
          <Image source={{ uri: media.gifUrl }} style={[styles.image, { backgroundColor: theme.backgroundElement }]} resizeMode="cover" accessibilityLabel={`Dimostrazione: ${exerciseName}`} />
        </View>
      ) : null}

      {/* The prescription, as one strip. */}
      {numbers.length > 0 ? (
        <View style={[styles.numbers, { backgroundColor: theme.backgroundElement }]}>
          {numbers.map((n, i) => (
            <View key={n.label} style={[styles.number, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.border }]}>
              <ThemedText style={styles.numberValue} numberOfLines={1} adjustsFontSizeToFit>
                {n.value}
              </ThemedText>
              <ThemedText style={styles.numberLabel} themeColor="textSecondary" numberOfLines={1}>
                {n.label}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {tempo ? (
        <ListGroup header={tempoPhases ? `Tempo di esecuzione · ${tempo}` : 'Tempo di esecuzione'}>
          {tempoPhases ? (
            tempoPhases.map((p) => (
              <View key={p.phase} style={styles.row}>
                <ThemedText style={styles.rowTitle}>{p.phase}</ThemedText>
                <ThemedText style={styles.rowValue} themeColor="textSecondary">
                  {p.seconds} s
                </ThemedText>
              </View>
            ))
          ) : (
            <View style={styles.row}>
              <ThemedText style={styles.rowTitle}>{tempo}</ThemedText>
            </View>
          )}
        </ListGroup>
      ) : null}

      {media ? (
        <>
          <View style={styles.text}>
            <ThemedText type="label" themeColor="textSecondary" accessibilityRole="header">
              Come si esegue
            </ThemedText>
            <ThemedText style={styles.paragraph}>{media.instructions}</ThemedText>
          </View>

          {media.doTips.length > 0 ? (
            <ListGroup header="Cosa fare">
              {media.doTips.map((tip) => (
                <TipRow key={tip} icon="checkCircle" color={theme.success} text={tip} />
              ))}
            </ListGroup>
          ) : null}
          {media.dontTips.length > 0 ? (
            <ListGroup header="Cosa evitare">
              {media.dontTips.map((tip) => (
                <TipRow key={tip} icon="close" color={theme.danger} text={tip} />
              ))}
            </ListGroup>
          ) : null}

          <ThemedText type="caption" themeColor="textTertiary" style={styles.note}>
            {media.attribution}
          </ThemedText>
        </>
      ) : (
        <ThemedText themeColor="textSecondary" style={styles.note}>
          La descrizione di questo esercizio non è ancora disponibile.
        </ThemedText>
      )}
    </SheetScreen>
  );
}

function TipRow({ icon, color, text }: { icon: 'checkCircle' | 'close'; color: string; text: string }) {
  return (
    <View style={[styles.row, styles.tipRow]}>
      <View style={styles.tipIcon}>
        <Icon name={icon} size={18} color={color} />
      </View>
      <ThemedText style={styles.tipText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four },
  hero: { alignItems: 'center' },
  image: { width: EXERCISE_IMAGE, height: EXERCISE_IMAGE, borderRadius: 28, borderCurve: 'continuous' },
  numbers: { flexDirection: 'row', borderRadius: 20, borderCurve: 'continuous', paddingVertical: 14 },
  number: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  numberValue: { fontSize: 17, lineHeight: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  numberLabel: { fontSize: 12, lineHeight: 16 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: 12 },
  rowTitle: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 21 },
  rowValue: { fontSize: 16, lineHeight: 21, fontVariant: ['tabular-nums'] },
  text: { gap: Spacing.two, paddingHorizontal: Spacing.four },
  paragraph: { fontSize: 16, lineHeight: 23 },
  tipRow: { alignItems: 'flex-start' },
  tipIcon: { height: 22, justifyContent: 'center' },
  tipText: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 22 },
  note: { paddingHorizontal: Spacing.four },
});
