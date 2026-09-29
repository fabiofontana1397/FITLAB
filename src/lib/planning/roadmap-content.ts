import type { IconName } from '@/components/ui/icon';
import type { Goal } from '@/lib/mock/types';

/** The plain-language "why" behind the generated plans — shown once
 * during onboarding (onboarding-roadmap.tsx) and again, on demand, from
 * Home's training/diet quick-link cards (plan-theory-modal.tsx), so
 * both places agree on the same explanation instead of drifting apart. */
export type RoadmapStep = { icon: IconName; period: string; title: string; description: string };

type GoalCategory = 'bulk' | 'cut' | 'maintain';

export function goalCategory(goal?: string): GoalCategory {
  if (goal === 'gainMuscle' || goal === 'gainStrength') return 'bulk';
  if (goal === 'loseFat') return 'cut';
  return 'maintain';
}

export const DIET_STEPS: Record<GoalCategory, RoadmapStep[]> = {
  bulk: [
    {
      icon: 'calendar',
      period: 'Settimane 1-2',
      title: 'Adattamento',
      description: 'Partiamo dal tuo mantenimento calorico per abituare corpo e abitudini al nuovo piano, senza scossoni.',
    },
    {
      icon: 'trendUp',
      period: 'Dal mese 2',
      title: 'Aumento calorico progressivo',
      description: 'Le calorie salgono gradualmente verso il ritmo di crescita ottimale, fino al picco della fase di massa.',
    },
    {
      icon: 'scale',
      period: 'Ogni settimana',
      title: 'Peso monitorato',
      description: 'Una pesata a settimana: guardiamo la tendenza, non il singolo giorno, per non farci ingannare dalle oscillazioni.',
    },
    {
      icon: 'target',
      period: 'Ogni mese',
      title: 'Calibrazione macro',
      description: 'A fine mese ricalcoliamo calorie e macro in base ai tuoi progressi reali: peso, energia, performance.',
    },
  ],
  cut: [
    {
      icon: 'calendar',
      period: 'Settimane 1-2',
      title: 'Adattamento',
      description: 'Iniziamo con un deficit lieve, per abituare corpo e abitudini senza cali di energia improvvisi.',
    },
    {
      icon: 'trendDown',
      period: 'Dal mese 2',
      title: 'Deficit progressivo',
      description: 'Il deficit calorico aumenta in modo controllato, per perdere grasso preservando la massa muscolare.',
    },
    {
      icon: 'scale',
      period: 'Ogni settimana',
      title: 'Peso monitorato',
      description: 'Una pesata a settimana: guardiamo la tendenza, non il singolo giorno, per non farci ingannare dalle oscillazioni.',
    },
    {
      icon: 'target',
      period: 'Ogni mese',
      title: 'Calibrazione macro',
      description: 'A fine mese ricalcoliamo calorie e macro in base al ritmo di perdita reale, senza estremizzare il deficit.',
    },
  ],
  maintain: [
    {
      icon: 'calendar',
      period: 'Settimane 1-2',
      title: 'Adattamento',
      description: 'Stabilizziamo abitudini e orari dei pasti attorno al tuo fabbisogno di mantenimento.',
    },
    {
      icon: 'trendUp',
      period: 'Dal mese 2',
      title: 'Aggiustamenti mirati',
      description: 'Piccoli aggiustamenti su calorie e macro, guidati da energia, sonno e performance in allenamento.',
    },
    {
      icon: 'scale',
      period: 'Ogni settimana',
      title: 'Peso monitorato',
      description: 'Una pesata a settimana per seguire la tendenza nel tempo, senza rincorrere il singolo dato.',
    },
    {
      icon: 'target',
      period: 'Ogni mese',
      title: 'Calibrazione macro',
      description: 'Ogni mese rivediamo il piano per restare allineati ai tuoi obiettivi di salute e forma fisica.',
    },
  ],
};

// Two variants instead of one static list — a beginner genuinely needs a
// technique/adattamento month, but telling an intermediate/expert lifter
// their plan "starts from the basics" is both wrong and demotivating.
// Mirrors what training-planner.ts itself does (skipExperiencedAdattamento):
// this text and the actual generated plan agree on whether month 1 is a
// ramp-up or already real progression.
export const TRAINING_STEPS_BEGINNER: RoadmapStep[] = [
  {
    icon: 'calendar',
    period: 'Mese 1',
    title: 'Adattamento e tecnica',
    description: 'Il primo mese punta su tecnica e adattamento: carichi gestibili per costruire una base solida e sicura.',
  },
  {
    icon: 'trendUp',
    period: 'Dal mese 2',
    title: 'Sovraccarico progressivo',
    description: 'Aumentiamo gradualmente peso, ripetizioni o volume settimana su settimana: è il motore della crescita.',
  },
  {
    icon: 'moon',
    period: 'Ogni 4-6 settimane',
    title: 'Settimana di scarico',
    description: 'Un breve periodo a intensità ridotta per favorire il recupero e continuare a progredire nel tempo.',
  },
  {
    icon: 'target',
    period: 'Ogni mese',
    title: 'Piano aggiornato',
    description: 'Rivediamo il tuo programma ogni mese: nuovi massimali, nuovi esercizi e volume calibrato sui progressi.',
  },
];

export const TRAINING_STEPS_EXPERIENCED: RoadmapStep[] = [
  {
    icon: 'calendar',
    period: 'Mese 1',
    title: 'Si parte già in progressione',
    description: 'Vista la tua esperienza, saltiamo il mese di sola tecnica: il carico di partenza è già tarato sul tuo livello.',
  },
  {
    icon: 'trendUp',
    period: 'Da subito',
    title: 'Sovraccarico progressivo',
    description: 'Aumentiamo peso, ripetizioni o volume settimana su settimana, seguendo le performance che ci segnali.',
  },
  {
    icon: 'moon',
    period: 'Ogni 4-6 settimane',
    title: 'Settimana di scarico',
    description: 'Un breve periodo a intensità ridotta per favorire il recupero e continuare a progredire nel tempo.',
  },
  {
    icon: 'target',
    period: 'Ogni mese',
    title: 'Piano aggiornato',
    description: 'Rivediamo il tuo programma ogni mese: nuovi massimali, nuovi esercizi e volume calibrato sui progressi.',
  },
];

/** Same "skip the beginner ramp-up" rule training-planner.ts uses. */
export function isExperiencedLifter(gymSkillLevel?: string): boolean {
  return gymSkillLevel === 'intermediate' || gymSkillLevel === 'expert';
}

export function dietRoadmapSteps(goal?: Goal | string): RoadmapStep[] {
  return DIET_STEPS[goalCategory(goal)];
}

export function trainingRoadmapSteps(gymSkillLevel?: string): RoadmapStep[] {
  return isExperiencedLifter(gymSkillLevel) ? TRAINING_STEPS_EXPERIENCED : TRAINING_STEPS_BEGINNER;
}
