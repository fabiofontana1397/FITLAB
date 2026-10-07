/**
 * Plan-generation test harness.
 *
 *   npm run agents:test                       # all personas
 *   npm run agents:test -- --persona anna-ginocchio
 *   npm run agents:test -- --verbose          # print every finding
 *
 * For each fake questionnaire (personas.ts) it runs the same pipeline the app
 * runs at the end of onboarding — nutrition targets, plan duration, diet plan,
 * training plan (deterministic planners, i.e. with no AI strategy) — then
 * checks the result (checks.ts) and writes a readable report to
 * scripts/agent-tests/reports/latest.md. Exit code is 1 when any FAIL exists.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateDietPlan } from '@/lib/planning/diet-planner';
import { generateTrainingPlan } from '@/lib/planning/training-planner';
import { computePlanDurationMonths } from '@/lib/planning/plan-duration';

import type { PlanStrategy } from '@/lib/planning/strategy-types';

import { checkStrategy, openAiSession } from './ai';
import { checkFlow, checkGlobal } from './flow';
import { computeTargetsForAnswers, macrosOf, runChecks, type Finding, type PersonaRun } from './checks';
import { PERSONAS, type Persona } from './personas';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export function generateForPersona(persona: Persona, strategy: PlanStrategy | null = null, aiMode = false): PersonaRun {
  const answers = persona.answers;
  const mode = answers.mode as string | undefined;
  const targets = computeTargetsForAnswers(answers);
  const durationMonths = computePlanDurationMonths(answers);

  // Mirrors usePlanStore.generatePlans (strategy = null unless --ai).
  const diet = mode === 'training' ? null : generateDietPlan({ answers, dailyCalorieTarget: targets.dailyCalorieTarget, macroTargetsG: targets.macroTargetsG, strategy: strategy?.diet ?? null });
  const training = mode === 'diet' ? null : generateTrainingPlan({ answers, strategy: strategy?.training ?? null });

  const findings = [...runChecks(persona, targets, durationMonths, diet, training), ...checkFlow(persona, targets, diet, training)];
  if (aiMode) findings.push(...checkStrategy(persona, strategy, targets.dailyCalorieTarget, durationMonths));
  return { persona, targets, durationMonths, diet, training, findings };
}

// ------------------------------------------------------------------ report --

const ICON = { FAIL: '❌', WARN: '⚠️', INFO: 'ℹ️' } as const;

function counts(findings: Finding[]) {
  return {
    fail: findings.filter((f) => f.level === 'FAIL').length,
    warn: findings.filter((f) => f.level === 'WARN').length,
    info: findings.filter((f) => f.level === 'INFO').length,
  };
}

function dietDayTable(run: PersonaRun, dayIndex: number): string {
  const day = run.diet?.months[0].weeklySplit[dayIndex];
  if (!day) return '';
  const rows = day.meals.map((m) => {
    if (m.isFreeMeal) return `| ${m.label} ${m.time} | _pasto libero_ | ${m.totalKcal} |`;
    const items = m.items.map((i) => `${i.name} ${i.quantityLabel}`).join(', ');
    return `| ${m.label} ${m.time} | ${items} | ${m.totalKcal} |`;
  });
  const items = day.meals.flatMap((m) => m.items.map((i) => ({ foodId: i.foodId, grams: i.grams })));
  const mac = macrosOf(items);
  return [
    `| Pasto | Alimenti | kcal |`,
    `|---|---|---|`,
    ...rows,
    '',
    `Totale ${WEEKDAYS[dayIndex]}: **${mac.kcal.toFixed(0)} kcal** · P ${mac.protein.toFixed(0)} g · C ${mac.carbs.toFixed(0)} g · G ${mac.fats.toFixed(0)} g`,
  ].join('\n');
}

function trainingWeekTable(run: PersonaRun, monthIdx: number): string {
  const m = run.training?.months[monthIdx];
  if (!m) return '';
  const rows = m.weeklySplit.map((d) => {
    if (d.type === 'rest') return `| ${d.weekday} | Riposo | |`;
    if (d.type === 'cardio') return `| ${d.weekday} | Corsa | ${d.note} |`;
    const ex = (d.exercises ?? []).map((e) => `${e.name} ${e.sets}×${e.reps}${e.suggestedKg != null ? ` @${e.suggestedKg}kg` : ''}`).join('; ');
    return `| ${d.weekday} | ${d.title} | ${ex} |`;
  });
  return [`**Mese ${m.monthIndex} — ${m.title}**`, '', `| Giorno | Seduta | Dettaglio |`, `|---|---|---|`, ...rows].join('\n');
}

function personaSection(run: PersonaRun): string {
  const { persona: p, targets: t, findings } = run;
  const c = counts(findings);
  const a = p.answers;
  const verdict = c.fail > 0 ? '❌ NON SUPERATO' : c.warn > 0 ? '⚠️ SUPERATO CON AVVISI' : '✅ SUPERATO';
  const out: string[] = [];
  out.push(`## ${p.name}`, '', `**Esito:** ${verdict} (${c.fail} errori, ${c.warn} avvisi, ${c.info} note)`, '');
  out.push(`- **Chi è:** ${p.summary}`, `- **Cosa ci aspettiamo:** ${p.expectation}`, '');
  out.push(
    `| Dati | Valore |`,
    `|---|---|`,
    `| Profilo | ${String(a.sex)} · ${String(a.age)} anni · ${String(a.heightCm)} cm · ${String(a.currentWeightKg)} kg → ${String(a.targetWeightKg)} kg · obiettivo \`${String(a.goal)}\` |`,
    `| Metabolismo basale / fabbisogno | ${t.bmr} / ${t.tdee} kcal |`,
    `| Target calorico | **${t.dailyCalorieTarget} kcal** (${((t.dailyCalorieTarget / t.tdee - 1) * 100).toFixed(0)}% sul fabbisogno) |`,
    `| Macro | P ${t.macroTargetsG.protein} g (${(t.macroTargetsG.protein / Number(a.currentWeightKg)).toFixed(1)} g/kg) · C ${t.macroTargetsG.carbs} g · G ${t.macroTargetsG.fats} g |`,
    `| Idratazione | ${t.hydrationTargetMl} ml |`,
    `| Durata piano | ${run.durationMonths} mesi |`,
    ''
  );
  if (run.diet) {
    const m = run.diet.months;
    out.push(`**Piano alimentare** — mesi: ${m.map((x) => `${x.monthIndex}·${x.calorieTarget} kcal`).join(' → ')}`, '');
    out.push(`Esempio giorno di allenamento (Lun) e pasto libero (Sab):`, '', dietDayTable(run, 0), '', dietDayTable(run, 5), '');
  } else out.push('_Nessun piano alimentare generato._', '');
  if (run.training) {
    out.push(trainingWeekTable(run, 0), '');
    const last = run.training.months.length - 1;
    if (last > 0) out.push(trainingWeekTable(run, last), '');
  } else out.push('_Nessun piano di allenamento generato._', '');
  if (findings.length) {
    out.push('**Controlli**', '');
    for (const f of [...findings].sort((x, y) => ['FAIL', 'WARN', 'INFO'].indexOf(x.level) - ['FAIL', 'WARN', 'INFO'].indexOf(y.level))) {
      out.push(`- ${ICON[f.level]} \`${f.code}\` ${f.message}`);
    }
    out.push('');
  } else out.push('Nessun problema rilevato.', '');
  return out.join('\n');
}

function buildReport(runs: PersonaRun[], globals: Finding[]): string {
  const total = counts(runs.flatMap((r) => r.findings));
  const lines: string[] = [];
  lines.push('# Test dei piani generati dai questionari', '');
  lines.push(`Generato il ${new Date().toISOString().slice(0, 16).replace('T', ' ')} — ${runs.length} questionari finti, piani creati con i generatori reali dell’app.`, '');
  lines.push(`**Totale:** ${total.fail} errori · ${total.warn} avvisi · ${total.info} note`, '');
  lines.push('| Persona | Target kcal | P/C/G (g) | Mesi | Palestra/Corsa a sett. | Errori | Avvisi |', '|---|---|---|---|---|---|---|');
  for (const r of runs) {
    const c = counts(r.findings);
    const w = r.training?.months[0].weeklySplit;
    const gym = w?.filter((d) => d.type === 'workout').length ?? '–';
    const run = w?.filter((d) => d.type === 'cardio').length ?? '–';
    lines.push(
      `| ${r.persona.name.split(' — ')[0]} | ${r.targets.dailyCalorieTarget} | ${r.targets.macroTargetsG.protein}/${r.targets.macroTargetsG.carbs}/${r.targets.macroTargetsG.fats} | ${r.durationMonths} | ${gym}/${run} | ${c.fail} | ${c.warn} |`
    );
  }
  lines.push('');
  if (globals.length) {
    lines.push('## Controlli generali dell’app', '');
    for (const g of globals) lines.push(`- ${ICON[g.level]} \`${g.code}\` ${g.message}`);
    lines.push('', '---', '');
  }
  for (const r of runs) lines.push(personaSection(r), '---', '');
  return lines.join('\n');
}

// -------------------------------------------------------------------- main --

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes('--persona') ? args[args.indexOf('--persona') + 1] : null;
  const verbose = args.includes('--verbose');
  const personas = only ? PERSONAS.filter((p) => p.id === only) : PERSONAS;
  if (personas.length === 0) {
    console.error(`Persona "${only}" non trovata. Disponibili: ${PERSONAS.map((p) => p.id).join(', ')}`);
    process.exit(2);
  }

  const useAi = args.includes('--ai');
  let runs: PersonaRun[];
  if (useAi) {
    const session = await openAiSession();
    if ('error' in session) {
      console.error(`--ai non disponibile: ${session.error}`);
      process.exit(2);
    }
    runs = [];
    for (const persona of personas) {
      const targets = computeTargetsForAnswers(persona.answers);
      process.stdout.write(`Chiedo la strategia all'agente AI per ${persona.id}… `);
      const strategy = await session.call(persona, targets, computePlanDurationMonths(persona.answers));
      console.log(strategy ? 'ok' : 'nessuna strategia');
      runs.push(generateForPersona(persona, strategy, true));
    }
  } else {
    runs = personas.map((p) => generateForPersona(p));
  }
  for (const r of runs) {
    const c = counts(r.findings);
    const mark = c.fail > 0 ? '❌' : c.warn > 0 ? '⚠️ ' : '✅';
    console.log(`${mark} ${r.persona.name}  [${c.fail} errori, ${c.warn} avvisi, ${c.info} note] target ${r.targets.dailyCalorieTarget} kcal, ${r.durationMonths} mesi`);
    for (const f of r.findings) {
      if (f.level === 'INFO' && !verbose) continue;
      if (f.level === 'WARN' && !verbose && c.fail > 0 && false) continue;
      console.log(`     ${ICON[f.level]} ${f.code} ${f.message}`);
    }
  }
  const globals = checkGlobal();
  if (globals.length) {
    console.log('\nControlli generali dell’app');
    for (const g of globals) console.log(`     ${ICON[g.level]} ${g.code} ${g.message}`);
  }
  const total = counts([...runs.flatMap((r) => r.findings), ...globals]);
  console.log(`\nTotale: ${total.fail} errori, ${total.warn} avvisi, ${total.info} note su ${runs.length} questionari`);

  const dir = join(dirname(fileURLToPath(import.meta.url)), 'reports');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, only ? `persona-${only}.md` : 'latest.md');
  writeFileSync(file, buildReport(runs, globals), 'utf8');
  console.log(`Report: ${file}`);
  process.exit(total.fail > 0 ? 1 : 0);
}

void main();
