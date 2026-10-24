import { createElement } from 'react';

import { useTheme } from '@/hooks/use-theme';
import { foodGlyph, foodMacro, type FoodMacro } from '@/lib/nutrition/food-icons';

/**
 * A food's lucide glyph, tinted by the macro that dominates it
 * (lib/nutrition/food-icons.ts). Decorative — the food's name always sits
 * next to it — so the caller hides its container from screen readers. Not
 * done here: on the web an SVG passes unknown props straight through to the
 * DOM, where React rejects the accessibility props by name.
 */
export function FoodGlyph({ foodId, size = 20 }: { foodId: string; size?: number }) {
  const theme = useTheme();
  const macro = foodMacro(foodId);

  // Same pairing as the macro rings on the Nutrition screen.
  const tint: Record<FoodMacro, string> = { protein: theme.accent, carbs: theme.brandGreen, fats: theme.brandYellow };

  // createElement rather than `<Glyph />`: the glyphs are module-level
  // components picked from a table, but the React Compiler cannot see that
  // through the lookup and reads a JSX tag held in a local as a component
  // created during render.
  return createElement(foodGlyph(foodId), {
    size,
    color: macro ? tint[macro] : theme.textSecondary,
    strokeWidth: 1.9,
  });
}
