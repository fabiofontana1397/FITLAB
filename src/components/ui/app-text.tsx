import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, type StyleProp, type TextInputProps, type TextProps, type TextStyle } from 'react-native';

import { SYSTEM_FONT_FAMILY, systemFontWeight } from '@/constants/fonts';

/** Puts a style on the system font with a weight iOS actually has,
 * unless the style already names its own fontFamily (e.g. monospace). */
export function withAppFont(style: StyleProp<TextStyle>, defaultWeight?: TextStyle['fontWeight']): TextStyle {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (flat.fontFamily) return flat;
  return { ...flat, fontFamily: SYSTEM_FONT_FAMILY, fontWeight: systemFontWeight(flat.fontWeight ?? defaultWeight) };
}

/** RN Text that renders in the system font. ThemedText builds on it; use it directly
 * where there is no theme styling to apply (chart labels, etc.). */
export const AppText = forwardRef<Text, TextProps>(function AppText({ style, ...rest }, ref) {
  return <Text ref={ref} style={withAppFont(style)} {...rest} />;
});

/** RN TextInput that renders in the system font. */
export const AppTextInput = forwardRef<TextInput, TextInputProps>(function AppTextInput({ style, ...rest }, ref) {
  return <TextInput ref={ref} style={withAppFont(style, '500')} {...rest} />;
});
