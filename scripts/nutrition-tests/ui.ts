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
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);
    const entries = [
      { id: 'seed-a', date: todayIso, slot: 'pranzo', foodId: 'chicken-breast', grams: 150 },
      { id: 'seed-b', date: todayIso, slot: 'pranzo', foodId: 'eggs', grams: 100 },
      { id: 'seed-c', date: todayIso, slot: 'cena', foodId: 'apple', grams: 120 },
    ];
    const page = await openApp(browser, server.url, {
      path: '/nutrition',
      storage: {
        'fitlab/plans': { state: { dietPlan: PLAN, trainingPlan: null }, version: 0 },
        'fitlab/nutrition': { state: { entries, seededDates: [] }, version: 0 },
      },
    });
    await page.getByText('Inserisci la dieta di oggi nei pasti').waitFor({ timeout: 30000 });
    await pause(800);
    if (shots) await page.screenshot({ path: join(shots, 'nutrition.png') });
    const kcalOfDay = async () => (await page.locator('body').innerText()).match(/(\d[\d.]*)\s*\n\/ [\d.]+ kcal/)?.[1] ?? '?';

    await test('no "Registra pasto" button and no "Vedi calendario" link; the calendar is in the top bar', async () => {
      assert.equal(await page.getByText('Registra pasto').count(), 0);
      assert.equal(await page.getByText('Vedi calendario').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Apri calendario' }).count(), 1);
    });

    await test('the meal cards have no progress bar and no "del totale giornaliero"', async () => {
      assert.equal(await page.getByText('del totale giornaliero').count(), 0);
      assert.match(await page.locator('body').innerText(), /Pranzo[\s\S]*kcal/);
    });

    await test('the diet switch is the Promemoria one: 65×30, pill thumb', async () => {
      const toggle = page.getByRole('switch');
      assert.equal(await toggle.count(), 1);
      assert.equal(await toggle.getAttribute('aria-checked'), 'false');
      const box = await toggle.boundingBox();
      assert.ok(Math.abs(box.width - 65) < 2 && Math.abs(box.height - 30) < 2, `track ${box.width}×${box.height}`);
    });

    await test('swiping a food to the left shows a red "Elimina"; tapping it removes the food', async () => {
      const before = await kcalOfDay();
      const row = page.getByRole('button', { name: /^Uova intere, 100 g/ }).first();
      const box = await row.boundingBox();
      await page.mouse.move(box.x + box.width - 30, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 90, box.y + box.height / 2, { steps: 6 });
      await page.mouse.move(box.x + box.width - 140, box.y + box.height / 2, { steps: 6 });
      await page.mouse.up();
      await pause(500);
      const del = page.getByRole('button', { name: /^Elimina: Uova intere/ }).first();
      assert.ok(await del.isVisible(), 'the red action is there');
      const color = await del.evaluate((el: HTMLElement) => getComputedStyle(el.parentElement as HTMLElement).backgroundColor);
      assert.match(color, /rgb\(2[0-9]{2}, [0-9]{1,2}, [0-9]{1,2}\)/, `red background, got ${color}`);
      if (shots) await page.screenshot({ path: join(shots, 'nutrition-swipe.png') });
      await del.click();
      await pause(600);
      assert.notEqual(await kcalOfDay(), before, 'the day total changed');
      assert.equal(await page.getByRole('button', { name: /Uova intere, 100 g/ }).count(), 0, 'the food is gone');
    });

    await test('a long swipe deletes the food at once', async () => {
      const before = await kcalOfDay();
      const row = page.getByRole('button', { name: /^Mela, 120 g/ }).first();
      await row.evaluate((el: HTMLElement) => el.scrollIntoView({ block: 'center' }));
      await pause(300);
      const box = await row.boundingBox();
      await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 40, box.y + box.height / 2, { steps: 10 });
      await page.mouse.up();
      await pause(700);
      assert.notEqual(await kcalOfDay(), before);
    });

    await test('"Aggiungi alimento" opens a sheet (like Profilo): title, close button, Preferiti / Recenti, categories', async () => {
      await page.getByText('Aggiungi alimento').first().click();
      await page.getByRole('tab', { name: /Preferiti/ }).waitFor();
      await pause(600);
      assert.ok(await page.getByRole('button', { name: 'Chiudi' }).first().isVisible(), 'round close button');
      assert.equal(await page.getByRole('tab', { name: /Preferiti/ }).count(), 1);
      assert.equal(await page.getByRole('tab', { name: /Recenti/ }).count(), 1);
      const chips = await page.getByRole('button', { name: /^(Carboidrati|Proteine|Grassi|Latticini|Frutta|Verdura|Legumi)$/ }).allInnerTexts();
      assert.deepEqual(chips.map((c: string) => c.trim()), ['Carboidrati', 'Proteine', 'Grassi', 'Latticini', 'Frutta', 'Verdura', 'Legumi']);
      assert.equal(await page.getByText('Tutti', { exact: true }).count(), 0);
      assert.equal(await page.getByText('Cereali', { exact: true }).count(), 0);
      if (shots) await page.screenshot({ path: join(shots, 'nutrition-sheet.png') });
    });

    await test('the star puts a food among the Preferiti, and takes it out again', async () => {
      await page.getByRole('tab', { name: /Recenti/ }).click();
      await pause(300);
      assert.match(await page.getByTestId('food-list').innerText(), /Pollo|pollo/);
      await page.getByRole('button', { name: /^Aggiungi .*ai preferiti/ }).first().click();
      await pause(300);
      await page.getByRole('tab', { name: /Preferiti/ }).click();
      await pause(300);
      assert.ok((await page.getByRole('button', { name: /^Togli .*dai preferiti/ }).count()) >= 1, 'it is in Preferiti');
      const stored = await page.evaluate(() => localStorage.getItem('fitlab/favorite-foods'));
      assert.match(stored ?? '', /"ids":\["/);
      if (shots) await page.screenshot({ path: join(shots, 'nutrition-favorites.png') });
      await page.getByRole('button', { name: /^Togli .*dai preferiti/ }).first().click();
      await pause(300);
      assert.match(await page.getByTestId('food-list').innerText(), /Nessun preferito/);
    });

    await test('the foods scroll under the chips with a fade, not a hard cut', async () => {
      await page.getByRole('button', { name: 'Carboidrati', exact: true }).click();
      await pause(400);
      const list = page.getByTestId('food-list');
      const fade = () => page.getByTestId('food-list-fade').evaluate((el: HTMLElement) => Number(getComputedStyle(el).opacity));
      assert.equal(await fade(), 0, 'no fade at the top');
      await list.evaluate((el: HTMLElement) => { el.scrollTop = 120; });
      await pause(300);
      assert.equal(await fade(), 1, 'fade once scrolled');
      if (shots) await page.screenshot({ path: join(shots, 'nutrition-list-fade.png') });
    });

    await test('foods show their photo (the supplied set); a food without one keeps the grey tile', async () => {
      await page.getByRole('button', { name: 'Proteine', exact: true }).click();
      await pause(900);
      const list = page.getByTestId('food-list');
      const imgs = await list.evaluate((el: HTMLElement) =>
        Array.from(el.querySelectorAll('img')).map((i) => ({ src: (i as HTMLImageElement).currentSrc, w: (i as HTMLImageElement).naturalWidth }))
      );
      assert.ok(imgs.length >= 3, `photos in the list: ${imgs.length}`);
      assert.ok(imgs.every((i: { w: number }) => i.w >= 300), 'every photo loaded at full size');
      assert.ok(imgs.every((i: { src: string }) => /food-photos|\.webp/.test(i.src)), 'they are the food-photos files');
      if (shots) await page.screenshot({ path: join(shots, 'nutrition-photos.png') });
      // A protein with no matching picture (a powder) is still a row, with the tile.
      const rows = await list.getByRole('button', { name: /kcal ogni 100 g/ }).count();
      assert.ok(rows > imgs.length, `some of the ${rows} rows have no photo (${imgs.length} do)`);
    });

    await test('closing the sheet goes back to the page', async () => {
      await page.getByRole('button', { name: 'Chiudi' }).first().click();
      await page.getByRole('tab', { name: /Preferiti/ }).waitFor({ state: 'detached' });
    });
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed} failed` : '\nAll passed');
  process.exit(failed ? 1 : 0);
}

main();
