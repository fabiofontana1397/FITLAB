import { useNavigation, useRoute } from 'expo-router';
import { useEffect, useState } from 'react';

/**
 * Whether this screen is the one selected in its own navigator (the chosen tab, for a tab screen), whatever sits on
 * top of it. Unlike `useIsFocused`, which is also false while a sheet or modal route (Profilo, Notifiche…) is
 * presented over the tabs, this stays true then: the page behind a sheet must not reset or replay its entrance
 * animations as the sheet rises and slides away — only a real switch of page should.
 */
export function useIsSelectedTab(): boolean {
  const navigation = useNavigation();
  const route = useRoute();
  const read = () => {
    const state = navigation.getState();
    return state?.routes?.[state.index]?.key === route.key;
  };
  const [selected, setSelected] = useState(read);

  useEffect(() => {
    // `state` fires whenever this navigator's own state changes (a tab switch), not when a parent stack pushes a modal.
    const unsubscribe = (navigation as unknown as { addListener: (type: string, cb: () => void) => () => void }).addListener('state', () => setSelected(read()));
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, route.key]);

  return selected;
}
