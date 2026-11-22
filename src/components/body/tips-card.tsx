import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TipSection = {
  icon: IconName;
  title: string;
  /** One line per tip: each becomes its own row, so the advice reads as a short list, not a paragraph. */
  points: string[];
};

/**
 * "Consigli" — the how-to and why at the foot of a Progressi tab. One quiet
 * card: a small caps eyebrow, then each topic as a thin icon + title with its
 * tips listed under it, topics split by a hairline. No coloured bars or
 * tinted fills: it is reference material, so it stays out of the way.
 */
export function TipsCard({ sections, eyebrow = 'Consigli' }: { sections: TipSection[]; eyebrow?: string }) {
  const theme = useTheme();
  return (
    <FlatCard radius={Radius.large} style={styles.card}>
      <ThemedText style={styles.eyebrow} themeColor="textTertiary">
        {eyebrow}
      </ThemedText>
      {sections.map((section, i) => (
        <Fragment key={section.title}>
          {i > 0 ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
          <View style={styles.section}>
            <View style={styles.titleRow}>
              <View style={[styles.iconRing, { borderColor: theme.borderStrong }]}>
                <Icon name={section.icon} size={15} color={theme.text} />
              </View>
              <ThemedText style={styles.title}>{section.title}</ThemedText>
            </View>
            <View style={styles.points}>
              {section.points.map((point) => (
                <View key={point} style={styles.pointRow}>
                  <View style={[styles.dot, { backgroundColor: theme.accent }]} />
                  <ThemedText style={styles.pointText} themeColor="textSecondary">
                    {point}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        </Fragment>
      ))}
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 16,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  section: {
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  points: {
    gap: 8,
    paddingLeft: 40,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  pointText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: -0.15,
  },
});
