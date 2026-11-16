import { DISHES } from '@/lib/planning/fitlab/dishes';
import { FITLAB_FOODS as FOODS } from '@/lib/planning/fitlab/foods';
import { short } from '@/lib/planning/fitlab/catalog';
const byName = new Map(FOODS.map((f: any) => [f.name, f]));
const f = (n: string) => byName.get(n) as any;
const same = (list: string[], kinds: string[]) => { const subs = new Set(list.map((n) => f(n)?.sub)); return [...new Set([...list, ...FOODS.filter((x: any) => subs.has(x.sub) && kinds.some((k) => x.meals.includes(k))).map((x: any) => x.name)])]; };
const sameCat = (list: string[], kinds: string[]) => { const cat = f(list[0])?.category; if (cat !== 'Verdure' && cat !== 'Frutta') return list; return [...new Set([...list, ...FOODS.filter((x: any) => x.category === cat && kinds.some((k) => x.meals.includes(k))).map((x: any) => x.name)])]; };
let own = 0, wide = 0;
const rows: string[] = [];
for (const d of DISHES as any[]) {
  const ph = (k: string) => d.name.includes(`{${k}}`);
  const opts = (k: string, list: string[] | undefined, w: boolean) => (ph(k) && list && list.length ? [...new Set((w ? (k.startsWith('s') ? sameCat(list, d.kinds) : same(list, d.kinds)) : list).map(short))] : [null]);
  const n = (w: boolean) => opts('base', d.base, w).length * opts('protein', d.protein, w).length * opts('s1', d.sides?.[0], w).length * opts('s2', d.sides?.[1], w).length * opts('fat', d.fat, w).length;
  own += n(false); wide += n(true);
  rows.push(`${d.id} ${n(false)} ${n(true)} | ${d.name}`);
}
console.log('nomi distinti con ingredienti propri:', own, ' | con preferiti:', wide);
console.log(rows.join('\n'));
// visual classes: foods that look the same on the plate
const VIS: Record<string,string> = { 'pasta integrale':'pasta', 'riso integrale':'riso', 'riso basmati':'riso', 'yogurt greco':'yogurt', 'skyr':'yogurt', 'yogurt magro':'yogurt', 'yogurt proteico':'yogurt', 'tacchino':'pollo', 'latte senza lattosio':'latte', 'pane di segale':'pane integrale' };
const v = (s: string|null) => (s ? VIS[s] ?? s : null);
let A=0,B=0; const allA: string[] = [];
for (const d of DISHES as any[]) {
  const ph = (k: string) => d.name.includes(`{${k}}`);
  const o = (k: string, list: string[]|undefined, w: boolean) => (ph(k) && list && list.length ? [...new Set((w ? same(list, d.kinds) : list).map(short).map(v))] : [null]);
  const a = o('base', d.base, false).length * o('protein', d.protein, false).length;
  const b = o('base', d.base, true).length * o('protein', d.protein, true).length;
  A+=a; B+=b;
  for (const x of o('base', d.base, false)) for (const y of o('protein', d.protein, false)) allA.push(`${d.id}|${x}|${y}`);
}
console.log('combinazioni base x proteina (classi visive): proprie', A, ' con preferiti', B);
