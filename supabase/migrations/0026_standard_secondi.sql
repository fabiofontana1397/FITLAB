-- Three secondi added to the Fit Lab catalog for the standard meals (primo + secondo + contorno):
-- veal, lean minced beef and beef hamburger. meal_entries.food_id references food_items, so they
-- must exist here before a plan that uses them can be logged.
insert into public.food_items (id, name, category, kcal100, protein100, carbs100, fats100, default_portion_g, source)
values
  ('fl0192', 'Vitello magro (a crudo)', 'proteine', 107, 21, 0, 2.5, 120, 'fitlab'),
  ('fl0193', 'Macinato di manzo magro (a crudo)', 'proteine', 143, 20, 0, 7, 120, 'fitlab'),
  ('fl0194', 'Hamburger di manzo magro', 'proteine', 152, 19, 1, 8, 120, 'fitlab')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  kcal100 = excluded.kcal100,
  protein100 = excluded.protein100,
  carbs100 = excluded.carbs100,
  fats100 = excluded.fats100,
  default_portion_g = excluded.default_portion_g;
