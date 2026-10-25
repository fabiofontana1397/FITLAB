import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { OnBrand } from '@/constants/theme';
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

/** The same promise, told from the plate. */
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
  onPress: () => void;
  /** Which plan the banner sells: the training program (default) or the diet. */
  kind?: 'training' | 'diet';
  /** Optional white button at the bottom (e.g. "Esplora piano"), in place of the "Scopri" link. */
  action?: { label: string; icon: IconName; onPress: () => void };
};

/** The "Il tuo percorso" banner on Home, one for the training program and
 * one for the diet: a card in the same milky glass as the rest of Home,
 * selling the whole plan in one line. Tapping it opens the full plan
 * description (PlanOverviewPopup / DietOverviewPopup). */
export function PlanJourneyHero({ totalMonths, goal, onPress, kind = 'training', action }: PlanJourneyHeroProps) {
  const theme = useTheme();
  const promise = GOAL_PROMISE[goal];
  const diet = kind === 'diet';
  const label = diet ? 'Scopri il tuo piano alimentare' : 'Scopri il tuo percorso';
  const copy = (
    <>
      <ThemedText style={[styles.tag, { color: theme.accent }]}>IL TUO PERCORSO · {diet ? 'ALIMENTAZIONE' : 'ALLENAMENTO'}</ThemedText>
      <View style={styles.copy}>
        <ThemedText style={styles.months}>
          {totalMonths} {totalMonths === 1 ? 'mese' : 'mesi'}
        </ThemedText>
        <ThemedText style={styles.headline}>per una versione {promise.adjective} di te.</ThemedText>
        <ThemedText style={styles.body} themeColor="textSecondary">
          {diet ? DIET_BODY[goal] : promise.body}
        </ThemedText>
      </View>
    </>
  );
  const card = (
    <FlatCard radius={20} style={styles.card}>
      <View pointerEvents="none" style={styles.artBig}>
        <Icon name={diet ? 'utensils' : 'barbell'} size={diet ? 120 : 136} color={theme.accentSoft} />
      </View>
      <View pointerEvents="none" style={styles.artSmall}>
        <Icon name={diet ? 'nutrition' : 'training'} size={60} color={theme.accentSoft} />
      </View>

      {action ? (
        <PressableScale onPress={onPress} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={label} style={styles.copyPress}>
          {copy}
        </PressableScale>
      ) : (
        copy
      )}
      {action ? (
        <PressableScale onPress={action.onPress} accessibilityRole="button" style={[styles.actionButton, { backgroundColor: theme.accentSoft }]}>
          <View style={[styles.actionIcon, { backgroundColor: theme.accent }]}>
            <Icon name={action.icon} size={16} color={OnBrand.text} />
          </View>
          <ThemedText style={[styles.actionLabel, { color: theme.accent }]}>{action.label}</ThemedText>
          <Icon name="chevronRight" size={16} color={theme.accent} />
        </PressableScale>
      ) : (
        <View style={styles.cta}>
          <ThemedText style={[styles.ctaText, { color: theme.accent }]}>{diet ? 'Scopri il piano' : 'Scopri il programma'}</ThemedText>
          <Icon name="chevronRight" size={15} color={theme.accent} />
        </View>
      )}
    </FlatCard>
  );

  // With its own action button the card can't also be one big button (on
  // web that nests a <button> in a <button>, which browsers and screen
  // readers mangle): only the copy opens the overview then.
  if (action) return card;
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={label}>
      {card}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  copyPress: {
    gap: 8,
  },
  card: {
    padding: 16,
    gap: 8,
  },
  artBig: {
    position: 'absolute',
    right: -24,
    top: 6,
    transform: [{ rotate: '-18deg' }],
  },
  artSmall: {
    position: 'absolute',
    right: 56,
    bottom: 4,
    transform: [{ rotate: '12deg' }],
  },
  tag: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  copy: {
    maxWidth: '80%',
    gap: 2,
  },
  months: {
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  headline: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  body: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 17,
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
  actionButton: {
    marginTop: 4,
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '700',
  },
});
