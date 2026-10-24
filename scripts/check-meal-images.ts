/**
 * Checks the dish photo library: every catalog entry points at a file that
 * exists under public/ and really is a WebP, ids are unique and match the
 * file name, and every mapped dish id exists in the Fit Lab dishes. Exits 1
 * on the first run with problems, so CI catches a broken catalog.
 *
 *   npm run meals:check
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { DISHES } from '@/lib/planning/fitlab/dishes';
import { DISH_IMAGE_IDS, MEAL_IMAGES } from '@/lib/planning/fitlab/dish-images';

const PUBLIC_DIR = join(__dirname, '..', 'public');
const LIBRARY_DIR = join(PUBLIC_DIR, 'images', 'meals');
const KINDS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);

const problems: string[] = [];
const seen = new Set<string>();

for (const meal of MEAL_IMAGES) {
  if (seen.has(meal.id)) problems.push(`duplicate id: ${meal.id}`);
  seen.add(meal.id);
  if (!meal.name || !meal.alt) problems.push(`${meal.id}: name and alt are required`);
  if (!KINDS.has(meal.category)) problems.push(`${meal.id}: unknown category "${meal.category}"`);
  if (meal.image !== `/images/meals/${meal.id}.webp`) problems.push(`${meal.id}: image should be /images/meals/${meal.id}.webp, is ${meal.image}`);

  const file = join(PUBLIC_DIR, meal.image);
  if (!existsSync(file)) {
    problems.push(`${meal.id}: missing file ${meal.image}`);
    continue;
  }
  const head = readFileSync(file).subarray(0, 12);
  if (head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WEBP') problems.push(`${meal.id}: ${meal.image} is not a WebP file`);
}

for (const file of readdirSync(LIBRARY_DIR)) {
  if (!seen.has(file.replace(/\.webp$/, ''))) problems.push(`orphan file not in the catalog: images/meals/${file}`);
}

const dishIds = new Set(DISHES.map((d) => d.id));
for (const [dishId, imageId] of Object.entries(DISH_IMAGE_IDS)) {
  if (!dishIds.has(dishId)) problems.push(`mapping: unknown dish id ${dishId}`);
  if (!seen.has(imageId)) problems.push(`mapping: ${dishId} → unknown image ${imageId}`);
}

if (problems.length) {
  console.error(`Meal image library: ${problems.length} problem(s)\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
const mapped = new Set(Object.values(DISH_IMAGE_IDS));
console.log(
  `Meal image library OK: ${MEAL_IMAGES.length} images, ${Object.keys(DISH_IMAGE_IDS).length} dishes mapped, ` +
    `${MEAL_IMAGES.filter((m) => !mapped.has(m.id)).length} image(s) not yet used by a dish.`
);
