import { createContext, useContext, useMemo } from 'react';
import { runOnJS, useAnimatedReaction, type SharedValue } from 'react-native-reanimated';

/**
 * The opacities of every animated wrapper between a view and the screen (a section's Reveal, a page settling in, a
 * sheet's body fading up…). iOS's native Liquid Glass is not drawn at all under a parent whose opacity is below 1
 * — and it does not come back on its own once the parent is opaque again (expo-glass-effect, "Known issues"). A
 * native glass view reads this chain and only turns its glass on once every fade above it has finished.
 */
const FadeChainContext = createContext<readonly SharedValue<number>[]>([]);

/** Wrap the children of a view whose opacity animates; `opacity` is that view's current opacity (0…1). */
export function FadeLayer({ opacity, children }: { opacity: SharedValue<number>; children: React.ReactNode }) {
  const parent = useContext(FadeChainContext);
  const chain = useMemo(() => [...parent, opacity], [parent, opacity]);
  return <FadeChainContext.Provider value={chain}>{children}</FadeChainContext.Provider>;
}

/** Calls `onChange(true)` once every fading wrapper above is fully opaque, `onChange(false)` when one starts fading. */
export function useAncestorsOpaque(onChange: (opaque: boolean) => void) {
  const chain = useContext(FadeChainContext);
  useAnimatedReaction(
    () => {
      for (let i = 0; i < chain.length; i++) if (chain[i].value < 0.999) return false;
      return true;
    },
    (opaque, previous) => {
      if (opaque !== previous) runOnJS(onChange)(opaque);
    },
    [chain, onChange]
  );
}
