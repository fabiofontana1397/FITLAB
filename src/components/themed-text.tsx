import { Platform, StyleSheet, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'hero'
    | 'display'
    | 'title'
    | 'subtitle'
    | 'default'
    | 'label'
    | 'caption'
    | 'small'
    | 'smallBold'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <AppText
      style={[
        { color: theme[themeColor ?? 'text'] },
        styles[type],
        type === 'linkPrimary' && { color: theme.accent },
        style,
      ]}
      {...rest}
    />
  );
}

// Mirrors the iOS text styles (HIG), so the app's hierarchy reads the same
// way the system's does: display ≈ Large Title, title ≈ Title 2, subtitle ≈
// Headline, default ≈ Callout, small ≈ Subheadline, caption ≈ Footnote,
// label ≈ Caption 1. Nothing informational goes below 12 pt — the old 11 pt
// captions were the main reason popups and settings felt hard to read.
const styles = StyleSheet.create({
  hero: {
    fontSize: 46,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  display: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  default: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  link: {
    lineHeight: 20,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 20,
    fontSize: 14,
    fontWeight: '600',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' }) ?? '500',
    fontSize: 13,
  },
});
