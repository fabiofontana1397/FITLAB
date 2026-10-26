import { StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shown when the check-in button is tapped while it is still locked: says why
 * (the month has to end first, and when it does) and what the check-in is for.
 */
export function CheckinInfoPopup({ visible, onClose, monthIndex, daysLeft, endDate }: { visible: boolean; onClose: () => void; monthIndex: number; daysLeft: number; endDate: string }) {
  const theme = useTheme();
  const when = daysLeft <= 1 ? 'Manca meno di un giorno' : `Mancano ${daysLeft} giorni`;
  return (
    <GlassPopup visible={visible} onClose={onClose} style={styles.popup}>
      <View style={[styles.iconTile, { backgroundColor: theme.backgroundElement }]}>
        <Icon name="lock" size={22} color={theme.textSecondary} />
      </View>
      <ThemedText type="title" style={styles.center}>
        Check-in del Mese {monthIndex}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        Il check-in si fa a mese concluso: finisci prima il Mese {monthIndex}, poi si sblocca. {when} (fine il {endDate}).
      </ThemedText>

      <View style={[styles.goal, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">A cosa serve</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Rispondi a poche domande e FitLab confronta ciò che è successo davvero (andamento del peso, sedute fatte, pasti tracciati, come ti sei sentito) con quello che il piano prevedeva.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Con questi dati allenamento e alimentazione vengono adattati dal mese successivo. I mesi già vissuti non cambiano.
        </ThemedText>
      </View>

      <PrimaryButton label="Ho capito" onPress={onClose} />
    </GlassPopup>
  );
}

const styles = StyleSheet.create({
  popup: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch' },
  iconTile: { alignSelf: 'center', width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  goal: { gap: Spacing.two, padding: Spacing.three, borderRadius: 18 },
});
