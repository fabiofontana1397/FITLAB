import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SUPERVISION_GUIDANCE } from '@/domain/nutrition/safety';
import { latestSnapshot } from '@/lib/mock/body';
import { useBodyStore } from '@/store/body-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';

/**
 * Shown in place of the nutrition plan when the safety engine requires a professional (domain/nutrition/safety.ts):
 * why, general guidance only (no targets), and the explicit way back — reactivation needs the questionnaire to no
 * longer report the condition AND the person's confirmation that a professional re-assessed the plan.
 */
export function NutritionSupervisionCard({ reasons, frozen }: { reasons: string[]; frozen: boolean }) {
  const answers = useOnboardingStore((s) => s.answers);
  const entries = useBodyStore((s) => s.entries);
  const reactivate = usePlanStore((s) => s.reactivateNutrition);
  const [confirming, setConfirming] = useState(false);
  const [blocked, setBlocked] = useState<string[] | null>(null);

  const onConfirm = async () => {
    const weight = latestSnapshot(entries).weightKg;
    const still = await reactivate(answers, { professionalAssessment: true }, weight > 0 ? weight : undefined);
    setBlocked(still.length > 0 ? still : null);
    setConfirming(false);
  };

  return (
    <FlatCard radius={28} style={styles.card}>
      <ThemedText type="smallBold">Piano alimentare in attesa di un professionista</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {frozen ? 'Il piano è sospeso' : 'Non generiamo un piano alimentare automatico'} per: {reasons.join(', ')}.
      </ThemedText>
      <View style={styles.list}>
        {SUPERVISION_GUIDANCE.map((line, i) => (
          <ThemedText key={i} type="small" themeColor="textSecondary">
            {line}
          </ThemedText>
        ))}
      </View>
      {frozen ? (
        confirming ? (
          <View style={styles.list}>
            <ThemedText type="small">
              Confermi che un medico o un nutrizionista ha rivalutato la tua situazione e che puoi tornare a un piano automatico? Prima aggiorna il questionario nel Profilo.
            </ThemedText>
            <PrimaryButton label="Confermo" dense onPress={onConfirm} />
            <PrimaryButton label="Annulla" variant="ghost" dense onPress={() => setConfirming(false)} />
          </View>
        ) : (
          <PrimaryButton label="Riattiva il piano" variant="ghost" dense onPress={() => setConfirming(true)} style={styles.action} />
        )
      ) : null}
      {blocked ? (
        <ThemedText type="small" themeColor="textSecondary">
          Non è ancora possibile riattivarlo: {blocked.join(', ')}.
        </ThemedText>
      ) : null}
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 8 },
  list: { gap: 6, marginTop: 4 },
  action: { marginTop: 8, alignSelf: 'flex-start' },
});
