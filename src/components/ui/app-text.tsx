import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, type StyleProp, type TextInputProps, type TextProps, type TextStyle } from 'react-native';

import { appFamilyForWeight } from '@/constants/fonts';

/** Resolves a style's fontWeight into the matching app font family (custom
 * fonts don't synthesize weights, so weight and family travel together),
 * unless the style already names its own fontFamily (e.g. monospace). */
export function withAppFont(style: StyleProp<TextStyle>, defaultWeight?: TextStyle['fontWeight']): TextStyle {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (flat.fontFamily) return flat;
  return { ...flat, fontFamily: appFamilyForWeight(flat.fontWeight ?? defaultWeight), fontWeight: 'normal' };
}

/** RN Text that renders in the app font. ThemedText builds on it; use it directly
 * where there is no theme styling to apply (chart labels, etc.). */
export const AppText = forwardRef<Text, TextProps>(function AppText({ style, ...rest }, ref) {
  return <Text ref={ref} style={withAppFont(style)} {...rest} />;
});

/** RN TextInput that renders in the app font. */
export const AppTextInput = forwardRef<TextInput, TextInputProps>(function AppTextInput({ style, ...rest }, ref) {
  return <TextInput ref={ref} style={withAppFont(style, '500')} {...rest} />;
});
