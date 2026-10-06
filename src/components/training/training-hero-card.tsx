import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';

/** The Figma Training hero: dark card, headline + supporting copy on the
 * left, full-width orange "Registra allenamento" button at the bottom. Like
 * Home's AI Coach card it stays dark in both app themes. */
export function TrainingHeroCard({ onRegister }: { onRegister: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.card}>
      <View pointerEvents="none" style={styles.glow} />
      <View pointerEvents="none" style={styles.art}>
        <Icon name="training" size={120} color="rgba(255,255,255,0.1)" />
      </View>
      <View style={styles.copy}>
        <ThemedText style={styles.title}>Il tuo allenamento fa la differenza.</ThemedText>
        <ThemedText style={styles.body}>Più energia, più risultati. Traccia le tue sessioni e monitora i tuoi progressi.</ThemedText>
      </View>
      <Pressable
        onPress={onRegister}
        style={[
          styles.button,
          { backgroundColor: theme.accent },
          Platform.select({
            web: { boxShadow: '0px 6px 14px #FF6A1347' },
            default: { shadowColor: '#FF6A13', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
          }),
        ]}>
        <Icon name="training" size={22} color="#FFFFFF" />
        <ThemedText style={styles.buttonLabel}>Registra allenamento</ThemedText>
        <Icon name="chevronRight" size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#15161A',
    borderRadius: 20,
    padding: 20,
    gap: 18,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    top: -50,
    right: -60,
    backgroundColor: '#FF7A00',
    opacity: 0.3,
  },
  art: {
    position: 'absolute',
    top: 28,
    right: 14,
    transform: [{ rotate: '-18deg' }],
  },
  copy: {
    maxWidth: '62%',
    gap: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  body: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
  button: {
    height: 54,
    borderRadius: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  buttonLabel: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
});
