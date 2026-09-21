import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type MCIName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type IonName = ComponentProps<typeof Ionicons>['name'];

/**
 * Semantic icon names used across the app. Keeping a single mapping here
 * means screens never reference a raw icon-set name directly, so the
 * underlying icon set can change without touching feature code.
 */
const ICONS = {
  home: { set: 'ion', name: 'home' },
  homeActive: { set: 'ion', name: 'home' },
  training: { set: 'mci', name: 'dumbbell' },
  nutrition: { set: 'mci', name: 'food-apple-outline' },
  body: { set: 'mci', name: 'human' },
  progress: { set: 'mci', name: 'chart-line' },
  profile: { set: 'ion', name: 'person-circle-outline' },

  gym: { set: 'mci', name: 'weight-lifter' },
  functional: { set: 'mci', name: 'lightning-bolt-outline' },
  running: { set: 'mci', name: 'run' },
  swimming: { set: 'mci', name: 'swim' },
  tennis: { set: 'mci', name: 'tennis' },
  cycling: { set: 'mci', name: 'bike' },
  otherSport: { set: 'mci', name: 'dots-horizontal-circle-outline' },

  flame: { set: 'ion', name: 'flame' },
  trendUp: { set: 'ion', name: 'trending-up' },
  trendDown: { set: 'ion', name: 'trending-down' },
  trendFlat: { set: 'ion', name: 'remove' },
  check: { set: 'ion', name: 'checkmark' },
  checkCircle: { set: 'ion', name: 'checkmark-circle' },
  chevronRight: { set: 'ion', name: 'chevron-forward' },
  chevronDown: { set: 'ion', name: 'chevron-down' },
  close: { set: 'ion', name: 'close' },
  plus: { set: 'ion', name: 'add' },
  calendar: { set: 'ion', name: 'calendar-outline' },
  target: { set: 'mci', name: 'target' },
  protein: { set: 'mci', name: 'food-drumstick-outline' },
  carbs: { set: 'mci', name: 'barley' },
  fats: { set: 'mci', name: 'water-outline' },
  water: { set: 'ion', name: 'water-outline' },
  sleep: { set: 'ion', name: 'moon-outline' },
  heart: { set: 'ion', name: 'heart-outline' },
  scale: { set: 'mci', name: 'scale-bathroom' },
  ruler: { set: 'mci', name: 'tape-measure' },
  camera: { set: 'ion', name: 'camera-outline' },
  bolt: { set: 'ion', name: 'flash' },
  info: { set: 'ion', name: 'information-circle-outline' },
  alert: { set: 'ion', name: 'alert-circle-outline' },
  sparkle: { set: 'ion', name: 'sparkles' },
  settings: { set: 'ion', name: 'settings-outline' },
  medal: { set: 'mci', name: 'medal-outline' },
  arrowBack: { set: 'ion', name: 'chevron-back' },
  search: { set: 'ion', name: 'search' },
  send: { set: 'ion', name: 'send' },
  chatBubble: { set: 'ion', name: 'chatbubble-ellipses' },
  minus: { set: 'ion', name: 'remove-circle-outline' },
  addCircle: { set: 'ion', name: 'add-circle' },
  trash: { set: 'ion', name: 'trash-outline' },
  footsteps: { set: 'mci', name: 'shoe-print' },
  moon: { set: 'ion', name: 'moon' },
  mealSun: { set: 'ion', name: 'sunny' },
  mealMidday: { set: 'ion', name: 'partly-sunny' },
  mealMoon: { set: 'ion', name: 'moon' },
  mealSnack: { set: 'ion', name: 'star' },
  chevronUp: { set: 'ion', name: 'chevron-up' },
  download: { set: 'ion', name: 'download-outline' },
  refresh: { set: 'ion', name: 'refresh-outline' },
  lock: { set: 'ion', name: 'lock-closed-outline' },
  trophy: { set: 'ion', name: 'trophy' },
  bulb: { set: 'ion', name: 'bulb' },
  armFlex: { set: 'mci', name: 'arm-flex' },
} as const satisfies Record<string, { set: 'mci' | 'ion'; name: MCIName | IonName }>;

export type IconName = keyof typeof ICONS;

export type IconProps = {
  name: IconName;
  size?: number;
  color: string;
};

export function Icon({ name, size = 22, color }: IconProps) {
  const entry = ICONS[name];
  if (entry.set === 'mci') {
    return <MaterialCommunityIcons name={entry.name as MCIName} size={size} color={color} />;
  }
  return <Ionicons name={entry.name as IonName} size={size} color={color} />;
}
