import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { PHASE_SHORT_LABEL } from '@/components/training/plan-month-stepper';
import { useTheme } from '@/hooks/use-theme';
import type { Goal } from '@/lib/mock/types';
import type { PlanPhaseKind, TrainingMonthPlan, TrainingPlan } from '@/lib/planning/types';

const GOAL_COPY: Record<Goal, { name: string; why: string }> = {
  gainMuscle: {
    name: 'aumentare la massa muscolare',
    why: 'Per far crescere un muscolo serve dargli ogni settimana uno stimolo un po’ più impegnativo di quello a cui è abituato. Il programma lavora con serie nella zona di ipertrofia, recuperi medi e un volume che sale nel tempo.',
  },
  gainStrength: {
    name: 'aumentare la forza',
    why: 'La forza cresce allenando i movimenti fondamentali con carichi alti e poche ripetizioni, con recuperi lunghi e tecnica pulita. Il programma mette al centro gli esercizi principali e fa salire il carico mese dopo mese.',
  },
  loseFat: {
    name: 'perdere grasso',
    why: 'Mentre la dieta crea il deficit calorico, l’allenamento serve a mantenere (e se possibile aumentare) la massa muscolare, così il peso che perdi è grasso. Il programma unisce lavoro con i pesi e movimento per alzare il consumo settimanale.',
  },
  improveEndurance: {
    name: 'migliorare la resistenza',
    why: 'La resistenza si costruisce aumentando gradualmente il volume e alternando sedute facili a sedute più intense. Il programma dosa carico e recupero per farti reggere più a lungo senza sovraccaricarti.',
  },
  maintainImprove: {
    name: 'mantenerti e migliorarti',
    why: 'Per mantenere i risultati e continuare a migliorare servono costanza e stimoli che cambiano nel tempo. Il programma alterna periodi di progressione e periodi di consolidamento per evitare stalli.',
  },
  generalHealth: {
    name: 'stare in salute',
    why: 'L’obiettivo è muoverti con regolarità, rafforzare tutto il corpo e sentirti meglio ogni giorno, senza forzare. Il programma parte dai movimenti di base e cresce con te.',
  },
};

/** What a phase actually does to the sessions, in plain words. */
const PHASE_DETAIL: Record<PlanPhaseKind, string> = {
  adattamento:
    'Carichi leggeri e gestibili, più attenzione all’esecuzione che al peso. Impari i movimenti, abitui articolazioni e tendini e trovi i tuoi carichi di partenza.',
  progressione:
    'Il cuore del programma: i carichi consigliati salgono di circa il 4% al mese, dal terzo mese di progressione si aggiunge una serie e ogni due mesi cambiano gli esercizi complementari. I due esercizi principali di ogni seduta restano, così puoi misurare i progressi.',
  consolidamento:
    'Carichi e serie si stabilizzano al livello raggiunto: consolidi la forza e la tecnica conquistate e arrivi pronto al ciclo successivo, senza accumulare fatica.',
};

export type PlanOverviewPopupProps = {
  visible: boolean;
  onClose: () => void;
  plan: TrainingPlan;
  goal: Goal;
  currentMonth: number;
};

/** The full description of the training program behind the "Il tuo
 * percorso" banner: overall goal, how a week is built, what each month does
 * and how the plan adapts. Everything is read from the user's own plan. */
export function PlanOverviewPopup({ visible, onClose, plan, goal, currentMonth }: PlanOverviewPopupProps) {
  const theme = useTheme();
  const copy = GOAL_COPY[goal];
  const reference = plan.months.find((m) => m.monthIndex === currentMonth) ?? plan.months[0];
  const week = describeWeek(reference);

  return (
    <GlassPopup visible={visible} onClose={onClose} maxWidth={420}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
          <Icon name="barbell" size={18} color={theme.accent} />
        </View>
        <ThemedText type="subtitle" style={{ flex: 1 }}>
          Il tuo programma
        </ThemedText>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Chiudi">
          <Icon name="close" size={22} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Section icon="target" title={`Obiettivo: ${copy.name}`}>
          <Body>
            {`Un percorso di ${plan.durationMonths} ${plan.durationMonths === 1 ? 'mese' : 'mesi'} costruito sulle risposte del tuo questionario: obiettivo, livello, giorni disponibili, attrezzatura ed eventuali dolori o infortuni. ${copy.why}`}
          </Body>
        </Section>

        <Section icon="calendar" title="Come è fatta la tua settimana">
          <Body>{week.summary}</Body>
          {week.splitNote ? <Body>{week.splitNote}</Body> : null}
          <Body>
            Ogni esercizio ha serie, ripetizioni, recupero e tempo di esecuzione (es. 3-0-1: 3 secondi in discesa, nessuna
            pausa, 1 secondo in salita). Dove serve un peso trovi un carico consigliato di partenza, che si aggiorna con
            quelli che registri.
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
                      {`Mese ${m.monthIndex} · ${PHASE_SHORT_LABEL[m.phase]}`}
                      {current ? <ThemedText style={[styles.monthTag, { color: theme.accent }]}>{'  in corso'}</ThemedText> : null}
                    </ThemedText>
                    <Body>{m.focusNote}</Body>
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
            difficoltà incontrate e cosa vorresti cambiare. Insieme alle tue pesate e agli allenamenti completati, le
            risposte ricalibrano il mese successivo.
          </Body>
          <Body>
            Se l’energia è alta e hai completato almeno l’80% delle sedute, i carichi salgono di un ulteriore 3%. Se sei
            stanco, fatichi a recuperare o è stato difficile seguire il piano, gli allenamenti si alleggeriscono di una
            serie per esercizio. I carichi che registri diventano il tuo riferimento al posto di quelli consigliati.
          </Body>
          <Body>
            Gli esercizi sono scelti escludendo quelli non compatibili con dolori, infortuni e attrezzatura che hai
            indicato: se qualcosa cambia, aggiorna le tue risposte e il piano si adegua.
          </Body>
        </Section>

        <Section icon="bulb" title="Per ottenere il massimo">
          <Body>
            Scalda 5-10 minuti prima di ogni seduta, cura la tecnica prima del peso e rispetta i recuperi indicati. Dormi
            bene e segui il piano alimentare: è lì che il corpo si ricostruisce. Se senti dolore (non fatica) durante un
            esercizio fermati e sostituiscilo.
          </Body>
        </Section>
      </ScrollView>
    </GlassPopup>
  );
}

function describeWeek(month: TrainingMonthPlan | undefined): { summary: string; splitNote?: string } {
  if (!month) return { summary: '' };
  const workouts = month.weeklySplit.filter((d) => d.type === 'workout');
  const cardio = month.weeklySplit.filter((d) => d.type === 'cardio');
  const rest = month.weeklySplit.filter((d) => d.type === 'rest');
  const parts: string[] = [];
  if (workouts.length > 0) parts.push(`${workouts.length} ${workouts.length === 1 ? 'allenamento' : 'allenamenti'} con i pesi`);
  if (cardio.length > 0) parts.push(`${cardio.length} ${cardio.length === 1 ? 'uscita' : 'uscite'} di corsa`);
  parts.push(`${rest.length} ${rest.length === 1 ? 'giorno' : 'giorni'} di riposo`);
  const last = parts.pop();
  const summary = `Ogni settimana prevede ${parts.length > 0 ? `${parts.join(', ')} e ${last}` : last}. I giorni di riposo non sono tempo perso: è lì che i muscoli recuperano e si rafforzano.`;

  if (workouts.length === 0) return { summary };
  const splits = [...new Set(workouts.map((d) => d.title))];
  const avgExercises = Math.round(workouts.reduce((sum, d) => sum + (d.exercises?.length ?? 0), 0) / workouts.length);
  const splitNote =
    splits.length === 1
      ? `Ogni seduta è un ${splits[0]} di circa ${avgExercises} esercizi, così alleni tutto il corpo più volte a settimana.`
      : `Le sedute ruotano tra ${splits.slice(0, -1).join(', ')} e ${splits[splits.length - 1]}, con circa ${avgExercises} esercizi ciascuna: ogni gruppo muscolare viene allenato e ha il tempo di recuperare.`;
  return { summary, splitNote };
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
