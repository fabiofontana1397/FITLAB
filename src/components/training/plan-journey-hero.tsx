import { Pressable, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { OnBrand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Goal } from '@/lib/mock/types';

/** The training program's pitch, worded for the goal. */
const GOAL_BODY: Record<Goal, string> = {
  gainStrength: 'Un programma progressivo per aumentare i tuoi carichi, costruire forza e muoverti meglio.',
  gainMuscle: 'Un programma progressivo per costruire massa muscolare, forza e migliorare la tua forma fisica.',
  loseFat: 'Un programma progressivo per perdere grasso mantenendo i muscoli e migliorare la tua forma fisica.',
  improveEndurance: 'Un programma progressivo per allungare il fiato, reggere più a lungo e recuperare prima.',
  maintainImprove: 'Un programma progressivo per mantenere i risultati e continuare a migliorare, mese dopo mese.',
  generalHealth: 'Un programma progressivo per muoverti con costanza, sentirti meglio e restare in salute.',
};

/** The same pitch, told from the plate. */
const DIET_BODY: Record<Goal, string> = {
  gainStrength: 'Un piano alimentare che sostiene i tuoi allenamenti, con le proteine e l’energia per far salire i carichi.',
  gainMuscle: 'Un piano alimentare in leggero surplus, ricco di proteine, per costruire massa muscolare senza accumulare grasso.',
  loseFat: 'Un piano alimentare in deficit graduale per perdere grasso mantenendo i muscoli, senza rinunce drastiche.',
  improveEndurance: 'Un piano alimentare con i carboidrati giusti al momento giusto, per allenarti più a lungo e recuperare prima.',
  maintainImprove: 'Un piano alimentare equilibrato per mantenere i risultati e continuare a migliorare, mese dopo mese.',
  generalHealth: 'Un piano alimentare mediterraneo e vario per mangiare bene, avere più energia e restare in salute.',
};

export type PlanJourneyHeroProps = {
  totalMonths: number;
  goal: Goal;
  /** Opens the full plan description (the "Dettagli" link). */
  onPress: () => void;
  /** Which plan the card presents: the training program (default) or the diet. */
  kind?: 'training' | 'diet';
  /** The button at the bottom, e.g. "Esplora piano di allenamento". */
  action: { label: string; icon: IconName; onPress: () => void };
};

/**
 * A "Il tuo percorso" card on Home, one for the training program and one for
 * the diet, built like Home's other cards so the page reads as one system:
 * a 14 pt bold title row with its "Dettagli" link (as "Calorie di oggi"),
 * the plan length as the card's figure at 26 pt (as the weekly balance), a
 * two-line 13 pt description in the secondary colour (as the AI Coach), and
 * one button at least 44 pt tall — the HIG's minimum touch target — to open
 * the plan. On narrow phones labels wrap rather than truncate. Its accents
 * and faint watermark artwork take the plan's colour: green for training,
 * orange for the diet.
 */
export function PlanJourneyHero({ totalMonths, goal, onPress, kind = 'training', action }: PlanJourneyHeroProps) {
  const theme = useTheme();
  const diet = kind === 'diet';
  // Each plan wears the colour of its own Home button: orange like "Registra pasto", green like "Registra allenamento".
  const tint = diet ? theme.accent : theme.brandGreen;
  const tintSoft = diet ? theme.accentSoft : theme.successSoft;

  return (
    <FlatCard radius={20} style={styles.card}>
      <View pointerEvents="none" style={styles.artBig}>
        <Icon name={diet ? 'utensils' : 'barbell'} size={diet ? 88 : 100} color={tintSoft} />
      </View>
      <View pointerEvents="none" style={styles.artSmall}>
        <Icon name={diet ? 'nutrition' : 'training'} size={40} color={tintSoft} />
      </View>

      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          <Icon name={diet ? 'utensils' : 'barbell'} size={20} color={tint} />
          <ThemedText style={styles.title} numberOfLines={2}>
            Il tuo percorso · {diet ? 'Alimentazione' : 'Allenamento'}
          </ThemedText>
        </View>
        <Pressable
          onPress={onPress}
          hitSlop={8}
          style={styles.linkRow}
          accessibilityRole="button"
          accessibilityLabel={diet ? 'Dettagli del piano alimentare' : 'Dettagli del programma di allenamento'}>
          <ThemedText style={[styles.linkText, { color: tint }]}>Dettagli</ThemedText>
          <Icon name="chevronRight" size={13} color={tint} />
        </Pressable>
      </View>

      <ThemedText style={styles.value}>
        {totalMonths} {totalMonths === 1 ? 'mese' : 'mesi'}
      </ThemedText>
      <ThemedText style={styles.body} themeColor="textSecondary" numberOfLines={2}>
        {diet ? DIET_BODY[goal] : GOAL_BODY[goal]}
      </ThemedText>

      <PressableScale onPress={action.onPress} accessibilityRole="button" style={[styles.actionButton, { backgroundColor: tintSoft }]}>
        <View style={[styles.actionIcon, { backgroundColor: tint }]}>
          <Icon name={action.icon} size={15} color={OnBrand.text} />
        </View>
        <ThemedText style={[styles.actionLabel, { color: tint }]} numberOfLines={2}>
          {action.label}
        </ThemedText>
        <Icon name="chevronRight" size={15} color={tint} />
      </PressableScale>
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flexShrink: 1,
  },
  title: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  linkText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  // The watermark keeps to the band between the title row and the button, on the right, clear of both.
  artBig: {
    position: 'absolute',
    right: -14,
    top: 34,
    transform: [{ rotate: '-18deg' }],
  },
  artSmall: {
    position: 'absolute',
    right: 70,
    top: 38,
    transform: [{ rotate: '12deg' }],
  },
  value: {
    marginTop: 8,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  body: {
    // Leaves the artwork on the right uncovered.
    maxWidth: '72%',
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  actionButton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
});
