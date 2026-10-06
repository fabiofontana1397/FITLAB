import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';

/** The Figma Training hero: green gradient card, white headline + copy and a
 * full-width white "Registra allenamento" button with green label. */
export function TrainingHeroCard({ onRegister }: { onRegister: () => void }) {
  const theme = useTheme();
  return (
    <LinearGradient colors={['#2FBF71', '#1FA85B', '#3DC77F']} locations={[0, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.copy}>
        <ThemedText style={styles.title}>Il tuo allenamento fa la differenza.</ThemedText>
        <ThemedText style={styles.body}>Più energia, più risultati. Traccia le tue sessioni e monitora i tuoi progressi.</ThemedText>
      </View>
      <Pressable
        onPress={onRegister}
        style={[
          styles.button,
          Platform.select({
            web: { boxShadow: '0px 6px 14px rgba(0,0,0,0.12)' },
            default: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
          }),
        ]}>
        <Icon name="barbell" size={22} color={theme.brandGreen} />
        <ThemedText style={[styles.buttonLabel, { color: theme.brandGreen }]}>Registra allenamento</ThemedText>
        <Icon name="chevronRight" size={16} color={theme.brandGreen} />
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    gap: 22,
    overflow: 'hidden',
  },
  copy: {
    maxWidth: '78%',
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
    color: 'rgba(255,255,255,0.88)',
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
    backgroundColor: '#FFFFFF',
  },
  buttonLabel: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
});
