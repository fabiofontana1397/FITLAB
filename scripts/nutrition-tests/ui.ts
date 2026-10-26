/**
 * Browser tests for the Nutrizione tab: no "Registra pasto" button, no
 * "Vedi calendario" link, and the "Inserisci la dieta di oggi nei pasti"
 * switch drawn like the ones in Promemoria.
 *
 *   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=test \
 *     npx expo export --platform web --output-dir /tmp/fitlab-web
 *   npm run nutrition:ui -- /tmp/fitlab-web
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { loadChromium, openApp, serve } from '../lib/web-harness';

const distDir = process.argv[2];
if (!distDir || !existsSync(join(distDir, 'index.html'))) {
  console.error('Usage: npm run nutrition:ui -- <web export dir>');
  process.exit(2);
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
  months: [
    {
      monthIndex: 1,
      phase: 'adattamento',
      title: 'Mese 1',
      focusNote: '',
      calorieTarget: 2000,
      macroTargetsG: { protein: 150, carbs: 200, fats: 60 },
      weeklySplit: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day),
    },
  ],
};

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

async function main() {
  const server = await serve(distDir);
  const browser = await loadChromium().launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const shots = process.env.SCREENSHOT_DIR;
  try {
    const page = await openApp(browser, server.url, { path: '/nutrition', storage: { 'fitlab/plans': { state: { dietPlan: PLAN, trainingPlan: null }, version: 0 } } });
    await page.getByText('Inserisci la dieta di oggi nei pasti').waitFor({ timeout: 30000 });
    await pause(800);
    if (shots) await page.screenshot({ path: join(shots, 'nutrition.png') });

    await test('no "Registra pasto" button and no "Vedi calendario" link', async () => {
      assert.equal(await page.getByText('Registra pasto').count(), 0);
      assert.equal(await page.getByText('Vedi calendario').count(), 0);
      // the calendar is still reachable from the top bar
      assert.equal(await page.getByRole('button', { name: 'Apri calendario' }).count(), 1);
    });

    await test('the diet switch is the Promemoria one: pill thumb, bar when on, ring when off', async () => {
      const toggle = page.getByRole('switch');
      assert.equal(await toggle.count(), 1);
      assert.equal(await toggle.getAttribute('aria-checked'), 'false');
      const box = await toggle.boundingBox();
      assert.ok(Math.abs(box.width - 65) < 2 && Math.abs(box.height - 30) < 2, `track ${box.width}×${box.height}`);
    });

    await test('turning it on fills the day from the plan and flips the switch; off empties it again', async () => {
      const toggle = page.getByRole('switch');
      await toggle.click();
      await pause(600);
      assert.equal(await toggle.getAttribute('aria-checked'), 'true');
      assert.match(await page.locator('body').innerText(), /495\s*\n\/ 2\.000 kcal/, 'the two planned meals are in the day');
      if (shots) await page.screenshot({ path: join(shots, 'nutrition-on.png') });
      await toggle.click();
      await pause(600);
      assert.equal(await toggle.getAttribute('aria-checked'), 'false');
      assert.match(await page.locator('body').innerText(), /\n0\s*\n\/ 2\.000 kcal/, 'the day is empty again');
    });
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed} failed` : '\nAll passed');
  process.exit(failed ? 1 : 0);
}

main();
