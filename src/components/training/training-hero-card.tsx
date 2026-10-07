import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';

/** The Training hero: orange gradient card with the "IL TUO OBIETTIVO" tag,
 * a motivating headline and a white "Registra allenamento" button. */
export function TrainingHeroCard({ onRegister }: { onRegister: () => void }) {
  const theme = useTheme();
  return (
    <LinearGradient colors={['#FF8F2A', '#FF6A13', '#F25A00']} locations={[0, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View pointerEvents="none" style={styles.art}>
        <Icon name="barbell" size={150} color="rgba(255,255,255,0.16)" />
      </View>
      <View style={styles.tag}>
        <ThemedText style={styles.tagText}>IL TUO OBIETTIVO</ThemedText>
      </View>
      <View style={styles.copy}>
        <ThemedText style={styles.title}>Costanza oggi, risultati domani.</ThemedText>
        <ThemedText style={styles.body}>Completa la tua sessione e continua a costruire la versione migliore di te.</ThemedText>
      </View>
      <Pressable
        onPress={onRegister}
        style={[
          styles.button,
          Platform.select({
            web: { boxShadow: '0px 6px 14px rgba(0,0,0,0.14)' },
            default: { shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
          }),
        ]}>
        <View style={[styles.plus, { backgroundColor: withAlpha(theme.accent, 0.14) }]}>
          <Icon name="plus" size={20} color={theme.accent} />
        </View>
        <ThemedText style={[styles.buttonLabel, { color: theme.accent }]}>Registra allenamento</ThemedText>
        <Icon name="chevronRight" size={16} color={theme.accent} />
      </Pressable>
    </LinearGradient>
  );
}

function withAlpha(hex: string, alpha: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex;
  return `${hex}${Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
  },
  art: {
    position: 'absolute',
    right: -18,
    top: 20,
    transform: [{ rotate: '-20deg' }],
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  copy: {
    maxWidth: '78%',
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  body: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
  button: {
    marginTop: 4,
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  plus: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    flex: 1,
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '700',
  },
});
