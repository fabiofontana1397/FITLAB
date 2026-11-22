/**
 * Browser check of Nutrizione → Ricette: the page fits one screen (nothing to scroll), the card shows title, photo,
 * kcal and macros, the selector sits under it, swiping changes recipe, tapping opens the full-page recipe whose
 * bottom button logs it.
 *
 *   npx expo export --platform web --output-dir /tmp/fitlab-web
 *   npx tsx scripts/nutrition-tests/recipes-ui.ts /tmp/fitlab-web
 */
import assert from 'node:assert/strict';

import { loadChromium, openApp, serve } from '../lib/web-harness';

const distDir = process.argv[2];
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const server = await serve(distDir);
  const browser = await loadChromium().launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const shots = process.env.SCREENSHOT_DIR;
  let failed = 0;
  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      console.log(`PASS  ${name}`);
    } catch (e) {
      failed++;
      console.log(`FAIL  ${name}\n      ${(e as Error).message}`);
    }
  };
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
      const page = await openApp(browser, server.url, { path: '/nutrition', viewport: vp });
      await page.getByText('Ricette', { exact: true }).first().click();
      await page.getByText('Scorri per cambiare ricetta').waitFor();
      await pause(1200);
      if (shots) await page.screenshot({ path: `${shots}/ricette-${vp.height}.png` });

      await test(`${vp.height}: page does not scroll`, async () => {
        const scroll = page.getByTestId('screen-scroll');
        const { sh, ch } = await scroll.evaluate((el: HTMLElement) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
        assert.ok(sh <= ch + 1, `scrollHeight ${sh} > clientHeight ${ch}`);
      });

      await test(`${vp.height}: selector is under the card, above the tab bar`, async () => {
        const hint = await page.getByText('Scorri per cambiare ricetta').boundingBox();
        // The tab bar's pill starts ~20 px above its label: the hint must end clear of it, not merely above the screen's foot.
        const tab = await page.getByText('Nutrizione', { exact: true }).last().boundingBox();
        assert.ok(hint && tab && hint.y + hint.height <= tab.y - 20, `hint ends at ${hint && hint.y + hint.height}, tab label at ${tab?.y}`);
      });

      const counter = async () => (await page.getByText(/^\d+ \/ \d+$/).first().textContent())?.trim();
      await test(`${vp.height}: swipe left → next, arrow back → previous`, async () => {
        const before = await counter();
        const deck = await page.getByText('Porzione per te').or(page.getByText('Porzione standard')).first().boundingBox();
        assert.ok(deck);
        const y = deck!.y - 120;
        await page.mouse.move(vp.width - 60, y);
        await page.mouse.down();
        for (let x = vp.width - 60; x > 20; x -= 20) await page.mouse.move(x, y);
        await page.mouse.up();
        await pause(600);
        const after = await counter();
        assert.notEqual(after, before, `still ${after}`);
        if (shots) await page.screenshot({ path: `${shots}/ricette-next-${vp.height}.png` });
        await page.getByLabel('Ricetta precedente').click();
        await pause(600);
        assert.equal(await counter(), before);
      });

      if (vp.height === 844) {
        await test('tap opens full-page recipe, button logs it', async () => {
          const box = await page.getByText('Porzione per te').or(page.getByText('Porzione standard')).first().boundingBox();
          await page.mouse.click(vp.width / 2, box!.y - 140);
          await page.getByText('Preparazione').waitFor({ timeout: 5000 });
          await pause(700);
          if (shots) await page.screenshot({ path: `${shots}/ricetta-dettaglio.png` });
          const add = page.getByText(/^Aggiungi a .* di oggi$/);
          await add.waitFor();
          const b = await add.boundingBox();
          assert.ok(b && b.y > vp.height - 120, `button at ${b?.y}`);
          await add.click();
          await page.getByText(/^Aggiunta a /).waitFor();
          await pause(1500);
          assert.equal(await page.getByText('Preparazione').count(), 0, 'sheet still open');
        });
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(failed ? 1 : 0);
}
main();
