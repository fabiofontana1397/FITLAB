import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import type { Goal } from '@/lib/mock/types';

function formatKcal(n: number): string {
  return Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function signed(n: number): string {
  const r = Math.round(n);
  return r === 0 ? '0' : `${r < 0 ? '-' : '+'}${formatKcal(r)}`;
}

type Strategy = 'deficit' | 'surplus' | 'maintenance';

const GOAL_COPY: Record<Goal, { name: string; strategy: Strategy; why: string }> = {
  loseFat: {
    name: 'perdere grasso',
    strategy: 'deficit',
    why: 'Per perdere grasso il tuo piano punta a un deficit: bruciare più calorie di quante ne assumi, così il corpo attinge alle riserve.',
  },
  gainMuscle: {
    name: 'aumentare la massa muscolare',
    strategy: 'surplus',
    why: 'Per costruire muscolo il tuo piano punta a un surplus controllato: mangiare un po’ più di quanto bruci, per dare ai muscoli l’energia per crescere.',
  },
  gainStrength: {
    name: 'aumentare la forza',
    strategy: 'surplus',
    why: 'Per aumentare la forza il tuo piano punta a un leggero surplus, che sostiene allenamenti pesanti e recupero.',
  },
  maintainImprove: {
    name: 'mantenerti e migliorarti',
    strategy: 'maintenance',
    why: 'Per mantenerti il tuo piano punta a un bilancio vicino allo zero: assumi più o meno quanto bruci.',
  },
  improveEndurance: {
    name: 'migliorare la resistenza',
    strategy: 'maintenance',
    why: 'Per migliorare la resistenza il tuo piano punta a un bilancio vicino allo zero, con energia sufficiente per sostenere il volume di allenamento.',
  },
  generalHealth: {
    name: 'stare in salute',
    strategy: 'maintenance',
    why: 'Per il tuo benessere generale il tuo piano punta a un bilancio vicino allo zero, senza forzare deficit o surplus.',
  },
};

export type EnergyDetailsPopupProps = {
  visible: boolean;
  onClose: () => void;
  goal: Goal;
  /** Name of the diet plan's current month phase, when a plan exists. */
  planPhaseTitle?: string;
  /** Daily calories the diet plan asks the user to eat. */
  calorieTarget: number;
  burnedKcal: number;
  eatenKcal: number;
  /** Eaten minus burned today (negative = deficit). */
  balanceKcal: number;
  /** Weekly balance goal (negative = deficit goal) and what was done so far. */
  weeklyGoalKcal: number;
  weeklySoFarKcal: number;
  weeklyProgress: number;
  isToday: boolean;
  /** 'day' explains today's balance first; 'week' leads with the weekly goal. */
  focus: 'day' | 'week';
  /** Average daily balance over the tracked days of the week. */
  averageBalanceKcal: number;
  trackedDays: number;
  daysLeft: number;
};

/** "Dettagli" under the calorie gauge: explains what deficit/surplus means
 * for THIS user — their goal, plan and today's/this week's real numbers —
 * rather than a generic definition. */
export function EnergyDetailsPopup({
  visible,
  onClose,
  goal,
  planPhaseTitle,
  calorieTarget,
  burnedKcal,
  eatenKcal,
  balanceKcal,
  weeklyGoalKcal,
  weeklySoFarKcal,
  weeklyProgress,
  isToday,
  focus,
  averageBalanceKcal,
  trackedDays,
  daysLeft,
}: EnergyDetailsPopupProps) {
  const theme = useTheme();
  const copy = GOAL_COPY[goal];
  const dailyGoalKcal = weeklyGoalKcal / 7;
  const goalWord = weeklyGoalKcal < 0 ? 'deficit' : weeklyGoalKcal > 0 ? 'surplus' : 'pareggio';
  const dayWord = isToday ? 'Oggi' : 'In questo giorno';

  // How today's balance sits against the daily target for this goal.
  const delta = balanceKcal - dailyGoalKcal;
  let verdict: string;
  if (eatenKcal <= 0) {
    verdict = 'Non hai ancora registrato pasti: il saldo si aggiorna man mano che li inserisci.';
  } else if (Math.abs(delta) <= 150) {
    verdict = 'Sei in linea con l’obiettivo giornaliero del tuo piano.';
  } else if (copy.strategy === 'deficit') {
    verdict =
      delta < 0
        ? `Il deficit è più ampio del previsto (${formatKcal(delta)} kcal oltre l’obiettivo): assicurati di mangiare abbastanza per recuperare.`
        : `Il deficit è più piccolo del previsto (mancano ${formatKcal(delta)} kcal): puoi ridurre un po’ le calorie o muoverti di più.`;
  } else if (copy.strategy === 'surplus') {
    verdict =
      delta > 0
        ? `Il surplus è più ampio del previsto (${formatKcal(delta)} kcal oltre l’obiettivo): meglio non eccedere.`
        : `Il surplus è più piccolo del previsto (mancano ${formatKcal(delta)} kcal): aggiungi uno spuntino per sostenere la crescita.`;
  } else {
    verdict =
      delta > 0
        ? `Hai assunto ${formatKcal(delta)} kcal più del bilancio che il piano punta a mantenere.`
        : `Hai assunto ${formatKcal(delta)} kcal meno del bilancio che il piano punta a mantenere.`;
  }

  // Weekly view: average daily balance against the plan's daily target, and
  // what the remaining days need to close the week on target.
  const avgDelta = averageBalanceKcal - dailyGoalKcal;
  const needPerDay = daysLeft > 0 ? (weeklyGoalKcal - weeklySoFarKcal) / daysLeft : 0;
  let weekVerdict: string;
  if (trackedDays === 0) {
    weekVerdict = 'Non ci sono ancora giorni tracciati: registra pasti e allenamenti per vedere il tuo andamento.';
  } else if (Math.abs(avgDelta) <= 100) {
    weekVerdict = `Il tuo saldo medio è ${signed(averageBalanceKcal)} kcal al giorno, in linea con l’obiettivo di ${signed(dailyGoalKcal)}.`;
  } else if (copy.strategy === 'deficit' && averageBalanceKcal > 0) {
    weekVerdict = `Il tuo saldo medio è ${signed(averageBalanceKcal)} kcal al giorno: sei in surplus mentre il piano punta a un deficit (${signed(dailyGoalKcal)}). Riduci un po’ le calorie o aumenta il movimento.`;
  } else if (copy.strategy === 'surplus' && averageBalanceKcal < 0) {
    weekVerdict = `Il tuo saldo medio è ${signed(averageBalanceKcal)} kcal al giorno: sei in deficit mentre il piano punta a un surplus (${signed(dailyGoalKcal)}). Aggiungi calorie ai pasti per sostenere la crescita.`;
  } else if (copy.strategy === 'deficit') {
    weekVerdict =
      avgDelta < 0
        ? `Il tuo saldo medio è ${signed(averageBalanceKcal)} kcal al giorno: un deficit più ampio dell’obiettivo (${signed(dailyGoalKcal)}). Occhio a non esagerare, servono energie per allenarti e recuperare.`
        : `Il tuo saldo medio è ${signed(averageBalanceKcal)} kcal al giorno: un deficit più piccolo dell’obiettivo (${signed(dailyGoalKcal)}).`;
  } else if (copy.strategy === 'surplus') {
    weekVerdict =
      avgDelta > 0
        ? `Il tuo saldo medio è ${signed(averageBalanceKcal)} kcal al giorno: un surplus più ampio dell’obiettivo (${signed(dailyGoalKcal)}).`
        : `Il tuo saldo medio è ${signed(averageBalanceKcal)} kcal al giorno: un surplus più piccolo dell’obiettivo (${signed(dailyGoalKcal)}), aggiungi qualcosa ai pasti.`;
  } else {
    weekVerdict = `Il tuo saldo medio è ${signed(averageBalanceKcal)} kcal al giorno, contro un obiettivo di ${signed(dailyGoalKcal)}.`;
  }
  const remaining = daysLeft > 0 && trackedDays > 0 ? ` Ti restano ${daysLeft} giorni: per chiudere la settimana in obiettivo servono circa ${signed(needPerDay)} kcal al giorno.` : '';
  const progressPct = Math.round(Math.min(Math.max(weeklyProgress, 0), 1) * 100);

  return (
    <GlassPopup visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
          <Icon name="target" size={18} color={theme.accent} />
        </View>
        <ThemedText type="subtitle" style={{ flex: 1 }}>
          {focus === 'week' ? 'Il tuo obiettivo settimanale' : 'Il tuo bilancio energetico'}
        </ThemedText>
        <Pressable onPress={onClose} hitSlop={8}>
          <Icon name="close" size={22} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Section title={`Il tuo obiettivo: ${copy.name}`}>
          <Body>{copy.why}</Body>
        </Section>

        <Section title="Cosa prevede il tuo piano">
          <Body>
            {`Obiettivo settimanale: ${signed(weeklyGoalKcal)} kcal (${goalWord}), circa ${signed(dailyGoalKcal)} kcal al giorno.`}
            {calorieTarget > 0 ? ` Il piano alimentare${planPhaseTitle ? ` (${planPhaseTitle})` : ''} ti chiede circa ${formatKcal(calorieTarget)} kcal al giorno.` : ''}
          </Body>
        </Section>

        {focus === 'week' ? (
          <>
        <Section title="Questa settimana">
          <Body>
            {`Finora ${signed(weeklySoFarKcal)} kcal su un obiettivo di ${signed(weeklyGoalKcal)} kcal: ${progressPct}% completato. ${weekVerdict}${remaining} Conta il bilancio dell’intera settimana, non il singolo giorno: una giornata fuori misura si recupera nei giorni dopo.`}
          </Body>
        </Section>

        <Section title={isToday ? 'Oggi' : 'Il giorno scelto'}>
          <Body>
            {`${dayWord} hai bruciato ${formatKcal(burnedKcal)} kcal e ne hai assunte ${formatKcal(eatenKcal)}: saldo ${signed(balanceKcal)} kcal (${balanceKcal < 0 ? 'deficit' : balanceKcal > 0 ? 'surplus' : 'pareggio'}). ${verdict}`}
          </Body>
        </Section>

          </>
        ) : (
          <>
        <Section title={isToday ? 'Oggi' : 'Il giorno scelto'}>
          <Body>
            {`${dayWord} hai bruciato ${formatKcal(burnedKcal)} kcal e ne hai assunte ${formatKcal(eatenKcal)}: saldo ${signed(balanceKcal)} kcal (${balanceKcal < 0 ? 'deficit' : balanceKcal > 0 ? 'surplus' : 'pareggio'}). ${verdict}`}
          </Body>
        </Section>

        <Section title="Questa settimana">
          <Body>
            {`Finora ${signed(weeklySoFarKcal)} kcal su un obiettivo di ${signed(weeklyGoalKcal)} kcal: ${progressPct}% completato. ${weekVerdict}${remaining} Conta il bilancio dell’intera settimana, non il singolo giorno: una giornata fuori misura si recupera nei giorni dopo.`}
          </Body>
        </Section>

          </>
        )}

        <ThemedText style={styles.note} themeColor="textTertiary">
          Le calorie bruciate sono una stima (metabolismo basale, attività quotidiana e allenamenti), non una misura.
        </ThemedText>
      </ScrollView>
    </GlassPopup>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {children}
    </View>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <ThemedText style={styles.body} themeColor="textSecondary">
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
    maxHeight: 460,
  },
  content: {
    gap: 14,
  },
  section: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '700',
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  note: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
});
