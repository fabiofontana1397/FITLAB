/**
 * The coach that works without any AI call: it answers questions and writes the
 * Home insights from facts the app already holds (weight, plan, today's training,
 * meals, adherence). Pure functions over a `CoachFacts` snapshot — no stores, no
 * network — so they cost nothing and can be tested outside the app.
 *
 * The Claude-powered coach (supabase/functions/chat, generate-insights) is switched
 * off by default (see ai-config.ts); when it is on, this is also the fallback if the
 * call fails.
 */
import type { Insight } from '@/lib/mock/types';

import type { ClientContext } from './build-client-context';

export type CoachFacts = ClientContext & {
  weight: {
    currentKg: number | null;
    startKg: number | null;
    targetKg: number | null;
    /** Least-squares trend over the recent weigh-ins; null until there are enough of them. */
    trendKgPerWeek: number | null;
    weighIns: number;
    lastWeighInDate: string | null;
  };
  /** Index of a plan month that ended and still has no check-in, if any. */
  checkinDue: number | null;
};

const GOAL_LABEL: Record<string, string> = {
  loseFat: 'perdere grasso',
  gainMuscle: 'aumentare la massa muscolare',
  maintainImprove: 'mantenere e migliorare la forma',
  gainStrength: 'aumentare la forza',
  improveEndurance: 'migliorare la resistenza',
  generalHealth: 'migliorare la salute generale',
};

const PHASE_LABEL: Record<string, string> = {
  adattamento: 'adattamento',
  progressione: 'progressione',
  consolidamento: 'consolidamento',
};

const kg = (n: number) => `${n.toFixed(1).replace('.', ',')} kg`;
const signed = (n: number, digits = 2) => `${n > 0 ? '+' : ''}${n.toFixed(digits).replace('.', ',')}`;
const goalOf = (f: CoachFacts) => GOAL_LABEL[f.plan?.goal ?? ''] ?? 'raggiungere il tuo obiettivo';

/** Weeks to the goal weight at the pace the plan aims for (null if it makes no sense). */
function weeksLeft(f: CoachFacts): number | null {
  const { currentKg, targetKg } = f.weight;
  const pace = f.plan?.expectedWeeklyKg ?? 0;
  if (currentKg == null || targetKg == null || pace === 0) return null;
  const delta = targetKg - currentKg;
  if (delta * pace <= 0) return null;
  return Math.abs(delta / pace);
}

function weightLine(f: CoachFacts): string {
  const w = f.weight;
  if (w.currentKg == null) return 'Non hai ancora registrato il peso: aggiungilo da Progressi e lo seguo nel tempo.';
  let text = `Il tuo ultimo peso è ${kg(w.currentKg)}`;
  if (w.startKg != null && w.weighIns > 1 && w.startKg !== w.currentKg) text += ` (partivi da ${kg(w.startKg)}, ${signed(w.currentKg - w.startKg, 1)} kg)`;
  text += '.';
  if (w.trendKgPerWeek == null) {
    text += ' Servono almeno due o tre pesate distanziate di un paio di settimane per misurare l’andamento: pesati con regolarità, sempre alla stessa ora.';
  } else {
    text += ` Negli ultimi tempi la tendenza è ${signed(w.trendKgPerWeek)} kg a settimana`;
    if (f.plan) text += ` (il piano ne prevede ${signed(f.plan.expectedWeeklyKg)})`;
    text += '.';
  }
  return text;
}

// ---------------------------------------------------------------- replies --

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

type Intent = 'greeting' | 'medical' | 'goal' | 'weight' | 'training' | 'nutrition' | 'plan' | 'help';

const PATTERNS: [Intent, RegExp][] = [
  ['medical', /dolor|infortun|male alla|malessere|malat|medic|farmac|integrator|patolog|gravid|diabet|pressione/],
  ['goal', /obiettivo|manca|quando (arriv|raggiung)|traguardo|quanto tempo/],
  ['weight', /\bpeso\b|pesat|\bkg\b|chili|bilancia|dimagr|ingrass|massa/],
  ['training', /allen|scheda|esercizi|palestra|corsa|seduta|workout|serie|riposo|muscol/],
  ['nutrition', /calori|mangi|pasto|pasti|dieta|protein|macro|fame|cibo|carboid|grassi|colazione|pranzo|cena|spuntin/],
  ['plan', /piano|mese|fase|ricalibr|check|progress|andamento/],
  ['greeting', /^(ciao|salve|buongiorno|buonasera|hey|ehi)\b/],
];

function detectIntent(question: string): Intent {
  const q = norm(question);
  for (const [intent, re] of PATTERNS) if (re.test(q)) return intent;
  return 'help';
}

export const SUGGESTED_PROMPTS = [
  'Come va il mio peso?',
  'Cosa devo allenare oggi?',
  'Quanto manca al mio obiettivo?',
  'Come vanno le mie calorie oggi?',
];

export function localReply(question: string, f: CoachFacts): string {
  switch (detectIntent(question)) {
    case 'greeting':
      return 'Ciao! Posso dirti come va il peso, cosa allenare oggi, a che punto sei con le calorie e quanto manca al tuo obiettivo. Cosa vuoi sapere?';

    case 'medical':
      return 'Su dolori, infortuni, malattie o integratori non posso darti indicazioni: serve il parere di un medico o di un professionista. Posso però aiutarti ad adattare allenamento e pasti del piano dopo che ti sei confrontato con lui.';

    case 'weight':
      return weightLine(f);

    case 'goal': {
      const w = f.weight;
      if (!f.plan) return 'Non hai ancora un piano generato: completa il questionario e ti dico quanto manca.';
      if (w.targetKg == null || w.currentKg == null) {
        return `Il tuo obiettivo è ${goalOf(f)}. Non hai indicato un peso da raggiungere, quindi seguo il piano mese per mese: sei al mese ${f.plan.monthIndex} di ${f.plan.durationMonths} (${PHASE_LABEL[f.plan.phase] ?? f.plan.phase}).`;
      }
      const weeks = weeksLeft(f);
      const gap = Math.abs(w.targetKg - w.currentKg);
      if (weeks == null) return `Sei a ${kg(w.currentKg)} e il tuo peso obiettivo è ${kg(w.targetKg)}. Con il ritmo che il piano prevede non riesco a stimare una data: ricontrolla il peso obiettivo dal Profilo.`;
      const months = weeks / 4.3;
      return `Ti mancano circa ${kg(gap)} per arrivare a ${kg(w.targetKg)} (${goalOf(f)}). Al ritmo previsto dal piano sono circa ${Math.round(weeks)} settimane, ${months < 1.5 ? 'poco più di un mese' : `circa ${Math.round(months)} mesi`}. Sei al mese ${f.plan.monthIndex} di ${f.plan.durationMonths}.`;
    }

    case 'training': {
      const t = f.trainingToday;
      let text: string;
      if (!t) text = 'Non ho un programma di allenamento per oggi: se hai scelto solo la dieta è normale, altrimenti genera il piano dalla tab Training.';
      else if (t.planType === 'rest') text = 'Oggi è giorno di riposo programmato: recupera, cammina un po’ e mangia secondo il piano.';
      else if (t.planType === 'cardio') text = `Oggi in programma: ${t.title}.${t.alreadyLoggedToday ? ' L’hai già registrato, bene così.' : ' Quando hai finito registralo da Home.'}`;
      else {
        const list = (t.exercises ?? []).slice(0, 5).map((e) => `${e.name} ${e.targetSets}x${e.targetReps}`).join(', ');
        text = `Oggi: ${t.title}${list ? ` — ${list}${(t.exercises?.length ?? 0) > 5 ? '…' : ''}` : ''}.${t.alreadyLoggedToday ? ' Hai già completato tutti gli esercizi.' : ''}`;
      }
      const a = f.trainingAdherence14d;
      if (a && a.planned > 0) text += ` Negli ultimi 14 giorni hai fatto ${a.done} sedute su ${a.planned} previste.`;
      return text;
    }

    case 'nutrition': {
      const n = f.nutritionToday;
      if (!n) return 'Non ho ancora dati sui tuoi pasti: registrali dalla tab Nutrizione e ti dico come stai andando.';
      const left = n.kcalTarget - n.kcalEaten;
      let text = `Oggi hai registrato ${n.kcalEaten} kcal su ${n.kcalTarget} previste e ${n.proteinEatenG} g di proteine su ${n.proteinTargetG}.`;
      if (n.kcalEaten === 0) text = `Oggi non hai ancora registrato pasti: il target è ${n.kcalTarget} kcal e ${n.proteinTargetG} g di proteine. Puoi seguire il piano alimentare con un tocco dalla tab Nutrizione.`;
      else if (left > 0) text += ` Ti restano circa ${left} kcal${n.proteinTargetG - n.proteinEatenG > 10 ? ` e ${n.proteinTargetG - n.proteinEatenG} g di proteine da coprire` : ''}.`;
      else text += ' Hai raggiunto il target di oggi.';
      if (n.loggingStreakDays >= 3) text += ` Sono ${n.loggingStreakDays} giorni di fila che registri i pasti.`;
      return text;
    }

    case 'plan': {
      if (!f.plan) return 'Non hai ancora un piano generato: completa il questionario e lo creo.';
      const p = f.plan;
      let text = `Sei al mese ${p.monthIndex} di ${p.durationMonths}, fase di ${PHASE_LABEL[p.phase] ?? p.phase}. Il piano punta a ${goalOf(f)} con ${p.dailyBalanceKcal === 0 ? 'calorie di mantenimento' : `${signed(p.dailyBalanceKcal, 0)} kcal al giorno rispetto al dispendio`}, circa ${signed(p.expectedWeeklyKg)} kg a settimana.`;
      if (p.lastRecalibration) text += ` L’ultima revisione (mese ${p.lastRecalibration.monthIndex}): ${p.lastRecalibration.changes.join(' ')}`;
      else text += ' Alla fine del primo mese rivedo dieta e allenamento in base ai tuoi progressi.';
      if (f.checkinDue != null) text += ` Il check-in del mese ${f.checkinDue} è disponibile dal Profilo.`;
      return text;
    }

    default:
      return 'Posso rispondere su peso, allenamento di oggi, calorie e proteine, obiettivo e piano del mese. Prova con "Come va il mio peso?" o "Cosa devo allenare oggi?".';
  }
}

// --------------------------------------------------------------- insights --

/** Up to four insights from the data the app has, most useful first. Stable ids, so a refresh never flickers. */
export function localInsights(f: CoachFacts): Insight[] {
  const out: Insight[] = [];

  if (f.checkinDue != null) {
    out.push({
      id: `checkin-${f.checkinDue}`,
      tone: 'neutral',
      headline: `Check-in del mese ${f.checkinDue} disponibile`,
      body: 'Hai finito un mese del piano: pesati e rispondi a poche domande dal Profilo, così rivedo dieta e allenamento in base ai tuoi progressi.',
    });
  }

  const w = f.weight;
  if (w.currentKg == null || w.weighIns < 2 || w.trendKgPerWeek == null) {
    out.push({
      id: 'weight-more-data',
      tone: 'neutral',
      headline: 'Pesati con regolarità',
      body: `${w.weighIns <= 1 ? 'Hai registrato una sola misurazione' : `Hai registrato ${w.weighIns} misurazioni`}: ne servono almeno due o tre distanziate di un paio di settimane per capire se stai andando verso il tuo obiettivo.`,
    });
  } else {
    const expected = f.plan?.expectedWeeklyKg ?? 0;
    const t = w.trendKgPerWeek;
    if (expected === 0) {
      out.push({ id: 'weight-trend', tone: Math.abs(t) < 0.25 ? 'positive' : 'neutral', headline: 'Peso stabile', body: `La tendenza è ${signed(t)} kg a settimana: il piano punta a mantenere il peso.` });
    } else if (t * expected < 0 && Math.abs(t) > 0.1) {
      out.push({ id: 'weight-trend', tone: 'warning', headline: 'Il peso va nella direzione opposta', body: `La tendenza è ${signed(t)} kg a settimana contro i ${signed(expected)} previsti. A fine mese il check-in rivede il piano; intanto controlla di seguire i pasti e le sedute.` });
    } else if (Math.abs(t) >= Math.abs(expected) * 0.6) {
      out.push({ id: 'weight-trend', tone: 'positive', headline: 'Sei in linea con il piano', body: `La tendenza è ${signed(t)} kg a settimana, vicina ai ${signed(expected)} previsti. Continua così.` });
    } else {
      out.push({ id: 'weight-trend', tone: 'neutral', headline: 'Progressi più lenti del previsto', body: `La tendenza è ${signed(t)} kg a settimana contro i ${signed(expected)} previsti: serve ancora qualche settimana di dati, poi il check-in mensile aggiusta il piano.` });
    }
  }

  const a = f.trainingAdherence14d;
  if (a && a.planned > 0) {
    const rate = a.done / a.planned;
    out.push(
      rate >= 0.8
        ? { id: 'training-adherence', tone: 'positive', headline: 'Allenamenti costanti', body: `Hai completato ${a.done} sedute su ${a.planned} negli ultimi 14 giorni.` }
        : rate < 0.5
          ? { id: 'training-adherence', tone: 'warning', headline: 'Allenamenti in calo', body: `Solo ${a.done} sedute su ${a.planned} negli ultimi 14 giorni. Anche una seduta più breve conta: ricominciare è la parte più importante.` }
          : { id: 'training-adherence', tone: 'neutral', headline: 'Allenamenti a metà', body: `Hai fatto ${a.done} sedute su ${a.planned} previste negli ultimi 14 giorni: prova a fissare giorno e ora delle prossime.` },
    );
  }

  const n = f.nutritionToday;
  if (n) {
    if (n.kcalEaten === 0) {
      out.push({ id: 'nutrition-today', tone: 'neutral', headline: 'Registra i pasti di oggi', body: `Il target di oggi è ${n.kcalTarget} kcal e ${n.proteinTargetG} g di proteine: dalla tab Nutrizione puoi seguire il piano alimentare con un tocco.` });
    } else if (n.proteinEatenG < n.proteinTargetG * 0.7 && n.kcalEaten > n.kcalTarget * 0.6) {
      out.push({ id: 'nutrition-today', tone: 'warning', headline: 'Proteine indietro', body: `Hai ${n.proteinEatenG} g di proteine su ${n.proteinTargetG}: aggiungi una fonte proteica al prossimo pasto.` });
    } else if (n.loggingStreakDays >= 3) {
      out.push({ id: 'nutrition-streak', tone: 'positive', headline: `${n.loggingStreakDays} giorni di fila`, body: 'Registrare i pasti con costanza è ciò che rende utili le revisioni mensili del piano.' });
    }
  }

  const t = f.trainingToday;
  if (t?.planType === 'rest') out.push({ id: 'rest-day', tone: 'positive', headline: 'Oggi riposo', body: 'Il recupero fa parte del piano: dormi bene e mangia secondo le quantità di oggi.' });
  else if (t && !t.alreadyLoggedToday) out.push({ id: 'training-today', tone: 'neutral', headline: `Oggi: ${t.title}`, body: t.planType === 'workout' && t.exercises?.length ? `${t.exercises.length} esercizi in programma. Apri Training per i dettagli e spunta man mano.` : 'Registra la seduta da Home quando hai finito.' });

  return out.slice(0, 4);
}
