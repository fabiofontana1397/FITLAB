/**
 * Browser test for "Fai da te" in Piani → Allenamento: pick the days, add exercises from the catalog and typed,
 * save, and find the program in Piani with the three sources.
 *
 *   npx tsx scripts/training-tests/own-workout-ui.ts /tmp/fitlab-web
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { loadChromium, openApp, serve } from '../lib/web-harness';

const distDir = process.argv[2];
if (!distDir || !existsSync(join(distDir, 'index.html'))) {
  console.error('Usage: npx tsx scripts/training-tests/own-workout-ui.ts <web export dir>');
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
          'fitlab/plans': { state: { dietPlan: null, trainingPlan: null }, version: 0 },
        },
      });
      await pause(2500);

      await test(`[${appearance}] Allenamento shows the three sources`, async () => {
        for (const n of [/^FitLab,/, /^Caricata,/, /^Fai da te, Scegli gli esercizi/]) assert.ok(await page.getByRole('radio', { name: n }).isVisible());
        await shot(page, `${appearance}-t01-sources`);
      });

      await page.getByRole('radio', { name: /^Fai da te,/ }).click();
      await pause(1500);
      await test(`[${appearance}] the builder opens with three days`, async () => {
        assert.ok(await page.getByText('Crea il tuo programma').first().isVisible());
        assert.equal(await page.getByRole('checkbox', { checked: true }).count(), 3);
        await shot(page, `${appearance}-t02-builder`);
      });

      await test(`[${appearance}] saving without exercises is blocked`, async () => {
        await page.getByText('Salva il programma', { exact: true }).click();
        await pause(300);
        assert.ok(await page.getByText(/aggiungi almeno un esercizio/).first().isVisible());
      });

      // Wednesday off, Friday kept: each day needs one exercise
      await page.getByRole('checkbox', { name: 'Mercoledì' }).click();
      for (const [day, search] of [['Lunedì', 'panca'], ['Venerdì', 'squat']] as const) {
        await page.getByRole('tab', { name: new RegExp(`^${day},`) }).click();
        await page.getByText('Aggiungi esercizio', { exact: true }).click();
        await pause(300);
        await page.getByLabel('Cerca un esercizio').fill(search);
        await pause(300);
        await page.getByRole('button', { name: /^Aggiungi / }).first().click();
        await pause(200);
      }
      await page.getByRole('tab', { name: /^Lunedì,/ }).click();
      await page.getByText('Aggiungi esercizio', { exact: true }).click();
      await pause(300);
      await page.getByLabel('Cerca un esercizio').fill('hip thrust al multipower');
      await pause(200);
      await page.getByText('Aggiungi “hip thrust al multipower”').click();
      await page.getByLabel('Ripetizioni').last().fill('10-12');
      await pause(300);
      await shot(page, `${appearance}-t03-day`);

      await test(`[${appearance}] Monday has two exercises`, async () => {
        assert.ok(await page.getByRole('tab', { name: /^Lunedì, 2 esercizi/ }).isVisible());
      });

      await page.getByText('Salva il programma', { exact: true }).click();
      await pause(2000);

      await test(`[${appearance}] Piani shows the program built by the person`, async () => {
        assert.ok(await page.getByRole('radio', { name: /^Fai da te, .*in uso$/ }).isVisible());
        assert.ok(await page.getByText('Il tuo programma').first().isVisible());
        assert.ok(await page.getByText('In uso · modifica').first().isVisible());
        assert.ok(await page.getByText('Modifica programma').first().isVisible());
        await shot(page, `${appearance}-t04-plans`);
      });

      await test(`[${appearance}] editing reads the program back`, async () => {
        await page.getByText('Modifica programma').first().click();
        await pause(1500);
        assert.ok(await page.getByText('Salva le modifiche', { exact: true }).isVisible());
        assert.equal(await page.getByRole('checkbox', { checked: true }).count(), 2);
        assert.ok(await page.getByText(/Hip thrust al multipower/).first().isVisible());
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
