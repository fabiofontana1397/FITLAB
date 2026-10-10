import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import type { Goal } from '@/lib/mock/types';
import type { DietMonthPlan, DietPlan, PlanPhaseKind } from '@/lib/planning/types';

export const DIET_PHASE_SHORT_LABEL: Record<PlanPhaseKind, string> = {
  adattamento: 'Abitudini e porzioni',
  progressione: 'Target pieni',
  consolidamento: 'Consolidamento',
};

const GOAL_COPY: Record<Goal, { name: string; why: string }> = {
  gainMuscle: {
    name: 'aumentare la massa muscolare',
    why: 'Per costruire muscolo servono un leggero surplus calorico e proteine distribuite in tutti i pasti. Il piano aumenta l’energia in modo controllato, così cresci senza accumulare grasso superfluo.',
  },
  gainStrength: {
    name: 'aumentare la forza',
    why: 'La forza cresce se gli allenamenti sono sostenuti da energia sufficiente e proteine per recuperare. Il piano mette più carboidrati nei giorni di allenamento e mantiene alte le proteine ogni giorno.',
  },
  loseFat: {
    name: 'perdere grasso',
    why: 'Per perdere grasso serve un deficit calorico moderato e costante, con proteine alte per proteggere i muscoli. Il piano scende gradualmente, senza tagli drastici che fanno perdere energia e massa magra.',
  },
  improveEndurance: {
    name: 'migliorare la resistenza',
    why: 'La resistenza ha bisogno di carboidrati per alimentare gli allenamenti lunghi e di un buon recupero. Il piano dosa l’energia in base ai giorni di allenamento e di riposo.',
  },
  maintainImprove: {
    name: 'mantenerti e migliorarti',
    why: 'Per mantenere i risultati servono calorie in equilibrio e abitudini stabili. Il piano tiene i target vicini al tuo fabbisogno e li ritocca in base ai progressi.',
  },
  generalHealth: {
    name: 'stare in salute',
    why: 'L’obiettivo è mangiare in modo vario ed equilibrato, con tanta verdura, fonti proteiche di qualità e grassi buoni, secondo il modello mediterraneo.',
  },
};

/** What a phase actually changes on the plate, in plain words. */
const PHASE_DETAIL: Record<PlanPhaseKind, string> = {
  adattamento:
    'Prendi confidenza con orari, porzioni e pesate. I target sono già quelli giusti per te, ma la priorità è la regolarità: segui il piano il più possibile e annota come ti senti.',
  progressione:
    'Calorie e macro lavorano a pieno regime verso il tuo obiettivo. A ogni check-in i target vengono ritoccati in base al peso, all’energia e a quanto sei riuscito a seguire il piano.',
  consolidamento:
    'I target si stabilizzano: consolidi le abitudini e i risultati raggiunti, così il nuovo equilibrio dura anche dopo il percorso.',
};

export type DietOverviewPopupProps = {
  visible: boolean;
  onClose: () => void;
  plan: DietPlan;
  goal: Goal;
  currentMonth: number;
};

/** The full description of the diet behind the "Il tuo percorso" banner:
 * overall goal, how a day is built, what each month does and how the plan
 * adapts. Everything is read from the user's own plan. */
export function DietOverviewPopup({ visible, onClose, plan, goal, currentMonth }: DietOverviewPopupProps) {
  const theme = useTheme();
  const copy = GOAL_COPY[goal];
  const reference = plan.months.find((m) => m.monthIndex === currentMonth) ?? plan.months[0];
  const day = describeDay(reference);

  return (
    <GlassPopup visible={visible} onClose={onClose} maxWidth={420}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
          <Icon name="utensils" size={18} color={theme.accent} />
        </View>
        <ThemedText type="subtitle" style={{ flex: 1 }}>
          Il tuo piano alimentare
        </ThemedText>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Chiudi">
          <Icon name="close" size={22} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Section icon="target" title={`Obiettivo: ${copy.name}`}>
          <Body>
            {`Un percorso di ${plan.durationMonths} ${plan.durationMonths === 1 ? 'mese' : 'mesi'} costruito sulle risposte del tuo questionario: obiettivo, peso, attività, numero di pasti, preferenze, intolleranze e allergie. ${copy.why}`}
          </Body>
        </Section>

        <Section icon="calendar" title="Come è fatta la tua giornata">
          <Body>{day.summary}</Body>
          {day.trainingNote ? <Body>{day.trainingNote}</Body> : null}
          <Body>
            Ogni pasto è un piatto completo della cucina mediterranea: una fonte proteica, una di carboidrati, verdura e
            grassi buoni. I grammi sono indicati a crudo e per la pasta e i cereali a secco. Ogni alimento ha delle
            sostituzioni equivalenti, così puoi variare senza uscire dai target.
          </Body>
          <Body>
            I piatti ruotano durante la settimana per non ripetersi troppo; il sabato sera è un pasto libero, da gestire
            con buon senso.
          </Body>
        </Section>

        <Section icon="trendUp" title="Mese per mese">
          <View style={styles.months}>
            {plan.months.map((m) => {
              const done = m.monthIndex < currentMonth;
              const current = m.monthIndex === currentMonth;
              return (
                <View key={m.monthIndex} style={styles.monthRow}>
                  <View
                    style={[
                      styles.monthDot,
                      { backgroundColor: done ? theme.brandGreen : current ? theme.accent : theme.backgroundElement },
                    ]}>
                    {done ? (
                      <Icon name="check" size={13} color="#FFFFFF" />
                    ) : (
                      <ThemedText style={[styles.monthDotText, { color: current ? theme.onAccent : theme.textTertiary }]}>
                        {m.monthIndex}
                      </ThemedText>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <ThemedText style={styles.monthTitle}>
                      {`Mese ${m.monthIndex} · ${DIET_PHASE_SHORT_LABEL[m.phase]}`}
                      {current ? <ThemedText style={[styles.monthTag, { color: theme.accent }]}>{'  in corso'}</ThemedText> : null}
                    </ThemedText>
                    <Body>{`${m.calorieTarget} kcal · P ${m.macroTargetsG.protein} g · C ${m.macroTargetsG.carbs} g · G ${m.macroTargetsG.fats} g`}</Body>
                    <Body>{PHASE_DETAIL[m.phase]}</Body>
                  </View>
                </View>
              );
            })}
          </View>
        </Section>

        <Section icon="refresh" title="Come si adatta a te">
          <Body>
            Ogni mese si sblocca solo dopo il check-in mensile: quanto sei riuscito a seguire il piano, energia, fame,
            difficoltà incontrate e cosa vorresti cambiare. Insieme alle tue pesate, le risposte ricalibrano calorie e macro
            del mese successivo.
          </Body>
          <Body>
            Gli alimenti sono scelti escludendo quelli non compatibili con intolleranze, allergie e preferenze che hai
            indicato: se qualcosa cambia, aggiorna le tue risposte e il piano si adegua.
          </Body>
        </Section>

        <Section icon="bulb" title="Per ottenere il massimo">
          <Body>
            Pesa gli alimenti almeno le prime settimane, bevi almeno 2 litri d’acqua al giorno e registra i pasti nella
            sezione Nutrizione. Se sgarri non compensare con il digiuno: riprendi dal pasto successivo.
          </Body>
        </Section>
      </ScrollView>
    </GlassPopup>
  );
}

function describeDay(month: DietMonthPlan | undefined): { summary: string; trainingNote?: string } {
  if (!month) return { summary: '' };
  const meals = month.weeklySplit[0]?.meals.length ?? 0;
  const summary = `Ogni giorno prevede ${meals} ${meals === 1 ? 'pasto' : 'pasti'} per circa ${month.calorieTarget} kcal, con ${month.macroTargetsG.protein} g di proteine, ${month.macroTargetsG.carbs} g di carboidrati e ${month.macroTargetsG.fats} g di grassi.`;

  const training = month.weeklySplit.filter((d) => d.isTrainingDay && d.calorieTarget);
  const rest = month.weeklySplit.filter((d) => !d.isTrainingDay && d.calorieTarget);
  if (training.length === 0 || rest.length === 0) return { summary };
  const avg = (days: typeof training) => Math.round(days.reduce((sum, d) => sum + (d.calorieTarget ?? 0), 0) / days.length);
  const trainingNote = `Il piano segue i tuoi allenamenti: nei giorni in cui ti alleni mangi di più (circa ${avg(training)} kcal), nei giorni di riposo un po’ meno (circa ${avg(rest)} kcal).`;
  return { summary, trainingNote };
}

function Section({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name={icon} size={16} color={theme.accent} />
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      </View>
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
    maxHeight: 540,
  },
  content: {
    gap: 18,
    paddingBottom: 4,
  },
  section: {
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '700',
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  months: {
    gap: 14,
    marginTop: 4,
  },
  monthRow: {
    flexDirection: 'row',
    gap: 10,
  },
  monthDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  monthDotText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  monthTitle: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '700',
  },
  monthTag: {
    fontSize: 11.5,
    fontWeight: '700',
  },
});
