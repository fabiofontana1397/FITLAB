/**
 * Browser test for "Imposta il tuo piano" (Piani → Nutrizione): set months, calories and macros, approve, see the
 * summary by month, and find the same target on Home and Nutrizione.
 *
 *   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=test \
 *     npx expo export --platform web --output-dir /tmp/fitlab-web
 *   npx tsx scripts/nutrition-tests/targets-ui.ts /tmp/fitlab-web
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { loadChromium, openApp, serve } from '../lib/web-harness';

const distDir = process.argv[2];
if (!distDir || !existsSync(join(distDir, 'index.html'))) {
  console.error('Usage: npx tsx scripts/nutrition-tests/targets-ui.ts <web export dir>');
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
const day = (weekday: string) => ({ weekday, calorieTarget: 2000, macroTargetsG: { protein: 150, carbs: 200, fats: 60 }, meals: [meal('pranzo', 'Pranzo', '13:00'), meal('cena', 'Cena', '20:00')] });
const PLAN = {
  generatedAt: new Date().toISOString(),
  durationMonths: 3,
  goal: 'loseFat',
  engine: 'fitlab-9',
  source: 'generated',
  calibration: {},
  months: [1, 2, 3].map((monthIndex) => ({
    monthIndex,
    phase: 'adattamento',
    title: `Mese ${monthIndex}`,
    focusNote: '',
    calorieTarget: 2000,
    macroTargetsG: { protein: 150, carbs: 200, fats: 60 },
    weeklySplit: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day),
  })),
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
  const shot = async (page: any, name: string) => (shots ? page.screenshot({ path: join(shots, `${name}.png`) }) : undefined); // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    for (const appearance of ['light', 'dark'] as const) {
      const page = await openApp(browser, server.url, {
        path: '/plans',
        storage: {
          'fitlab/app': { state: { hasOnboarded: true, redoingQuestionnaire: false, appearance }, version: 0 },
          'fitlab/plans': { state: { dietPlan: PLAN, trainingPlan: null }, version: 0 },
        },
      });
      await pause(2500);
      await page.getByText('Nutrizione', { exact: true }).first().click();
      await pause(900);

      await test(`[${appearance}] Cambia offers FitLab (in use), load and build`, async () => {
        assert.ok(await page.getByText('Piano creato da FitLab', { exact: true }).first().isVisible());
        await shot(page, `${appearance}-01-line`);
        await page.getByRole('button', { name: 'Cambia il tipo di piano' }).click();
        await pause(700);
        assert.ok(await page.getByRole('radio', { name: /^Piano creato da FitLab\./, checked: true }).isVisible());
        assert.ok(await page.getByRole('radio', { name: /^Carica il tuo piano\./ }).isVisible());
        assert.ok(await page.getByRole('radio', { name: /^Crea il tuo piano\. Calorie e macro/ }).isVisible());
        await shot(page, `${appearance}-01-menu`);
      });

      await page.getByRole('radio', { name: /^Crea il tuo piano\./ }).click();
      await pause(1500);
      await test(`[${appearance}] the editor opens with three months from today's targets`, async () => {
        assert.ok(await page.getByText('Imposta il tuo piano').first().isVisible());
        assert.equal(await page.getByLabel('Calorie al giorno in kcal').inputValue(), '2000');
        await shot(page, `${appearance}-02-editor`);
      });

      // four months, decreasing calories
      await page.getByRole('button', { name: 'Un mese in più' }).click();
      const kcal = page.getByLabel('Calorie al giorno in kcal');
      await kcal.fill('2200');
      await page.getByLabel('Proteine in %').fill('30');
      await page.getByLabel('Carboidrati in %').fill('45');
      await page.getByLabel('Grassi in %').fill('25');
      await page.getByText('Copia nei mesi successivi').click();
      for (const [i, value] of [[2, '2100'], [3, '2000'], [4, '1900']] as const) {
        await page.getByRole('tab', { name: new RegExp(`^Mese ${i},`) }).click();
        await kcal.fill(value);
      }
      await pause(300);

      await test(`[${appearance}] percents that do not sum to 100 block the approval`, async () => {
        await page.getByLabel('Grassi in %').fill('20');
        await page.getByText('Approva il piano', { exact: true }).click();
        await pause(300);
        assert.ok(await page.getByText(/devono fare 100%/).first().isVisible());
        await shot(page, `${appearance}-03-blocked`);
        await page.getByLabel('Grassi in %').fill('25');
      });

      await test(`[${appearance}] grams mode converts the same targets`, async () => {
        await page.getByText('Grammi', { exact: true }).click();
        await pause(300);
        assert.equal(await page.getByLabel('Proteine in g').inputValue(), '143'); // 1900 kcal × 30% / 4
        await shot(page, `${appearance}-04-grams`);
        await page.getByText('Percentuali', { exact: true }).click();
      });

      await page.getByText('Approva il piano', { exact: true }).click();
      await pause(500);
      await page.getByText('Sostituisci', { exact: true }).click();
      await pause(1800);

      await test(`[${appearance}] Piani shows the summary by month, no menu`, async () => {
        assert.ok(await page.getByText('I tuoi obiettivi', { exact: true }).first().isVisible());
        assert.ok(await page.getByText('Mese per mese').isVisible());
        assert.match(await page.evaluate(() => document.body.innerText), /2[.\u202f ]?200/);
        assert.equal(await page.getByText('Pranzo', { exact: true }).count(), 0);
        assert.ok(await page.getByText('Calorie e macro scelti da te').isVisible());
        await shot(page, `${appearance}-05-summary`);
        await page.mouse.wheel(0, 700);
        await pause(700);
        await shot(page, `${appearance}-06-summary-scrolled`);
      });

      await test(`[${appearance}] Home uses the month's target`, async () => {
        await page.getByRole('tab', { name: /Home/ }).first().click().catch(async () => page.getByText('Home', { exact: true }).first().click());
        await pause(1500);
        const text = await page.evaluate(() => document.body.innerText);
        assert.match(text, /2[.  ]?200/);
        await shot(page, `${appearance}-07-home`);
      });

      await test(`[${appearance}] Nutrizione uses the target and the generic meals`, async () => {
        await page.getByRole('tab', { name: /Nutrizione/ }).first().click().catch(async () => page.getByText('Nutrizione', { exact: true }).last().click());
        await pause(1500);
        const text = await page.evaluate(() => document.body.innerText);
        assert.match(text, /2[.  ]?200 kcal/);
        assert.match(text, /Colazione/);
        await shot(page, `${appearance}-08-nutrition`);
      });

      await test(`[${appearance}] FitLab brings the app's plan back`, async () => {
        await page.getByRole('tab', { name: /Piani/ }).first().click().catch(async () => page.getByText('Piani', { exact: true }).last().click());
        await pause(1200);
        await page.getByRole('button', { name: 'Cambia il tipo di piano' }).click();
        await pause(700);
        await page.getByRole('radio', { name: /^Piano creato da FitLab\./ }).click();
        await pause(900);
        assert.ok(await page.getByText('Riprendere il piano FitLab?').isVisible());
        await shot(page, `${appearance}-09-restore`);
        await page.getByText('Annulla', { exact: true }).last().click();
      });
      await page.context().close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
}

void main();
