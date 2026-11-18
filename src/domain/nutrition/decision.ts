/**
 * Module C — Decision engine. Walks the decision hierarchy in a fixed order and returns the calorie step plus
 * every non-caloric intervention, with the rule behind each one and the alternatives it ruled out:
 *
 *   1. data quality and completeness        6. sustainability of the plan
 *   2. adherence                            7. calories
 *   3. weight trend                         8. macronutrients
 *   4. hunger, energy, recovery             9. foods, meals, times
 *   5. organisational and food difficulties 10. (the plan is then generated from these decisions)
 *
 * Changing calories is never the automatic answer to the scale: a low or explained adherence, strained hunger or
 * energy, unrepresentative data or a temporary event all come first. Pure and deterministic.
 */
import { NUTRITION_PARAMS as P } from './params';
import type { AdherenceAnalysis, DietAdaptations, Intervention, MonitoringData, SustainabilityAnalysis, WeightAnalysis } from './types';

export type DecisionInput = {
  goalDirection: number;
  mode: 'diet' | 'training' | 'both';
  monitoring: MonitoringData;
  weight: WeightAnalysis;
  adherence: AdherenceAnalysis;
  sustainability: SustainabilityAnalysis;
  supervision: string[];
  /** Calorie steps of the previous check-ins, oldest first. */
  previousSteps: number[];
  previousAdaptations?: DietAdaptations;
  /** Weekday slots the person eats (to know if a snack exists, which slots can move). */
  slots: string[];
};

export type Decision = {
  calorieStep: number;
  interventions: Intervention[];
  rules: string[];
  excluded: string[];
  adaptations: DietAdaptations;
  expectedOutcome: string;
  /** Hold every calorie change and ask for a professional. */
  supervision: boolean;
};

const roundTo50 = (n: number) => Math.round(n / 50) * 50;

export function decide(input: DecisionInput): Decision {
  const { goalDirection: d, monitoring: m, weight: w, adherence: a, sustainability: s } = input;
  const C = P.calories;
  const interventions: Intervention[] = [];
  const rules: string[] = [];
  const excluded: string[] = [];
  const add = (kind: Intervention['kind'], text: string, rule: string) => {
    interventions.push({ kind, text, rule });
    if (!rules.includes(rule)) rules.push(rule);
  };
  let step = 0;
  let caloriesHeld = false;

  // ---------------------------------------------------------------- 1. data quality / supervision
  const supervision = input.supervision.length > 0;
  if (supervision) {
    caloriesHeld = true;
    add('professional_review', `Calorie non modificate in automatico (${input.supervision.join(', ')}): il piano va rivisto con un medico o un nutrizionista.`, 'R1 supervisione professionale');
    excluded.push('Qualsiasi modifica calorica automatica: esclusa perché la situazione richiede supervisione professionale.');
  }
  if (!caloriesHeld && w.classification === 'insufficient_data') {
    caloriesHeld = true;
    add('request_info', 'Calorie invariate: le pesate del mese non bastano per valutare. Pesati almeno 2 volte a settimana, alla stessa ora, per tutto il mese.', 'R2 dati insufficienti');
    excluded.push('Modificare le calorie su una o due pesate: escluso, una singola misura non distingue grasso, acqua e glicogeno.');
  }
  if (!caloriesHeld && w.classification === 'temporary_variation') {
    caloriesHeld = true;
    add('confirm_calories', 'Calorie confermate: la variazione di peso del mese coincide con un evento temporaneo e non è costante. La rivaluto al prossimo check-in.', 'R2 variazione temporanea');
    excluded.push('Correggere le calorie: escluso, una variazione non costante legata a viaggi, ciclo, malattia o eventi non indica un cambio di massa grassa.');
  }

  // ---------------------------------------------------------------- 2–3. adherence and weight
  const cls = w.classification;
  const stalling = cls === 'plateau' || cls === 'too_slow' || cls === 'wrong_direction';
  if (!caloriesHeld) {
    if (a.level === 'low') {
      // the weight shows what was eaten, not what the plan prescribes: fix the plan's sustainability first
      if (d < 0 && cls === 'too_fast') {
        step = C.fastStep;
        rules.push('R5 dimagrimento troppo rapido (sicurezza)');
      } else {
        caloriesHeld = true;
        rules.push('R3 aderenza bassa: priorità alla sostenibilità');
        if (stalling || cls === 'weight_up' || cls === 'weight_down')
          excluded.push(`${d > 0 ? 'Aumentare' : 'Ridurre'} le calorie: escluso, con l'aderenza bassa il risultato dipende da quanto il piano è stato seguito, non dai suoi numeri.`);
      }
    } else if (a.level === 'medium' && a.causes.length > 0 && cls !== 'on_track' && cls !== 'too_fast') {
      caloriesHeld = true;
      rules.push('R4 causa identificata: si interviene sulla causa');
      excluded.push(`Modificare le calorie: escluso, la causa individuata (${a.causes.join(', ')}) va risolta prima di toccare i numeri del piano.`);
    } else {
      const good = w.quality === 'good';
      const scale = a.level === 'medium' ? 0.5 : 1;
      if (d < 0) {
        if (cls === 'too_fast') { step = C.fastStep; rules.push('R5 dimagrimento troppo rapido'); }
        else if (cls === 'plateau' || cls === 'wrong_direction') {
          if (good) { step = -C.stallStep * scale; rules.push(cls === 'plateau' ? 'R5 stallo reale con aderenza adeguata' : 'R5 peso in aumento con aderenza adeguata'); }
          else { add('request_info', 'Lo stallo non è ancora dimostrato: servono 3–4 settimane di pesate regolari prima di ridurre le calorie.', 'R2 dati non rappresentativi'); }
        } else if (cls === 'too_slow') {
          if (good) { step = -C.slowStep * scale; rules.push('R5 dimagrimento lento con aderenza adeguata'); }
          else add('request_info', 'Progressi lenti ma su poche pesate: calorie invariate finché il trend non è confermato.', 'R2 dati non rappresentativi');
        }
      } else if (d > 0) {
        if (cls === 'plateau' || cls === 'wrong_direction') {
          if (good) { step = C.stallStep * scale; rules.push('R6 peso fermo in fase di massa'); }
          else add('request_info', 'Peso fermo su poche pesate: calorie invariate finché il trend non è confermato.', 'R2 dati non rappresentativi');
        } else if (cls === 'too_slow') {
          if (good) { step = C.slowStep * scale; rules.push('R6 aumento lento in fase di massa'); }
        } else if (cls === 'too_fast') {
          if (w.persistent && good) { step = -C.fastStep * scale; rules.push('R6 aumento troppo rapido e costante'); }
          else { rules.push('R6 aumento rapido non confermato'); excluded.push('Ridurre il surplus: escluso finché l’aumento rapido non è confermato da tutto il mese.'); }
        }
      } else if (cls === 'weight_up' || cls === 'weight_down') {
        if (w.persistent && good) { step = (cls === 'weight_up' ? -C.driftStep : C.driftStep) * scale; rules.push(`R7 mantenimento: peso in ${cls === 'weight_up' ? 'salita' : 'discesa'} costante`); }
        else { rules.push('R7 mantenimento: variazione isolata'); excluded.push('Correggere le calorie: escluso, la variazione non è costante nel mese.'); }
      }
      if (scale < 1 && step !== 0) rules.push('R4 aderenza parziale: passo dimezzato');
    }
  }

  // ---------------------------------------------------------------- 4. hunger, energy, recovery (modulate cuts)
  const hungry = m.hunger === 'often' || m.hunger === 'always';
  const lowEnergy = m.energy === 'low' || m.energy === 'veryLow';
  if (step < 0) {
    if (s.level === 'critical') {
      excluded.push(`Ridurre le calorie di ${-step} kcal: escluso, energia molto bassa o fame costante sconsigliano ulteriori restrizioni.`);
      step = 0;
      rules.push('R8 sostenibilità critica: nessuna restrizione');
    } else if ((hungry || lowEnergy || m.quantity?.direction === 'tooLittle') && -step > C.strainedCut && d <= 0) {
      excluded.push(`Taglio pieno di ${-step} kcal: escluso per ${[hungry ? 'fame frequente' : '', lowEnergy ? 'energia bassa' : '', m.quantity?.direction === 'tooLittle' ? 'porzioni percepite scarse' : ''].filter(Boolean).join(' e ')}; prima si migliora la sazietà.`);
      step = -C.strainedCut;
      rules.push('R8 fame/energia: taglio ridotto');
    }
  }
  if (step > 0 && d < 0 && (hungry || lowEnergy || m.difficulties.includes('soreness')) && cls === 'too_fast') {
    step = Math.min(step + 50, C.maxMonthlyStep);
    rules.push('R8 dimagrimento rapido con fame/stanchezza: aumento più deciso');
  }
  if (d > 0 && step > 0 && m.quantity?.direction === 'tooMuch' && step > C.slowStep) {
    excluded.push(`Aumento di ${step} kcal: ridotto a ${C.slowStep} perché le quantità sono già difficili da mangiare; il resto arriva dalla densità dei pasti.`);
    step = C.slowStep;
    rules.push('R9 quantità eccessive in fase di massa');
  }

  // no see-saw: a change against last month's direction is halved — except when it corrects an overshoot
  // (too fast), which is exactly what last month's change may have caused
  const last = input.previousSteps[input.previousSteps.length - 1] ?? 0;
  if (step !== 0 && last !== 0 && Math.sign(step) !== Math.sign(last) && cls !== 'too_fast') {
    step = step * C.reversalShare;
    rules.push('R10 nessuna oscillazione: passo dimezzato dopo una correzione opposta');
  }
  step = Math.max(-C.maxMonthlyStep, Math.min(C.maxMonthlyStep, roundTo50(step)));

  if (step === 0 && !supervision) {
    if (cls === 'on_track') add('confirm_calories', 'Calorie confermate: i progressi sono in linea con il piano.', 'R5 in linea');
    else if (!interventions.some((i) => i.kind === 'confirm_calories' || i.kind === 'request_info')) add('confirm_calories', 'Calorie confermate: prima si interviene su come il piano viene seguito.', rules[rules.length - 1] ?? 'R3');
  } else if (step > 0) add('increase_calories', `Calorie +${step} kcal al giorno.`, rules[rules.length - 1]);
  else if (step < 0) add('decrease_calories', `Calorie ${step} kcal al giorno.`, rules[rules.length - 1]);

  // ---------------------------------------------------------------- 8–9. macros, meals, times, foods
  const prev = input.previousAdaptations ?? {};
  const ad: DietAdaptations = {
    mealTimes: { ...(prev.mealTimes ?? {}) },
    dislikedFoodIds: [...(prev.dislikedFoodIds ?? [])],
    extraPreferredFoodIds: [...(prev.extraPreferredFoodIds ?? [])],
    eatOut: prev.eatOut,
  };

  // satiety: frequent hunger on a deficit or maintenance → more protein (within limits) and more vegetable volume
  if (hungry && d <= 0) {
    ad.macroProfile = 'satiety';
    ad.highVolume = true;
    add('change_macros', 'Più proteine a ogni pasto (entro i limiti del piano) per aumentare la sazietà.', 'R11 fame frequente: sazietà');
    add('increase_volume', 'Porzioni di verdura più abbondanti a pranzo e cena: più volume a parità di calorie.', 'R11 fame frequente: sazietà');
  } else if (prev.highVolume && (m.hunger === 'sometimes' || hungry)) {
    ad.macroProfile = prev.macroProfile;
    ad.highVolume = true;
    rules.push('R11 sazietà mantenuta (fame non ancora risolta)');
  }

  // quantity: the direction decides, never the calories by themselves
  if (m.quantity?.direction === 'tooMuch') {
    ad.distribution = 'lighterMains';
    add('reduce_volume', 'Pranzo e cena più leggeri, con una parte delle calorie spostata su colazione e spuntini.', 'R9 quantità eccessive');
    if (d >= 0) {
      ad.energyDense = true;
      add('energy_density', 'Alimenti più densi di energia (meno verdure voluminose, carboidrati più concentrati, frutta secca): stesse calorie in meno volume.', 'R9 quantità eccessive');
    }
  } else if (m.quantity?.direction === 'tooLittle' && !hungry) {
    ad.highVolume = true;
    add('increase_volume', 'Più volume nei pasti principali a parità di calorie.', 'R9 quantità scarse');
  } else if (prev.energyDense && d > 0 && m.quantity?.direction !== 'tooLittle') {
    ad.energyDense = true;
    ad.distribution = prev.distribution;
  }
  if (hungry && !ad.distribution && input.slots.length >= 4) {
    ad.distribution = 'even';
    add('change_distribution', 'Calorie distribuite in modo più uniforme tra i pasti, per arrivare meno affamato ai pasti principali.', 'R11 fame frequente: distribuzione');
  }
  if (m.quantity && m.quantity.inferred) rules.push('R9 direzione delle quantità dedotta dalla fame');

  // times
  const timeKeys = Object.keys(m.preferredTimes);
  if (timeKeys.length > 0) {
    Object.assign(ad.mealTimes!, m.preferredTimes);
    add('change_times', `Nuovi orari: ${timeKeys.map((k) => `${k} ${m.preferredTimes[k]}`).join(', ')}.`, 'R12 orari richiesti');
  }
  if (m.wantsChange.includes('mealTimes') || m.difficulties.includes('mealTimes') || (m.skippedMeals === '3-5' || m.skippedMeals === 'gt5')) {
    ad.timeWindowMin = P.planning.flexibleWindowMin;
    add('change_times', `Orari flessibili: ogni pasto ha una finestra di ±${P.planning.flexibleWindowMin} minuti invece di un orario fisso.`, 'R12 difficoltà con gli orari');
  } else if (prev.timeWindowMin && a.level !== 'high') {
    ad.timeWindowMin = prev.timeWindowMin;
  }

  // foods
  if (m.foodsToReplace.length > 0) {
    ad.dislikedFoodIds = [...new Set([...ad.dislikedFoodIds!, ...m.foodsToReplace])];
    add('change_foods', `Tolti dal piano gli alimenti che hai chiesto di sostituire (${m.foodsToReplace.length}), con equivalenti dello stesso gruppo.`, 'R13 alimenti da sostituire');
  }
  if (m.foodsWanted.length > 0) {
    ad.extraPreferredFoodIds = [...new Set([...ad.extraPreferredFoodIds!, ...m.foodsWanted])].filter((id) => !ad.dislikedFoodIds!.includes(id));
    add('change_foods', `Aggiunti tra i preferiti gli alimenti che hai indicato (${m.foodsWanted.length}).`, 'R13 nuove preferenze');
  }
  if (m.wantsChange.includes('foodOptions') || m.difficulties.includes('foodType')) {
    ad.strongVariety = true;
    add('change_foods', 'Rotazione rafforzata: quasi tutti i piatti cambiano rispetto al mese scorso e le fonti proteiche si alternano di più, partendo dai tuoi alimenti preferiti.', 'R13 richiesta di alimenti diversi');
  }

  // eating out
  const outPerWeek = m.eatingOutPerWeek ?? m.notesFacts.eatingOut?.perWeek ?? null;
  if (outPerWeek != null && outPerWeek >= 1) {
    const slot = m.eatingOutSlot === 'pranzo' ? 'pranzo' : 'cena';
    ad.eatOut = { slot, perWeek: Math.min(outPerWeek, 4) };
    add('eat_out_alternatives', `${ad.eatOut.perWeek} ${slot === 'cena' ? 'cene' : 'pranzi'} a settimana diventano “fuori casa”: budget calorico del pasto e indicazioni pratiche su cosa ordinare, senza compensare con restrizioni negli altri giorni.`, 'R14 pasti fuori casa');
  } else if (m.eatingOutPerWeek === 0) {
    ad.eatOut = undefined;
  }

  // simplify
  const organisational = m.difficulties.includes('preparation') || m.difficulties.includes('organization') || m.events.includes('stress') || m.skippedMeals === '3-5' || m.skippedMeals === 'gt5';
  if (a.level === 'low' || organisational) {
    ad.simplify = true;
    add('simplify_week', 'Settimana più semplice: meno ricette diverse, colazioni e spuntini ricorrenti, piatti veloci o da portare con sé.', a.level === 'low' ? 'R3 aderenza bassa: piano più facile' : 'R15 difficoltà organizzative');
  } else if (prev.simplify && a.level === 'medium') {
    ad.simplify = true;
  }
  if (m.energy === 'veryLow' || (lowEnergy && a.level !== 'low' && step <= 0 && d < 0)) {
    add('request_info', 'Energia bassa: controlla sonno e recupero. Se la stanchezza continua il mese prossimo, parlane con il medico.', 'R8 energia bassa');
  }

  // training: signalled, never changed from the nutrition engine
  if (m.difficulties.includes('trainingTime') || m.wantsChange.includes('trainingDays'))
    add('training_signal', 'Tempo e giorni di allenamento: segnalati al piano di allenamento, che li valuta separatamente.', 'R16 segnali per l’allenamento');
  if (m.difficulties.includes('soreness') && input.mode !== 'diet' && d < 0)
    add('training_signal', 'Recupero difficile: i carboidrati restano concentrati nei giorni di allenamento.', 'R16 segnali per l’allenamento');

  if (m.activityChange === 'more' || m.activityChange === 'less')
    rules.push(`R17 attività ${m.activityChange === 'more' ? 'aumentata' : 'diminuita'}: stima del dispendio non aggiornata questo mese`);
  if (m.waistCm != null) rules.push('R18 circonferenza vita registrata');
  for (const q of m.clarifications) interventions.push({ kind: 'request_info', text: q, rule: 'R19 richiesta di chiarimento' });

  const expected =
    supervision
      ? 'Nessuna modifica automatica finché un professionista non rivede il piano.'
      : step === 0
        ? caloriesHeld
          ? 'Con le modifiche al piano (non alle calorie) l’aderenza dovrebbe migliorare; i numeri si rivalutano al prossimo check-in.'
          : `Proseguire al ritmo previsto (${w.expectedKgWeek > 0 ? '+' : ''}${w.expectedKgWeek.toFixed(2)} kg/sett.).`
        : `Con ${step > 0 ? '+' : ''}${step} kcal/giorno ci si attende circa ${((step * 7) / P.tdee.kcalPerKg > 0 ? '+' : '')}${((step * 7) / P.tdee.kcalPerKg).toFixed(2)} kg/sett. rispetto al ritmo attuale.`;

  return { calorieStep: step, interventions, rules, excluded, adaptations: ad, expectedOutcome: expected, supervision };
}
