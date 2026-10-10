import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import type { Goal } from '@/lib/mock/types';

/** "per una versione … di te." — the hero's promise, worded for the goal. */
const GOAL_PROMISE: Record<Goal, { adjective: string; body: string }> = {
  gainStrength: {
    adjective: 'più forte',
    body: 'Un programma progressivo per aumentare i tuoi carichi, costruire forza e muoverti meglio.',
  },
  gainMuscle: {
    adjective: 'più muscolosa',
    body: 'Un programma progressivo per costruire massa muscolare, forza e migliorare la tua forma fisica.',
  },
  loseFat: {
    adjective: 'più definita',
    body: 'Un programma progressivo per perdere grasso mantenendo i muscoli e migliorare la tua forma fisica.',
  },
  improveEndurance: {
    adjective: 'più resistente',
    body: 'Un programma progressivo per allungare il fiato, reggere più a lungo e recuperare prima.',
  },
  maintainImprove: {
    adjective: 'migliore',
    body: 'Un programma progressivo per mantenere i risultati e continuare a migliorare, mese dopo mese.',
  },
  generalHealth: {
    adjective: 'più in forma',
    body: 'Un programma progressivo per muoverti con costanza, sentirti meglio e restare in salute.',
  },
};

export type PlanJourneyHeroProps = {
  totalMonths: number;
  goal: Goal;
  onPress: () => void;
};

/** The "Il tuo percorso" banner at the top of the training plan: dark card
 * selling the whole program in one line. Tapping it opens the full
 * program description (PlanOverviewPopup). */
export function PlanJourneyHero({ totalMonths, goal, onPress }: PlanJourneyHeroProps) {
  const theme = useTheme();
  const promise = GOAL_PROMISE[goal];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Scopri il tuo percorso">
      <LinearGradient colors={['#2B2B30', '#17171A', '#0E0E10']} locations={[0, 0.55, 1]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.card}>
        <View pointerEvents="none" style={styles.artBig}>
          <Icon name="barbell" size={170} color="rgba(255,255,255,0.10)" />
        </View>
        <View pointerEvents="none" style={styles.artSmall}>
          <Icon name="training" size={74} color="rgba(255,255,255,0.08)" />
        </View>

        <ThemedText style={styles.tag}>IL TUO PERCORSO</ThemedText>
        <View style={styles.copy}>
          <ThemedText style={styles.months}>
            {totalMonths} {totalMonths === 1 ? 'mese' : 'mesi'}
          </ThemedText>
          <ThemedText style={styles.headline}>per una versione {promise.adjective} di te.</ThemedText>
          <ThemedText style={styles.body}>{promise.body}</ThemedText>
        </View>
        <View style={styles.cta}>
          <ThemedText style={[styles.ctaText, { color: theme.accent }]}>Scopri il programma</ThemedText>
          <Icon name="chevronRight" size={15} color={theme.accent} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 20,
    gap: 12,
    overflow: 'hidden',
  },
  artBig: {
    position: 'absolute',
    right: -30,
    top: 10,
    transform: [{ rotate: '-18deg' }],
  },
  artSmall: {
    position: 'absolute',
    right: 70,
    bottom: 6,
    transform: [{ rotate: '12deg' }],
  },
  tag: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  copy: {
    maxWidth: '80%',
    gap: 4,
  },
  months: {
    color: '#FFFFFF',
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '800',
    letterSpacing: -1,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  body: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ctaText: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '700',
  },
});
