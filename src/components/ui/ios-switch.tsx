import { Platform, Switch, type SwitchProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** The iOS-style toggle: white thumb, a soft grey track when off and the
 * accent when on — the same look in every settings sheet. */
export function IosSwitch({ value, onValueChange, disabled }: Pick<SwitchProps, 'value' | 'onValueChange' | 'disabled'>) {
  const theme = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
      thumbColor="#FFFFFF"
      {...(Platform.OS === 'web' ? { activeThumbColor: '#FFFFFF' } : { ios_backgroundColor: theme.backgroundSelected })}
    />
  );
}
