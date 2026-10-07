import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, type StyleProp, type TextInputProps, type TextProps, type TextStyle } from 'react-native';

import { interFamilyForWeight } from '@/constants/fonts';

/** Resolves a style's fontWeight into the matching Inter family (custom
 * fonts don't synthesize weights, so weight and family travel together),
 * unless the style already names its own fontFamily (e.g. monospace). */
export function withInter(style: StyleProp<TextStyle>, defaultWeight?: TextStyle['fontWeight']): TextStyle {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (flat.fontFamily) return flat;
  return { ...flat, fontFamily: interFamilyForWeight(flat.fontWeight ?? defaultWeight), fontWeight: 'normal' };
}

/** RN Text that renders in Inter. ThemedText builds on it; use it directly
 * where there is no theme styling to apply (chart labels, etc.). */
export const AppText = forwardRef<Text, TextProps>(function AppText({ style, ...rest }, ref) {
  return <Text ref={ref} style={withInter(style)} {...rest} />;
});

/** RN TextInput that renders in Inter. */
export const AppTextInput = forwardRef<TextInput, TextInputProps>(function AppTextInput({ style, ...rest }, ref) {
  return <TextInput ref={ref} style={withInter(style, '500')} {...rest} />;
});
