import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSettledValue } from '@/hooks/use-settled-value';

/** After the page first shows, how long before the other pages behind the switch are built in the background. */
const PREWARM_MS = 900;

export type ModePageRender = (state: { active: boolean; enterOnMount: boolean }) => ReactNode;

/**
 * The pages behind a switch at the top of a tab (Scheda / Allenamento veloce, Tracking calorie / Ricette). Every page
 * is kept mounted once built, and the ones not yet opened are built in the background shortly after the tab first
 * shows: switching is then only a change of which page is visible (its scroll position kept), never a page to build
 * right as the switch's thumb lands.
 */
export function ModePages<T extends string>({ value, modes, render }: { value: T; modes: readonly T[]; render: (mode: T, state: { active: boolean; enterOnMount: boolean }) => ReactNode }) {
  const [built, setBuilt] = useState<T[]>(() => [value]);
  // The page changes once the switch's thumb has landed: the page shown next carries its own copy of the switch, already
  // on the new choice, so the swap is seamless.
  const shown = useSettledValue(value);
  const [first] = useState(value);

  // Asked for before the background build: built now (it then fades up as it mounts).
  if (!built.includes(shown)) setBuilt([...built, shown]);

  useEffect(() => {
    const timer = setTimeout(() => setBuilt((b) => (modes.every((m) => b.includes(m)) ? b : [...b, ...modes.filter((m) => !b.includes(m))])), PREWARM_MS);
    return () => clearTimeout(timer);
    // once, after the first page has settled
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      {modes
        .filter((m) => built.includes(m) || m === shown)
        .map((m) => {
          const active = m === shown;
          return (
            <View
              key={m}
              aria-hidden={!active}
              importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
              style={[StyleSheet.absoluteFill, active ? null : styles.hidden]}>
              {render(m, { active, enterOnMount: m !== first && active })}
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hidden: { display: 'none' },
});
