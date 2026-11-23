import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { PageScreen } from '@/components/ui/page-screen';
import { LEGAL_DOCS, LEGAL_VERSION, type LegalDocId, type LegalSection } from '@/lib/legal/content';

/**
 * Avvertenza sulla salute, Termini d'uso and Informativa privacy: `/legal?doc=disclaimer|terms|privacy`.
 * Reachable without an account (from the welcome and register screens), from the consent gate and from Impostazioni.
 */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const id: LegalDocId = doc === 'terms' || doc === 'privacy' ? doc : 'disclaimer';
  const content = LEGAL_DOCS[id];

  return (
    <PageScreen title={content.title} subtitle={content.subtitle} fallbackHref="/welcome">
      {content.sections.map((section, i) => (
        <Section key={i} section={section} />
      ))}
      <ThemedText type="caption" themeColor="textSecondary" style={styles.version}>
        Versione dei documenti: {LEGAL_VERSION}
      </ThemedText>
    </PageScreen>
  );
}

function Section({ section }: { section: LegalSection }) {
  return (
    <FlatCard radius={24} style={styles.card}>
      {section.heading ? (
        <ThemedText type="smallBold" accessibilityRole="header">
          {section.heading}
        </ThemedText>
      ) : null}
      {section.paragraphs.map((p, i) => (
        <ThemedText key={i} type="small" themeColor="textSecondary">
          {p}
        </ThemedText>
      ))}
      {section.bullets ? (
        <View style={styles.bullets}>
          {section.bullets.map((b, i) => (
            <View key={i} style={styles.bulletRow}>
              <ThemedText type="small" themeColor="textSecondary">
                •
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.bulletText}>
                {b}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 8 },
  bullets: { gap: 6 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bulletText: { flex: 1 },
  version: { textAlign: 'center' },
});
