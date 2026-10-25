/**
 * Tests for the "Come leggere il grafico" carousel's model and for the Home
 * formulas it reuses.
 *
 *   npm run energy-guide:test
 *
 * The charts are thin views over buildDemoDay(values): every number they
 * draw comes from it, so these checks cover what each page shows. The UI
 * behaviour (animations, swiping, Reduce Motion) is covered by ./ui.ts.
 * Exit code is 1 when any check fails.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { explain } from '@/lib/energy-guide/explain';
import { BALANCE_SCALE, balanceCaption, balancePosition, balanceSide, calorieBalance, readBalance } from '@/domain/calorie-balance';
import { applyDemoPreset, buildDemoDay, clampDemoValues, DEMO_CONFIG, stepValue, type DemoValues } from '@/lib/energy-guide/demo-example';

const here = dirname(fileURLToPath(import.meta.url));
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}\n      ${(e as Error).message.split('\n').join('\n      ')}`);
  }
}

const initial: DemoValues = DEMO_CONFIG.initial;
const at = (eatenKcal: number, extraActivityKcal = initial.extraActivityKcal) => buildDemoDay({ eatenKcal, extraActivityKcal });
const burned = buildDemoDay(initial).burnedKcal;

test('1. intake below expenditure reads as a deficit on every chart', () => {
  const day = at(burned - 400);
  assert.equal(day.balanceKcal, -400);
  assert.equal(day.reading.status, 'deficit');
  assert.equal(balanceSide(day.balanceKcal, day.toleranceKcal), 'deficit');
  // Deficit sits right of equilibrium, as on Home's semi-ring.
  assert.ok(balancePosition(day.balanceKcal, day.reading.halfRangeKcal).position > 0);
  assert.match(explain(day)[0].text, /a destra del centro/);
});

test('2. intake equal to expenditure reads as equilibrium', () => {
  const day = at(burned);
  assert.equal(day.balanceKcal, 0);
  assert.equal(day.reading.status, 'even');
  assert.equal(day.caption, 'in pari');
  assert.equal(Math.abs(balancePosition(day.balanceKcal, day.reading.halfRangeKcal).position), 0, 'marker at the centre');
  // Within the tolerance on either side it still reads even.
  assert.equal(at(burned + DEMO_CONFIG.toleranceKcal).reading.status, 'even');
  assert.equal(at(burned - DEMO_CONFIG.toleranceKcal).reading.status, 'even');
  assert.equal(at(burned + DEMO_CONFIG.toleranceKcal + 1).reading.status, 'surplus');
});

test('3. intake above expenditure reads as a surplus', () => {
  const day = at(burned + 350);
  assert.equal(day.balanceKcal, 350);
  assert.equal(day.reading.status, 'surplus');
  assert.equal(day.caption, 'in surplus');
  assert.ok(balancePosition(day.balanceKcal, day.reading.halfRangeKcal).position < 0);
  // A surplus against the example's deficit goal is away from the goal.
  assert.equal(day.reading.towardGoal, false);
  assert.match(explain(day)[1].text, /ti allontani/);
});

test('3b. the presets land in their zones and keep the movement', () => {
  for (const [preset, zone] of [['deficit', 'deficit'], ['even', 'even'], ['surplus', 'surplus']] as const) {
    const v = applyDemoPreset(initial, preset);
    assert.equal(v.extraActivityKcal, initial.extraActivityKcal);
    assert.equal(buildDemoDay(v).reading.status, zone, preset);
    assert.equal(buildDemoDay(v).balanceKcal, DEMO_CONFIG.presets[preset]);
  }
});

test('4. changing a value updates every derived number at once', () => {
  const before = buildDemoDay(initial);
  const moreFood = buildDemoDay({ ...initial, eatenKcal: initial.eatenKcal + 300 });
  assert.equal(moreFood.burnedKcal, before.burnedKcal, 'intake does not change the expenditure');
  assert.equal(moreFood.balanceKcal, before.balanceKcal + 300);
  assert.notEqual(moreFood.caption, undefined);
  assert.ok(
    balancePosition(moreFood.balanceKcal, moreFood.reading.halfRangeKcal).position < balancePosition(before.balanceKcal, before.reading.halfRangeKcal).position,
    'more intake moves the marker toward surplus'
  );

  const moreMovement = buildDemoDay({ ...initial, extraActivityKcal: initial.extraActivityKcal + 200 });
  assert.equal(moreMovement.basalKcal, before.basalKcal, 'movement does not change the basal part');
  assert.equal(moreMovement.movementKcal, before.movementKcal + 200);
  assert.equal(moreMovement.burnedKcal, before.burnedKcal + 200);
  assert.equal(moreMovement.balanceKcal, before.balanceKcal - 200);
  assert.equal(moreMovement.trainingKcal, before.trainingKcal + 200);
});

test('4b. no double counting: basal + movement is exactly the total, training inside movement', () => {
  for (const extra of [0, 150, 600, 1200]) {
    const day = buildDemoDay({ eatenKcal: 2000, extraActivityKcal: extra });
    assert.equal(day.basalKcal + day.movementKcal, day.burnedKcal);
    assert.equal(day.energy.resting + day.energy.everyday + day.energy.exercise, day.energy.total);
    assert.ok(day.trainingKcal <= day.movementKcal);
    assert.equal(day.balanceKcal, calorieBalance(day.eatenKcal, day.burnedKcal));
  }
});

test('4c. values are clamped and steppers snap to their grid', () => {
  assert.deepEqual(clampDemoValues({ eatenKcal: 99999, extraActivityKcal: -5 }), { eatenKcal: DEMO_CONFIG.eaten.max, extraActivityKcal: 0 });
  assert.equal(stepValue(2281, 1, DEMO_CONFIG.eaten), 2300);
  assert.equal(stepValue(2281, -1, DEMO_CONFIG.eaten), 2200);
  assert.equal(stepValue(2300, 1, DEMO_CONFIG.eaten), 2400);
  assert.equal(stepValue(DEMO_CONFIG.eaten.min, -1, DEMO_CONFIG.eaten), DEMO_CONFIG.eaten.min);
  // The example never reaches Home's "no meal logged" state.
  assert.notEqual(buildDemoDay({ eatenKcal: 0, extraActivityKcal: 0 }).reading.status, 'missing');
});

test('4d. the equilibrium tolerance is configurable', () => {
  const v = { eatenKcal: burned + 120, extraActivityKcal: initial.extraActivityKcal };
  assert.equal(buildDemoDay(v).reading.status, 'surplus');
  assert.equal(buildDemoDay(v, 150).reading.status, 'even');
  assert.equal(buildDemoDay(v, 150).toleranceKcal, 150);
  assert.equal(DEMO_CONFIG.toleranceKcal, BALANCE_SCALE.toleranceKcal, 'by default the example reads like Home');
});

test('5. every page reads one model: the same values give the same numbers in any order', () => {
  const sequence: DemoValues[] = [initial, applyDemoPreset(initial, 'surplus'), { eatenKcal: 1800, extraActivityKcal: 0 }, initial];
  const first = buildDemoDay(sequence[0]);
  const last = buildDemoDay(sequence[sequence.length - 1]);
  assert.deepEqual(last, first, 'going back to a value restores exactly the same day');
  // Page 1 (difference), page 3 (balance) and page 4 (gauge) agree.
  const day = buildDemoDay(sequence[1]);
  assert.equal(day.reading.balanceKcal, day.balanceKcal);
  assert.equal(calorieBalance(day.eatenKcal, day.burnedKcal), day.balanceKcal);
});

test('6. the example starts from the same state on every opening', () => {
  const snapshot = JSON.stringify(DEMO_CONFIG);
  applyDemoPreset(initial, 'surplus');
  clampDemoValues({ eatenKcal: 1, extraActivityKcal: 1 });
  buildDemoDay({ eatenKcal: 3000, extraActivityKcal: 500 });
  assert.equal(JSON.stringify(DEMO_CONFIG), snapshot, 'the config is never mutated');
  assert.deepEqual(buildDemoDay(DEMO_CONFIG.initial), buildDemoDay({ ...DEMO_CONFIG.initial }));
});

test('8. Home formulas unchanged: readBalance, balancePosition and the caption match the original code', () => {
  const golden = JSON.parse(readFileSync(join(here, 'home-balance-golden.json'), 'utf8')) as {
    in: [number, number, number];
    reading: unknown;
    position: unknown;
    caption: string;
  }[];
  assert.ok(golden.length > 200);
  for (const g of golden) {
    const [eatenKcal, burnedKcal, goalKcal] = g.in;
    const r = readBalance({ eatenKcal, burnedKcal, goalKcal });
    // Through JSON like the golden file itself (which cannot tell -0 from 0).
    const json = (x: unknown) => JSON.parse(JSON.stringify(x));
    assert.deepEqual(json(r), g.reading, `readBalance(${g.in})`);
    assert.deepEqual(json(balancePosition(r.balanceKcal, r.halfRangeKcal)), g.position, `balancePosition(${g.in})`);
    assert.equal(balanceCaption(r), g.caption, `caption(${g.in})`);
  }
});

test('8b. the carousel never touches the user\'s data or Home\'s gauge', () => {
  const root = join(here, '..', '..');
  const files = [
    ...readdirSync(join(root, 'src/components/energy-guide')).map((f) => join(root, 'src/components/energy-guide', f)),
    ...readdirSync(join(root, 'src/lib/energy-guide')).map((f) => join(root, 'src/lib/energy-guide', f)),
    join(root, 'src/app/energy-guide.tsx'),
  ];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /@\/store\//, `${file} imports a store`);
    assert.doesNotMatch(source, /use(User|Health|Weekly)\w*\(/, `${file} reads the user's data`);
  }
});

console.log(failed ? `\n${failed} failed` : '\nAll passed');
process.exit(failed ? 1 : 0);
