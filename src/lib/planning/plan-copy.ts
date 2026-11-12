import type { Goal } from '@/lib/mock/types';
import type { PlanPhaseKind } from '@/lib/planning/types';

// Words shown on the Piani page: what each plan is called, what it is for and what every phase of it does.

export const GOAL_NAME: Record<Goal, string> = {
  loseFat: 'Definizione',
  gainMuscle: 'Ipertrofia',
  maintainImprove: 'Mantenimento',
  gainStrength: 'Forza',
  improveEndurance: 'Resistenza',
  generalHealth: 'Benessere',
};

/** What the diet does for each goal, as the diet card's headline. */
export const DIET_STRATEGY: Record<Goal, string> = {
  loseFat: 'Deficit calorico',
  gainMuscle: 'Surplus controllato',
  gainStrength: 'Leggero surplus',
  maintainImprove: 'Mantenimento',
  improveEndurance: 'Energia per la resistenza',
  generalHealth: 'Equilibrio mediterraneo',
};

/** The whole plan's objective, in a sentence, for the card's "Obiettivo del piano". */
export const TRAINING_GOAL_TEXT: Record<Goal, string> = {
  loseFat: 'Ridurre la massa grassa mantenendo il muscolo, con allenamenti progressivi e un dispendio energetico costante.',
  gainMuscle: 'Aumentare la massa muscolare con volume e carichi che crescono mese dopo mese.',
  gainStrength: 'Diventare più forte sui grandi movimenti, alzando i carichi in modo graduale e sicuro.',
  maintainImprove: 'Mantenere ciò che hai costruito e migliorarlo con piccoli passi, senza stress.',
  improveEndurance: 'Costruire fiato e resistenza, aumentando la capacità di sostenere lo sforzo nel tempo.',
  generalHealth: 'Stare bene ogni giorno: una routine regolare di movimento che puoi mantenere a lungo.',
};

export const DIET_GOAL_TEXT: Record<Goal, string> = {
  loseFat: 'Un deficit calorico moderato, con proteine alte per perdere grasso senza perdere muscolo.',
  gainMuscle: 'Un leggero surplus calorico, con proteine e carboidrati a sostegno della crescita muscolare.',
  gainStrength: 'Energia sufficiente per allenamenti pesanti e recupero, con un surplus contenuto.',
  maintainImprove: 'Calorie in equilibrio e una distribuzione dei macro che sostiene il tuo livello attuale.',
  improveEndurance: 'Carboidrati a sufficienza per alimentare le sessioni lunghe e recuperare bene.',
  generalHealth: 'Un’alimentazione varia ed equilibrata, sul modello mediterraneo.',
};

export const DIET_PHASE_SHORT_LABEL: Record<PlanPhaseKind, string> = {
  adattamento: 'Abitudini e porzioni',
  progressione: 'Target pieni',
  consolidamento: 'Consolidamento',
};

/** Why this diet, per goal: the plan's description. */
export const DIET_GOAL_COPY: Record<Goal, { name: string; why: string }> = {
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
export const DIET_PHASE_DETAIL: Record<PlanPhaseKind, string> = {
  adattamento:
    'Prendi confidenza con orari, porzioni e pesate. I target sono già quelli giusti per te, ma la priorità è la regolarità: segui il piano il più possibile e annota come ti senti.',
  progressione:
    'Calorie e macro lavorano a pieno regime verso il tuo obiettivo. A ogni check-in i target vengono ritoccati in base al peso, all’energia e a quanto sei riuscito a seguire il piano.',
  consolidamento:
    'I target si stabilizzano: consolidi le abitudini e i risultati raggiunti, così il nuovo equilibrio dura anche dopo il percorso.',
};

/** Why this program, per goal: the plan's description. */
export const TRAINING_GOAL_COPY: Record<Goal, { name: string; why: string }> = {
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
export const TRAINING_PHASE_DETAIL: Record<PlanPhaseKind, string> = {
  adattamento:
    'Carichi leggeri e gestibili, più attenzione all’esecuzione che al peso. Impari i movimenti, abitui articolazioni e tendini e trovi i tuoi carichi di partenza.',
  progressione:
    'Il cuore del programma: gli esercizi principali passano a ripetizioni più basse e carichi più alti, i carichi consigliati salgono di circa il 4% al mese, dal terzo mese di progressione gli esercizi multiarticolari guadagnano una serie e ogni due mesi cambiano gli esercizi complementari. Gli esercizi principali restano, così puoi misurare i progressi.',
  consolidamento:
    'Meno serie e intensità mantenuta: consolidi la forza e la tecnica conquistate smaltendo la fatica accumulata, e arrivi pronto al ciclo successivo.',
};
