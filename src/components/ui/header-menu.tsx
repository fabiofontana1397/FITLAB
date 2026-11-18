import { Image } from 'expo-image';
import { router, usePathname, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { LiquidGlassButton } from '@/components/glass/liquid-glass';
import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSoft, hapticTap } from '@/lib/haptics';
import { useUserStore } from '@/store/user-store';

const PANEL_WIDTH = 252;
const GAP_BELOW_BUTTON = 8;
const OPEN_MS = 420;
const CLOSE_MS = 260;
const WEB = Platform.OS === 'web';

type Anchor = { top: number; right: number; buttonWidth: number };

type Item = { icon: IconName; label: string; href: Href };

const MENU_PATHS: string[] = ['/profile', '/notification-settings', '/settings'];

const ITEMS: Item[] = [
  { icon: 'bell', label: 'Notifiche', href: '/notification-settings' as Href },
  { icon: 'settings', label: 'Impostazioni', href: '/settings' as Href },
];

/**
 * The top-right menu of every main page: a round glass button with three thin
 * bars that opens a small panel under it — Profilo, Notifiche, Impostazioni.
 *
 * The panel comes out of the button with a genie motion: it first pours down as
 * a narrow stream from the button, then widens to full size, and is drawn back
 * into the button the same way when it closes. Reduced motion swaps it for a fade.
 */
export function HeaderMenu({ size = 40 }: { size?: number }) {
  const theme = useTheme();
  const anchorRef = useRef<View>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [open, setOpen] = useState(false);

  const show = () => {
    anchorRef.current?.measureInWindow((x, y, w, h) => {
      setAnchor({ top: y + h + GAP_BELOW_BUTTON, right: Math.max(Spacing.three, windowWidth - (x + w)), buttonWidth: w });
      setOpen(true);
    });
  };

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <LiquidGlassButton onPress={show} hitSlop={8} scaleTo={0.9} accessibilityLabel="Apri menu" size={size}>
          <MenuGlyph width={Math.round(size * 0.42)} color={theme.text} />
        </LiquidGlassButton>
      </View>
      <MenuPanel anchor={anchor} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Three parallel hairline bars, the same length: the minimal "menu" mark. */
function MenuGlyph({ width, color }: { width: number; color: string }) {
  return (
    <View style={[styles.glyph, { width }]} pointerEvents="none">
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.bar, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

function MenuPanel({ anchor, visible, onClose }: { anchor: Anchor | null; visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  const reduceMotion = useReducedMotion();
  const name = useUserStore((s) => s.name);
  const avatarUri = useUserStore((s) => s.avatarUri);

  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const progress = useSharedValue(0);
  const pending = useRef<Href | null>(null);
  const pathname = usePathname();

  const finishClose = useCallback(() => {
    setMounted(false);
    const next = pending.current;
    pending.current = null;
    if (!next || next === pathname) return;
    // From one menu page to another the new one takes its place, so Indietro always goes back to the tab.
    if (MENU_PATHS.includes(pathname)) router.replace(next);
    else router.push(next);
  }, [pathname]);

  useEffect(() => {
    if (visible) {
      hapticSoft();
      progress.value = withTiming(1, { duration: reduceMotion ? 120 : OPEN_MS, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
      return;
    }
    if (!mounted) return;
    progress.value = withTiming(0, { duration: reduceMotion ? 100 : CLOSE_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  }, [visible, mounted, reduceMotion, progress, finishClose]);

  const go = (href: Href) => {
    hapticTap();
    // The panel goes back into the button first, then the page opens.
    pending.current = href;
    onClose();
  };

  // The genie: the height pours down ahead of the width, so for the first half of the motion the panel is a
  // narrow stream hanging from the button; then it widens to full size. Both scale from the button's centre.
  const originX = PANEL_WIDTH - (anchor?.buttonWidth ?? 40) / 2;
  const panelStyle = useAnimatedStyle(() => {
    const p = progress.value;
    if (reduceMotion) return { opacity: p, transform: [{ scale: 1 }] };
    return {
      opacity: interpolate(p, [0, 0.12], [0, 1], 'clamp'),
      transform: [
        { scaleY: interpolate(p, [0, 0.55, 1], [0.04, 1, 1], 'clamp') },
        { scaleX: interpolate(p, [0, 0.4, 1], [0.12, 0.26, 1], 'clamp') },
      ],
    };
  });
  // The rows only show once the panel is nearly full size, so the text is never seen squeezed.
  const contentStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0.6, 1], [0, 1], 'clamp') }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  if (!anchor) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Chiudi menu">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrimSoft }, scrimStyle]} />
      </Pressable>
      <Animated.View
        style={[
          styles.panelWrap,
          { top: anchor.top, right: anchor.right, transformOrigin: `${originX}px 0px` },
          panelStyle,
        ]}>
        <GlassSurface
          level="overlay"
          radius={Radius.large}
          blur={!WEB}
          style={[styles.panel, WEB && !isDark && styles.panelFillLight, isDark && { backgroundColor: theme.surfacePopup }]}>
          <Animated.View style={contentStyle}>
            <Pressable
              onPress={() => go('/profile')}
              accessibilityRole="button"
              accessibilityLabel="Profilo"
              style={({ pressed }) => [styles.profileRow, pressed && { backgroundColor: theme.backgroundSelected }]}>
              <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <ThemedText type="smallBold" style={{ color: theme.accent }}>
                    {name.charAt(0).toUpperCase() || '?'}
                  </ThemedText>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {name || 'Profilo'}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                  Profilo e questionario
                </ThemedText>
              </View>
              <Icon name="chevronRight" size={15} color={theme.textTertiary} />
            </Pressable>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {ITEMS.map((item) => (
              <Pressable
                key={item.label}
                onPress={() => go(item.href)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSelected }]}>
                <Icon name={item.icon} size={20} color={theme.text} />
                <ThemedText type="default" style={styles.rowLabel}>
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </Animated.View>
        </GlassSurface>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  glyph: {
    gap: 4,
  },
  bar: {
    height: 1.75,
    borderRadius: 1,
  },
  panelWrap: {
    position: 'absolute',
    width: PANEL_WIDTH,
  },
  panel: {
    padding: Spacing.two,
  },
  panelFillLight: {
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 38,
    height: 38,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.one,
    marginHorizontal: Spacing.two,
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    paddingHorizontal: Spacing.two + 2,
    borderRadius: Radius.small,
  },
  rowLabel: {
    fontWeight: '500',
  },
});
