import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { LiquidGlass, LiquidGlassButton } from '@/components/glass/liquid-glass';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { SectionHeader } from '@/components/ui/section-header';
import { HorizontalScrollDefaults } from '@/constants/scroll';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const PLATE = require('@/assets/images/welcome-plate.webp');
const STRIPES = ['#FF6A13', '#7B5CFF', '#22B35E', '#F6B21B', '#3AA0FF', '#FF3FD1'];

/** Why the OS's Liquid Glass is or isn't drawn on this phone, in plain words. */
function glassStatus(): { on: boolean; text: string } {
  if (Platform.OS !== 'ios') return { on: false, text: 'Il Liquid Glass di Apple esiste solo su iPhone: qui vedi la versione simulata.' };
  const major = Number(String(Platform.Version).split('.')[0]);
  if (major < 26) return { on: false, text: `Questo iPhone ha iOS ${Platform.Version}: il Liquid Glass arriva con iOS 26.` };
  if (!isLiquidGlassAvailable()) return { on: false, text: 'iOS 26 c’è, ma questa app (Expo Go) non attiva il Liquid Glass: vedi la versione simulata.' };
  if (!isGlassEffectAPIAvailable()) return { on: false, text: 'iOS 26 c’è, ma senza le API del Liquid Glass (versione beta): vedi la versione simulata.' };
  return { on: true, text: `Liquid Glass nativo attivo (iOS ${Platform.Version}).` };
}

/**
 * A test box for the OS's Liquid Glass: the same glass controls the app uses (tab bar, header buttons, selectors),
 * over a colourful picture you can scroll under them. Glass only shows what is behind it, so on the app's near-black
 * pages it is barely visible; here it has something to bend.
 */
export function GlassPreview() {
  const theme = useTheme();
  const status = glassStatus();
  return (
    <View>
      <SectionHeader title="Prova Liquid Glass" />
      <View style={styles.stage}>
        <ScrollView {...HorizontalScrollDefaults} style={StyleSheet.absoluteFill} contentContainerStyle={styles.strip}>
          {STRIPES.map((c, i) => (
            <View key={c} style={[styles.stripe, { backgroundColor: c }]}>
              {i % 2 === 0 ? <Image source={PLATE} style={styles.plate} contentFit="cover" /> : null}
            </View>
          ))}
        </ScrollView>
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)']} style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]} />
        <View style={[styles.overlay, { pointerEvents: 'box-none' }]}>
          <View style={[styles.row, { pointerEvents: 'box-none' }]}>
            <LiquidGlassButton size={44} accessibilityLabel="Prova">
              <Icon name="calendar" size={20} color="#FFFFFF" />
            </LiquidGlassButton>
            <LiquidGlassButton size={44} accessibilityLabel="Prova">
              <Icon name="close" size={20} color="#FFFFFF" />
            </LiquidGlassButton>
          </View>
          <LiquidGlass radius={Radius.pill} interactive style={styles.pill}>
            <ThemedText type="smallBold" style={{ color: '#FFFFFF' }}>
              Scorri la foto sotto il vetro
            </ThemedText>
          </LiquidGlass>
        </View>
      </View>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: status.on ? theme.success : theme.warning }]} />
        <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
          {status.text}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { height: 220, borderRadius: Radius.large, overflow: 'hidden' },
  strip: { flexDirection: 'row' },
  stripe: { width: 140, height: 220, alignItems: 'center', justifyContent: 'center' },
  plate: { width: 120, height: 120, borderRadius: 60 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: Spacing.three, justifyContent: 'space-between' },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  pill: { alignSelf: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
});
