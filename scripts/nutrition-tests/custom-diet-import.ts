/**
 * Diets as people actually bring them (a dietitian's PDF, a coach's message, an app export) must load.
 * Run: npx tsx scripts/nutrition-tests/custom-diet-import.ts
 */
import { parseCustomDiet } from '../../src/lib/planning/custom-diet';

let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (!cond) failed++;
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ` — ${detail}`}`);
}

// 1. A dietitian's sheet: header lines, uppercase meals, unit before the number, "n. 4", alternatives, totals.
const dietitian = parseCustomDiet(`Dott.ssa Maria Rossi - Biologa Nutrizionista
Piano alimentare personalizzato
Paziente: Mario
COLAZIONE
- Latte parzialmente scremato 200 ml
- Fette biscottate integrali n. 4
- Marmellata 2 cucchiaini
SPUNTINO DI METÀ MATTINA
Frutta fresca di stagione 150 g
PRANZO
Pasta integrale g 80
Petto di pollo gr. 120
Verdure a piacere
Olio extravergine d'oliva 10 g
Totale pasto 520 kcal
MERENDA
Yogurt greco 0% 150 g
CENA
Pane integrale 60 g oppure patate 200 g
Oppure: gallette di riso n. 6
Merluzzo 200g
Insalata mista q.b.`);
check('dietitian sheet loads', dietitian.ok, dietitian.ok ? '' : dietitian.error);
if (dietitian.ok) {
  const day = dietitian.week[0];
  const slots = day.meals.map((m) => m.slotId).join(',');
  check('five meals in their slots', slots === 'colazione,spuntinoMattina,pranzo,spuntinoPomeriggio,cena', slots);
  const pranzo = day.meals.find((m) => m.slotId === 'pranzo')!;
  check('"g 80" read as 80 g', pranzo.items.some((i) => i.name.startsWith('Pasta') && i.grams === 80));
  check('"gr. 120" read as 120 g', pranzo.items.some((i) => i.name.startsWith('Petto') && i.grams === 120));
  check('totals are not foods', !pranzo.items.some((i) => /totale/i.test(i.name)));
  const fette = day.meals[0].items.find((i) => i.name.startsWith('Fette'));
  check('"n. 4" slices use the catalog piece weight', fette?.grams === 36, String(fette?.grams));
  const cena = day.meals.find((m) => m.slotId === 'cena')!;
  check('only the first alternative', cena.items.length === 3 && cena.items[0].name.startsWith('Pane'), cena.items.map((i) => i.name).join(','));
}

// 2. One line per meal, snack names other apps use.
const inline = parseCustomDiet(`Colazione: 50g avena, 200ml latte
Snack 1 mela
Pranzo: 80 g riso, 150 g pollo
Pre allenamento: 1 banana
Cena: 200g salmone, 250g patate`);
check('inline meals load', inline.ok);
if (inline.ok) {
  const slots = inline.week[0].meals.map((m) => m.slotId).join(',');
  check('snack and pre-workout are snacks', slots === 'colazione,spuntinoMattina,pranzo,spuntinoPomeriggio,cena', slots);
}

// 3. Numbered days.
const numbered = parseCustomDiet(`Giorno 1
Colazione
Yogurt 150g
Giorno 2
Colazione
Latte 200ml`);
check('"Giorno 2" opens Tuesday', numbered.ok && numbered.week[1].meals[0].items[0].name === 'Latte');

// 4. A table with the days in columns is refused with a clear reason (the server rewrites it day by day).
const table = parseCustomDiet(`Lunedì Martedì Mercoledì
COLAZIONE Yogurt 150g Latte 200ml Yogurt 150g`);
check('day-column table explained', !table.ok && /tabella/.test(table.error));

// 5. The in-app example still loads unchanged.
const example = parseCustomDiet(`Colazione
Yogurt greco 200g
Fiocchi d'avena 50g
1 banana

Pranzo
Riso basmati 80g
Petto di pollo 150g
Zucchine 200g
1 cucchiaio olio evo

Spuntino
Mandorle 30g

Cena
Salmone 150g
Patate 250g
Insalata a piacere`);
check('in-app example', example.ok && example.week[0].meals.length === 4 && example.week[0].meals[1].items.length === 4);

// 6. Foods with no meal at all still get the guidance.
const noMeal = parseCustomDiet(`Riso 80g\nPollo 150g`);
check('foods without a meal name are explained', !noMeal.ok && /Colazione/.test(noMeal.error));

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall passed');
