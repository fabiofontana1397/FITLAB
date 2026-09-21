import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
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
    <Text
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

const styles = StyleSheet.create({
  hero: {
    fontSize: 46,
    lineHeight: 48,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  display: {
    fontSize: 33,
    lineHeight: 37,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  title: {
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  default: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  caption: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  small: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  smallBold: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  link: {
    lineHeight: 17,
    fontSize: 12,
  },
  linkPrimary: {
    lineHeight: 17,
    fontSize: 12,
    fontWeight: '600',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' }) ?? '500',
    fontSize: 11,
  },
});
