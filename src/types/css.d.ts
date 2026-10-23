// `constants/theme.ts` imports `@/global.css` for its side effect on web
// (the CSS custom properties the font stacks read). Expo does declare
// `*.css`, but only through `expo/types`, which is referenced from the
// generated — and gitignored — `expo-env.d.ts`. On a fresh clone that file
// does not exist yet, so `tsc --noEmit` fails with TS2882 until the Expo CLI
// has run at least once. Declaring it here keeps the typecheck (and CI)
// working straight after `npm ci`.
declare module '*.css';
