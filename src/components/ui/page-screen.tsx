import { type Href } from 'expo-router';
import { Children } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenScroll } from '@/components/screen-scroll';
import { TabHeader } from '@/components/tab-header';
import { Layout, Spacing } from '@/constants/theme';
import { goBackOr } from '@/lib/navigation/go-back';

export type PageScreenProps = {
  title: string;
  subtitle?: string;
  /** The page's sections, top to bottom: each one enters on its own, one after another, as on the main tabs. */
  children: React.ReactNode;
  /** Modals and sheets opened from the page, kept out of the staggered sections. */
  overlays?: React.ReactNode;
  /** Where the back button lands when there is nothing to go back to (a deep link, a web refresh). */
  fallbackHref?: Href;
};

/**
 * A full page reached from the header menu (Profilo, Notifiche, Impostazioni). It looks and moves like the
 * main tabs: the same fixed top bar — with a back button where the logo is — and the sections entering one
 * at a time from the top, rather than a sheet rising from the bottom.
 */
export function PageScreen({ title, subtitle, children, overlays, fallbackHref = '/' }: PageScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <ScreenScroll
        reveal
        header={<TabHeader title={title} subtitle={subtitle} onBack={() => goBackOr(fallbackHref)} />}
        contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + Spacing.six }]}>
        {Children.toArray(children).map((child, i) => (
          <View key={i} style={i === 0 ? styles.first : styles.section}>
            {child}
          </View>
        ))}
      </ScreenScroll>
      {overlays}
    </>
  );
}

const styles = StyleSheet.create({
  // Reveal needs the sections spaced by their own margins, not the list's gap (see ScreenScroll).
  page: { paddingHorizontal: Layout.screenGutter, gap: 0 },
  first: { marginTop: Spacing.two },
  section: { marginTop: Layout.sectionGap },
});
