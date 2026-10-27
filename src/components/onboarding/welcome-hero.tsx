import { Image } from 'expo-image';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const PLATE = require('@/assets/images/welcome-plate.webp');

/** The plate photo is laid out in a 900-unit square; every chip below is placed in those units and scaled with the plate. */
const UNITS = 900;
const ITEMS = [
  { name: 'Riso integrale', kcal: 135, icon: require('@/assets/images/food-icons/sheaf-of-rice.webp'), left: 58, top: 38, width: 470 },
  { name: 'Insalata', kcal: 14, icon: require('@/assets/images/food-icons/leafy-green.webp'), left: 640, top: 226, width: 340 },
  { name: 'Petto di pollo', kcal: 248, icon: require('@/assets/images/food-icons/poultry-leg.webp'), left: -140, top: 408, width: 466 },
  { name: 'Avocado', kcal: 160, icon: require('@/assets/images/food-icons/avocado.webp'), left: 540, top: 638, width: 372 },
] as const;
const CHIP_HEIGHT = 138;

/**
 * Welcome-screen hero: a plate of food photographed from above, four labelled
 * chips with the kcal of each ingredient, and orange scanner corners framing it.
 */
export function WelcomeHero() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const size = Math.min(width * 0.76, 330);
  const f = size / UNITS;
  const frameW = size * 1.128;
  const frameH = size * 1.02;
  const chipBg = theme.tabBarBlur === 'light' ? '#FFFFFF' : theme.backgroundSelected;

  return (
    <View
      style={{ width: '100%', height: frameH, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ position: 'absolute', width: frameW, height: frameH }} pointerEvents="none">
        {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
          <View
            key={corner}
            style={[
              styles.corner,
              { borderColor: theme.accent },
              corner[0] === 't' ? { top: 0, borderTopWidth: 2.5 } : { bottom: 0, borderBottomWidth: 2.5 },
              corner[1] === 'l'
                ? { left: 0, borderLeftWidth: 2.5, borderTopLeftRadius: corner === 'tl' ? 16 : 0, borderBottomLeftRadius: corner === 'bl' ? 16 : 0 }
                : { right: 0, borderRightWidth: 2.5, borderTopRightRadius: corner === 'tr' ? 16 : 0, borderBottomRightRadius: corner === 'br' ? 16 : 0 },
            ]}
          />
        ))}
      </View>

      <View style={{ width: size, height: size }}>
        <Image source={PLATE} style={{ width: size, height: size }} contentFit="contain" />
        {ITEMS.map((item) => (
          <View
            key={item.name}
            style={[
              styles.chip,
              {
                left: item.left * f,
                top: item.top * f,
                width: item.width * f,
                height: CHIP_HEIGHT * f,
                borderRadius: (CHIP_HEIGHT * f) / 2,
                backgroundColor: chipBg,
                borderColor: theme.border,
              },
            ]}
          >
            <Image source={item.icon} style={styles.chipIcon} contentFit="contain" />
            <View style={styles.chipText}>
              <ThemedText style={styles.chipName} numberOfLines={1}>
                {item.name}
              </ThemedText>
              <ThemedText style={styles.chipKcal} themeColor="textSecondary" numberOfLines={1}>
                {item.kcal} kcal
              </ThemedText>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const ARM = 38;
const styles = StyleSheet.create({
  corner: { position: 'absolute', width: ARM, height: ARM },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: '0px 4px 14px rgba(20,20,25,0.10)',
  },
  chipIcon: { width: 24, height: 24 },
  chipText: { flex: 1, minWidth: 0 },
  chipName: { fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  chipKcal: { fontSize: 12, lineHeight: 15, fontWeight: '500' },
});
