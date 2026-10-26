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

// The iOS text styles (HIG), in San Francisco metrics: size / line height /
// tracking as Apple's type specimen lists them. display ≈ Large Title,
// title ≈ Title 2, subtitle ≈ Headline, default ≈ Body, small ≈ Subheadline,
// caption ≈ Footnote, label ≈ Caption 1. Nothing informational goes below
// 12 pt.
const styles = StyleSheet.create({
  hero: {
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '700',
    letterSpacing: -1,
  },
  display: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700',
    letterSpacing: 0.37,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.26,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.41,
  },
  default: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.41,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: -0.08,
  },
  small: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: -0.24,
  },
  smallBold: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.24,
  },
  link: {
    lineHeight: 20,
    fontSize: 15,
    letterSpacing: -0.24,
  },
  linkPrimary: {
    lineHeight: 20,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.24,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' }) ?? '500',
    fontSize: 13,
  },
});
