import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Apple,
  Bean,
  Carrot,
  Coffee,
  ConciergeBell,
  Crosshair,
  Droplet,
  Dumbbell,
  Drumstick,
  Flame,
  GlassWater,
  LayoutGrid,
  Milk,
  ScanBarcode,
  Utensils,
  Wheat,
  type LucideIcon,
} from 'lucide-react-native';
import type { ComponentProps } from 'react';
import Svg, { Path } from 'react-native-svg';

type MCIName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type IonName = ComponentProps<typeof Ionicons>['name'];

/**
 * Lucide covers everything to do with food.
 *
 * The rest of the app draws from Ionicons and Material Community Icons,
 * which mix filled and outlined shapes; across the nutrition screens that
 * read as a jumble (a solid drumstick next to an outlined barley stalk
 * next to a water drop). Lucide is one consistent stroke weight, and has a
 * genuine glyph for each food group rather than the nearest approximation
 * — barley standing in for carbohydrates, a water drop for fats.
 *
 * Individual foods in the meal log are pictures, not icons: FoodThumb
 * (components/nutrition/food-thumb.tsx) shows a photo or 3D image of each.
 */
const LUCIDE_ICONS = {
  protein: Drumstick,
  carbs: Wheat,
  fats: Droplet,
  nutrition: Apple,
  utensils: Utensils,
  // Outline counterparts of the filled flame/target, for the Home gauge's three columns.
  flameLine: Flame,
  crosshair: Crosshair,
  water: GlassWater,
  barcode: ScanBarcode,
  mealSun: Coffee,
  mealMidday: Utensils,
  mealMoon: ConciergeBell,
  mealSnack: Apple,
  // The one food group with no macro glyph of its own.
  foodVeg: Carrot,
  // The category chips of "Aggiungi alimento".
  categoryAll: LayoutGrid,
  categoryDairy: Milk,
  categoryLegumes: Bean,
  // A thin, line-drawn dumbbell: the stand-in picture of an exercise with no animation of its own.
  dumbbellLine: Dumbbell,
} satisfies Record<string, LucideIcon>;

/**
 * Semantic icon names used across the app. Keeping a single mapping here
 * means screens never reference a raw icon-set name directly, so the
 * underlying icon set can change without touching feature code.
 */
const ICONS = {
  home: { set: 'ion', name: 'home' },
  homeActive: { set: 'ion', name: 'home' },
  training: { set: 'mci', name: 'dumbbell' },
  body: { set: 'mci', name: 'human' },
  progress: { set: 'mci', name: 'chart-line' },
  plans: { set: 'ion', name: 'clipboard-outline' },
  flag: { set: 'ion', name: 'flag-outline' },
  profile: { set: 'ion', name: 'person-circle-outline' },

  gym: { set: 'mci', name: 'weight-lifter' },
  kettlebell: { set: 'mci', name: 'kettlebell' },
  rowing: { set: 'mci', name: 'rowing' },
  jumpRope: { set: 'mci', name: 'jump-rope' },
  functional: { set: 'mci', name: 'lightning-bolt-outline' },
  running: { set: 'mci', name: 'run' },
  swimming: { set: 'mci', name: 'swim' },
  tennis: { set: 'mci', name: 'tennis' },
  cycling: { set: 'mci', name: 'bike' },
  soccer: { set: 'mci', name: 'soccer' },
  basketball: { set: 'mci', name: 'basketball' },
  volleyball: { set: 'mci', name: 'volleyball' },
  boxing: { set: 'mci', name: 'boxing-glove' },
  yoga: { set: 'mci', name: 'yoga' },
  skiing: { set: 'mci', name: 'ski' },
  hiking: { set: 'mci', name: 'hiking' },
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
  sleep: { set: 'ion', name: 'moon-outline' },
  heart: { set: 'ion', name: 'heart-outline' },
  scale: { set: 'mci', name: 'scale-bathroom' },
  ruler: { set: 'mci', name: 'tape-measure' },
  camera: { set: 'ion', name: 'camera-outline' },
  image: { set: 'ion', name: 'image-outline' },
  file: { set: 'ion', name: 'document-text-outline' },
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
  minusSign: { set: 'ion', name: 'remove' },
  addCircle: { set: 'ion', name: 'add-circle' },
  addCircleOutline: { set: 'ion', name: 'add-circle-outline' },
  trash: { set: 'ion', name: 'trash-outline' },
  logout: { set: 'ion', name: 'log-out-outline' },
  footsteps: { set: 'mci', name: 'shoe-print' },
  moon: { set: 'ion', name: 'moon' },
  chevronUp: { set: 'ion', name: 'chevron-up' },
  download: { set: 'ion', name: 'download-outline' },
  refresh: { set: 'ion', name: 'refresh-outline' },
  swap: { set: 'ion', name: 'swap-vertical' },
  lock: { set: 'ion', name: 'lock-closed-outline' },
  trophy: { set: 'ion', name: 'trophy' },
  bulb: { set: 'ion', name: 'bulb' },
  armFlex: { set: 'mci', name: 'arm-flex' },
  clockOutline: { set: 'mci', name: 'clock-outline' },
  hourglass: { set: 'mci', name: 'timer-sand' },
  weightKg: { set: 'mci', name: 'weight-kilogram' },
  repsHash: { set: 'mci', name: 'pound' },
  crossedArrows: { set: 'mci', name: 'arrow-decision-outline' },
  barbell: { set: 'ion', name: 'barbell' },
  barChart: { set: 'ion', name: 'stats-chart' },
  star: { set: 'ion', name: 'star' },
  starOutline: { set: 'ion', name: 'star-outline' },
  clock: { set: 'ion', name: 'time-outline' },
  gauge: { set: 'mci', name: 'speedometer' },
  personFilled: { set: 'ion', name: 'person' },
  bell: { set: 'ion', name: 'notifications-outline' },
  play: { set: 'ion', name: 'play' },
  pause: { set: 'ion', name: 'pause' },
  stop: { set: 'ion', name: 'stop' },
  edit: { set: 'ion', name: 'create-outline' },
  link: { set: 'ion', name: 'link' },
  watch: { set: 'mci', name: 'watch-variant' },

  // Onboarding question/option icons (see lib/questionnaire/presentation.ts).
  genderMale: { set: 'mci', name: 'gender-male' },
  genderFemale: { set: 'mci', name: 'gender-female' },
  laptop: { set: 'mci', name: 'laptop' },
  walk: { set: 'mci', name: 'walk' },
  standing: { set: 'mci', name: 'human-handsup' },
  leaf: { set: 'mci', name: 'leaf' },
  sprout: { set: 'mci', name: 'sprout' },
  fish: { set: 'mci', name: 'fish' },
  homeOutline: { set: 'ion', name: 'home-outline' },
  tree: { set: 'mci', name: 'tree' },
  shuffle: { set: 'ion', name: 'shuffle' },
  eye: { set: 'ion', name: 'eye-outline' },
  eyeOff: { set: 'ion', name: 'eye-off-outline' },
  mail: { set: 'ion', name: 'mail-outline' },
} as const satisfies Record<string, { set: 'mci' | 'ion'; name: MCIName | IonName }>;

/** Glyphs no icon set draws well, drawn here as filled silhouettes in a 24-pt box like the MCI ones. */
const CUSTOM_ICONS = {
  // A stylized leg seen from the side, knee slightly bent, foot forward (the "Gambe" workout).
  leg: 'M6 1h7.5c.9 3.2 1.6 6.3 1.5 9.5-.1 2.8-1.6 5.4-2.3 8.4 2 .5 4.4.9 6.1 1.5 1.2.5 1.1 2.2-.3 2.2H10.6c-.9 0-1.3-.7-1.1-1.6.3-1.1.5-2.1.3-3.1-.3-1.6-1.3-3-.9-4.8.2-1 .9-1.9 1.6-2.6C9.4 7.6 7.4 4.4 6 1z',
} as const;

export type IconName = keyof typeof ICONS | keyof typeof LUCIDE_ICONS | keyof typeof CUSTOM_ICONS;

export type IconProps = {
  name: IconName;
  size?: number;
  color: string;
  /** Line weight of the Lucide (food) glyphs; ignored by the filled icon sets. */
  strokeWidth?: number;
};

export function Icon({ name, size = 22, color, strokeWidth = 1.9 }: IconProps) {
  if (name in CUSTOM_ICONS) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={CUSTOM_ICONS[name as keyof typeof CUSTOM_ICONS]} fill={color} />
      </Svg>
    );
  }
  if (name in LUCIDE_ICONS) {
    const Glyph = LUCIDE_ICONS[name as keyof typeof LUCIDE_ICONS];
    // 1.9 at 22px matches the visual weight of the Ionicons outline
    // glyphs it sits beside; lucide's own default (2) reads heavier at
    // the small sizes this app uses most.
    return <Glyph size={size} color={color} strokeWidth={strokeWidth} />;
  }
  const entry = ICONS[name as keyof typeof ICONS];
  if (entry.set === 'mci') {
    return <MaterialCommunityIcons name={entry.name as MCIName} size={size} color={color} />;
  }
  return <Ionicons name={entry.name as IonName} size={size} color={color} />;
}
