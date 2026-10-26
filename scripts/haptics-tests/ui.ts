/**
 * Browser tests for the haptic feedback wiring. Nothing vibrates on the web, so
 * lib/haptics.ts also appends the name of each effect it fires to
 * `globalThis.__FITLAB_HAPTIC_LOG__` when a test has created that array; these
 * tests read it back after real interactions.
 *
 *   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=test \
 *     npx expo export --platform web --output-dir /tmp/fitlab-web
 *   npm run haptics:ui -- /tmp/fitlab-web
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { loadChromium, openApp, serve, type Page } from '../lib/web-harness';

const distDir = process.argv[2];
if (!distDir || !existsSync(join(distDir, 'index.html'))) {
  console.error('Usage: npm run haptics:ui -- <web export dir>');
  process.exit(2);
}

let failed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}\n      ${(e as Error).message.split('\n').join('\n      ')}`);
  }
}
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const read = (page: Page): Promise<string[]> => page.evaluate(() => (globalThis as unknown as { __FITLAB_HAPTIC_LOG__: string[] }).__FITLAB_HAPTIC_LOG__.slice());
const clear = (page: Page) => page.evaluate(() => ((globalThis as unknown as { __FITLAB_HAPTIC_LOG__: string[] }).__FITLAB_HAPTIC_LOG__.length = 0));
/** What `action` fires, in order (the log is emptied first and read after the effects have settled). */
async function during(page: Page, action: () => Promise<void>): Promise<string[]> {
  await clear(page);
  await action();
  await pause(500);
  return read(page);
}

const meal = (slotId: string, label: string, time: string) => ({
  slotId,
  label,
  time,
  totalKcal: 450,
  recipe: { name: 'Piatto', flavorings: [] },
  items: [{ name: 'Petto di pollo', grams: 150, kcal: 250, foodId: 'chicken-breast', quantityLabel: '150g' }],
});
const day = (weekday: string) => ({ weekday, calorieTarget: 2000, meals: [meal('pranzo', 'Pranzo', '13:00'), meal('cena', 'Cena', '20:00')] });
const PLAN = {
  generatedAt: new Date().toISOString(),
  durationMonths: 3,
  goal: 'loseFat',
  engine: 'fitlab-3',
  calibration: {},
  months: [{ monthIndex: 1, phase: 'adattamento', title: 'Mese 1', focusNote: '', calorieTarget: 2000, macroTargetsG: { protein: 150, carbs: 200, fats: 60 }, weeklySplit: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day) }],
};

async function main() {
  const server = await serve(distDir);
  const browser = await loadChromium().launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const iso = today.toISOString().slice(0, 10);
    const entries = [
      { id: 'seed-a', date: iso, slot: 'pranzo', foodId: 'chicken-breast', grams: 150 },
      { id: 'seed-b', date: iso, slot: 'pranzo', foodId: 'eggs', grams: 100 },
      { id: 'seed-c', date: iso, slot: 'pranzo', foodId: 'rice-basmati', grams: 80 },
    ];
    const page = await openApp(browser, server.url, {
      path: '/nutrition',
      initScript: '(globalThis).__FITLAB_HAPTIC_LOG__ = [];',
      storage: { 'fitlab/plans': { state: { dietPlan: PLAN, trainingPlan: null }, version: 0 }, 'fitlab/nutrition': { state: { entries, seededDates: [] }, version: 0 } },
    });
    await page.getByText('Inserisci la dieta di oggi nei pasti').waitFor({ timeout: 30000 });
    await pause(800);

    await test('the switch fires a toggle effect, on and off, once each', async () => {
      const on = await during(page, () => page.getByRole('switch').click());
      assert.deepEqual(on, ['toggle-on']);
      const off = await during(page, () => page.getByRole('switch').click());
      assert.deepEqual(off, ['toggle-off']);
    });

    await test('swiping a food: a tick at the "stays open" mark, a rigid pop at the "delete" mark, a heavy thump on delete', async () => {
      const row = page.getByRole('button', { name: /^Uova intere, 100 g/ }).first();
      await row.evaluate((el: HTMLElement) => el.scrollIntoView({ block: 'center' }));
      await pause(300);
      const box = await row.boundingBox();
      const events = await during(page, async () => {
        await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width - 90, box.y + box.height / 2, { steps: 6 }); // past the open mark
        await page.mouse.move(box.x + 40, box.y + box.height / 2, { steps: 10 }); // past the delete mark
        await page.mouse.up();
      });
      assert.deepEqual(events, ['selection', 'rigid', 'heavy']);
    });

    await test('tapping the red "Elimina" thumps', async () => {
      const row = page.getByRole('button', { name: /^Petto di pollo, 150 g/ }).first();
      const box = await row.boundingBox();
      await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 140, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();
      await pause(500);
      const events = await during(page, () => page.getByRole('button', { name: /^Elimina: / }).first().click());
      assert.deepEqual(events, ['heavy']);
    });

    await test('opening and closing the add-food sheet: a tap on the button, a soft thud as it rises and as it goes', async () => {
      const opened = await during(page, () => page.getByText('Aggiungi alimento').first().click());
      assert.deepEqual(opened, ['tap', 'soft']);
      await page.getByRole('tab', { name: /Preferiti/ }).waitFor();
      const closed = await during(page, () => page.getByRole('button', { name: 'Chiudi' }).first().click());
      assert.ok(closed.includes('soft'), `got ${closed.join(',')}`);
    });

    await test('the star toggles with a pop, the Preferiti / Recenti selector ticks', async () => {
      await page.getByText('Aggiungi alimento').first().click();
      await page.getByRole('tab', { name: /Preferiti/ }).waitFor();
      await pause(600);
      const tab = await during(page, () => page.getByRole('tab', { name: /Recenti/ }).click());
      assert.deepEqual(tab, ['selection']);
      const star = await during(page, () => page.getByRole('button', { name: /^Aggiungi .*ai preferiti/ }).first().click());
      assert.deepEqual(star, ['toggle-on']);
      const unstar = await during(page, () => page.getByRole('button', { name: /^Togli .*dai preferiti/ }).first().click());
      assert.deepEqual(unstar, ['toggle-off']);
    });

    // Login: a wrong answer from the server is an error buzz.
    const auth = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await auth.addInitScript('globalThis.__FITLAB_HAPTIC_LOG__ = [];');
    await auth.route('http://127.0.0.1:54321/**', (route: { fulfill: (r: object) => void }) =>
      route.fulfill({ status: 400, json: { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' } })
    );
    const login = await auth.newPage();
    await login.goto(server.url + '/login');
    await test('a failed login is an error buzz', async () => {
      await login.getByPlaceholder('tu@esempio.com').fill('a@b.it');
      await login.getByPlaceholder('••••••••').fill('wrongpass1');
      const events = await during(login, () => login.getByText('Accedi', { exact: true }).last().click());
      assert.ok(events.includes('error'), `got ${events.join(',') || 'nothing'}`);
    });
    await auth.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed} failed` : '\nAll passed');
  process.exit(failed ? 1 : 0);
}

main();
