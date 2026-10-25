import type { StyleProp, TextStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useCountUp } from '@/components/energy-guide/use-play-value';
import { formatKcal } from '@/lib/format-kcal';

/** A kcal figure that counts up when its page is first shown (see useCountUp). */
export function CountUpText({
  value,
  play,
  delay = 0,
  format = formatKcal,
  suffix = '',
  style,
}: {
  value: number;
  play: boolean;
  delay?: number;
  format?: (n: number) => string;
  suffix?: string;
  style?: StyleProp<TextStyle>;
}) {
  const shown = useCountUp(value, play, delay);
  return (
    <ThemedText style={[{ fontVariant: ['tabular-nums'] }, style]} numberOfLines={1}>
      {format(shown)}
      {suffix}
    </ThemedText>
  );
}
