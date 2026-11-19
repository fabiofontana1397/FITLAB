/**
 * Workout cards as trainers hand them out must load: numbered days with pyramids ("2x20 10 8 8 12"), drop sets,
 * "per gamba", tempo "303", "Addome" without series, and a printed table per day read as text.
 * Run: npx tsx scripts/training-tests/custom-workout-import.ts
 */
import { parseCustomWorkout } from '../../src/lib/planning/custom-workout';

let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (!cond) failed++;
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ` — ${detail}`}`);
}

const A = `GIORNO 1 — GAMBE
• Riscaldamento: 5'
• Squat: 2×20, 10, 8, 8, 12
• Leg extension singola e doppia: 4×10 + 10 + max
• Squat bulgaro: 4×10 per gamba
• Affondi in camminata: 4×15 per gamba
• Squat con manubri, gambe strette, mezzo movimento: 4×15
• Addome
GIORNO 2 — SPALLE
• Lento avanti al multipower: 2×20, 10, 8, 8, 12
• Alzate frontali a martello alternate: 4×8 per braccio
• Shoulder press: 4×10
• Alzate laterali al cavo: 4×12 per braccio
• Cavi incrociati: 4×12 — recupero 45″
• Deltoidi posteriori a 45°: 4×15 — recupero 45″
• Addome
GIORNO 3 — SCHIENA E FEMORALI
• Lat machine inversa: 2×20, 10, 8, 8, 12
• Lat machine avanti: 4×8
• Rematore con manubrio: 4×10 per braccio
• Lat machine con T-bar largo: 4×12
• Pull down: 4×12
• Stacchi con manubri: 4×10 (tempo 303)
• Leg curl: 10, 8, 8, 15 — recupero 45″
• Addome
GIORNO 4 — PETTO, TRICIPITI E BICIPITI
• Panca piana: 2×20, 10, 8, 8, 12, 15
• Spinte a 15°: 4×8
• Croci a 30°: 4×10
• French press: 10, 8, 8, 12, 15
• Cavi incrociati per tricipiti: 4×12
• Curl con manubri alternati: 10, 8, 8, 12, 15
• Curl con fune: 4×12 — recupero 45″
• Addome`;
const B = `Nome: Fabio
Cognome: Pontani
Data: 26.10.26
ESERCIZIO SERIE E RIP REC KG
Riscaldamento 5'
Squat 2x20 10 8 8 12 1
Leg ext singola e doppia 4x10+10+max 1
Squat bulgaro 4x10 x gamba 1
Affondi in camminata 4x15 x gamba 1
Squat con man gambe strette mezzo mov. 4x15 1
addome
ESERCIZIO SERIE E RIP REC KG
Lento avanti al MP 2x20 10 8 8 12 1
Alzate frontali a martello alternate 4x8 x braccio 1
Shoulder press 4x10 1
Alzate laterali al cavo 4x12 x braccio 1
Cavi incrociati 4x12 45se
Delt.post.a 45' 4x15 45se
Addome
ESERCIZIO SERIE E RIP REC KG
Lat machine inversa 2x20 10 8 8 12 1
Lat machine avanti 4x8 1
Rematore con manubrio 4x10 x braccio 1
Lat machine con tbar largo 4x12 1
Pull down 4x12 1
Stacchi con manubri 4x10 303 1
Leg curl 10 8 8 15 45se
addome
ESERCIZIO SERIE E RIP REC KG
Panca piana 2x20 10 8 8 12 15 1
Spinte a 15' 4x8 1
Croci a 30' 4x10 1
French press 10 8 8 12 15 1
Cavi incrociati x tricipiti 4x12 1
Curl con man alternati 10 8 8 12 15 1
Curl con fune 4x12 45se
addome
WORK. SWEAT. REPEAT.`;

for (const [label, text] of [['numbered days', A], ['table per day', B]] as const) {
  const r = parseCustomWorkout(text);
  check(`${label}: loads`, r.ok, r.ok ? '' : r.error);
  if (!r.ok) continue;
  const days = r.week.filter((d) => d.type === 'workout');
  check(`${label}: four sessions`, days.length === 4, String(days.length));
  check(`${label}: eight exercises on day 3`, days[2]?.exercises?.length === 8, String(days[2]?.exercises?.length));
  const all = days.flatMap((d) => d.exercises ?? []);
  const by = (n: string) => all.find((e) => e.name.toLowerCase().startsWith(n));
  check(`${label}: squat pyramid`, by('squat')?.sets === 6 && by('squat')?.reps === '20/20/10/8/8/12', `${by('squat')?.sets}×${by('squat')?.reps}`);
  check(`${label}: drop set kept`, by('leg extension')?.reps === '10+10+max', by('leg extension')?.reps);
  check(`${label}: per side`, by('squat bulgaro')?.name.endsWith('(per gamba)') === true, by('squat bulgaro')?.name);
  check(`${label}: tempo 303`, by('stacchi')?.tempo === '3-0-3', by('stacchi')?.tempo);
  check(`${label}: reps only list`, by('leg curl')?.sets === 4 && by('leg curl')?.reps === '10/8/8/15', `${by('leg curl')?.sets}×${by('leg curl')?.reps}`);
  check(`${label}: rest 45 s`, by('curl con fune')?.restSec === 45, String(by('curl con fune')?.restSec));
  check(`${label}: Addome stays an exercise`, days.every((d) => d.exercises?.some((e) => e.name === 'Addome')));
  check(`${label}: lat machine is lat machine`, by('lat machine avanti')?.id.startsWith('lat-machine') === true, by('lat machine avanti')?.id);
}
const table = parseCustomWorkout(B);
if (table.ok) {
  const squat = table.week.find((d) => d.type === 'workout')?.exercises?.find((e) => e.name === 'Squat');
  check('table: REC column "1" is one minute', squat?.restSec === 60, String(squat?.restSec));
  check('table: name, date and slogan are not exercises', !JSON.stringify(table.week).match(/Fabio|SWEAT|Data/i));
}

// The format the app suggests still works.
const classic = parseCustomWorkout(`Lunedì - Petto e tricipiti
Panca piana 4x8 rec 90s
Croci ai cavi 3x12
Martedì - Riposo
Mercoledì - Schiena
Trazioni alla sbarra 4x8
Rematore con bilanciere 4x10 rec 2 min`);
check('weekday format', classic.ok && classic.week[0].exercises?.length === 2 && classic.week[2].exercises?.[1].restSec === 120);
const generic = parseCustomWorkout(`Giorno A - Gambe
Squat 4x6 recupero 2 min
Leg press 3x10-12
Giorno B - Schiena
Trazioni 4x8`);
check('lettered days', generic.ok && generic.week.filter((d) => d.type === 'workout').length === 2);
const untitled = parseCustomWorkout(`Gambe
Squat 4x6
Leg press 3x10
Petto
Panca piana 4x8`);
check('untitled sessions', untitled.ok && untitled.week.filter((d) => d.type === 'workout').length === 2);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nall passed');
