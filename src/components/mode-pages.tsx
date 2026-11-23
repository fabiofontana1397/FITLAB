import { createContext, memo, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { SegmentedControl, type SegmentOption } from '@/components/ui/segmented-control';
import { useSettledValue } from '@/hooks/use-settled-value';

/** After the page first shows, how long before the other pages behind the switch are built in the background. */
const PREWARM_MS = 900;

/** Whether a page behind the switch is the one showing, and whether it should fade up as it mounts. */
export type ModePageState = { active: boolean; enterOnMount: boolean };

const PageStateContext = createContext<ModePageState | null>(null);
const SwitchContext = createContext<{ value: string; onChange: (value: string) => void } | null>(null);

/** The state of the page this is rendered in, when it sits behind a switch (ModePages); null elsewhere. */
export function useModePageState(): ModePageState | null {
  return useContext(PageStateContext);
}

/**
 * The switch at the top of the pages (every page carries its own copy in its header). It reads the choice from
 * ModePages, so a tap redraws only the switches: the pages themselves are never redrawn while the thumb slides.
 */
export function ModeSwitch<T extends string>({ options }: { options: SegmentOption<T>[] }) {
  const ctx = useContext(SwitchContext);
  if (!ctx) return null;
  return <SegmentedControl options={options} value={ctx.value as T} onChange={(v) => ctx.onChange(v)} />;
}

/**
 * The pages behind a switch at the top of a tab (Scheda / Allenamento veloce, Tracking calorie / Ricette). Every page
 * is kept mounted once built, and the ones not yet opened are built in the background shortly after the tab first
 * shows. Each page element is made once and kept: switching never redraws a page. The switch answers at once; once
 * its thumb has landed only the visibility changes, and the page's ScreenScroll (which reads its state from here)
 * fades it up.
 */
export function ModePages<T extends string>({
  value,
  onChange,
  modes,
  render,
}: {
  value: T;
  onChange: (value: T) => void;
  modes: readonly T[];
  render: (mode: T) => ReactNode;
}) {
  const [built, setBuilt] = useState<T[]>(() => [value]);
  const shown = useSettledValue(value);
  const [first] = useState(value);
  const switchValue = useMemo(() => ({ value, onChange: onChange as (v: string) => void }), [value, onChange]);

  // Asked for before the background build: built now (it then fades up as it mounts).
  if (!built.includes(shown)) setBuilt([...built, shown]);

  useEffect(() => {
    const timer = setTimeout(() => setBuilt((b) => (modes.every((m) => b.includes(m)) ? b : [...b, ...modes.filter((m) => !b.includes(m))])), PREWARM_MS);
    return () => clearTimeout(timer);
    // once, after the first page has settled
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SwitchContext.Provider value={switchValue}>
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
                <PageState active={active} enterOnMount={m !== first && active}>
                  <Page mode={m} render={render as (mode: string) => ReactNode} />
                </PageState>
              </View>
            );
          })}
      </View>
    </SwitchContext.Provider>
  );
}

/** A page, drawn once for its mode: a new render function from the parent never redraws it. */
const Page = memo(
  function Page({ mode, render }: { mode: string; render: (mode: string) => ReactNode }) {
    return <>{render(mode)}</>;
  },
  (a, b) => a.mode === b.mode
);

function PageState({ active, enterOnMount, children }: ModePageState & { children: ReactNode }) {
  // enterOnMount only counts when the page mounts: kept as it was then, so the value stays stable afterwards.
  const [enter] = useState(enterOnMount);
  const state = useMemo(() => ({ active, enterOnMount: enter }), [active, enter]);
  return <PageStateContext.Provider value={state}>{children}</PageStateContext.Provider>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hidden: { display: 'none' },
});
