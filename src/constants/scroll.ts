import { Platform, type ScrollViewProps } from 'react-native';

/**
 * One scrolling behaviour for the whole app.
 *
 * Before this, each ScrollView decided for itself: four of roughly twenty
 * set `keyboardShouldPersistTaps`, none set keyboard insets, and bouncing
 * was whatever the platform defaulted to. The result was that the same
 * gesture did different things on different screens — most visibly, the
 * first tap on a button with the keyboard open was swallowed by the
 * dismiss on every screen that had not opted in.
 *
 * Spread `ScrollDefaults` into a ScrollView (or `ListDefaults` into a
 * FlatList) and override only what that screen genuinely needs.
 */

/** Keyboard behaviour shared by every scrollable surface. */
const keyboard = {
  /**
   * A tap on a button while the keyboard is open should press the button,
   * not just dismiss the keyboard and make the user tap again. 'handled'
   * keeps the dismiss for taps on empty space.
   */
  keyboardShouldPersistTaps: 'handled',
  /**
   * Dragging the list pushes the keyboard away. iOS can track the finger
   * ('interactive'); everywhere else it goes at the start of the drag.
   */
  keyboardDismissMode: Platform.OS === 'ios' ? 'interactive' : 'on-drag',
} satisfies Pick<ScrollViewProps, 'keyboardShouldPersistTaps' | 'keyboardDismissMode'>;

/** iOS-only insets. Guarded so React Native Web never sees unknown props. */
const iosInsets = Platform.select<ScrollViewProps>({
  ios: {
    /**
     * Lift the content above the keyboard instead of letting the keyboard
     * cover the field being typed into.
     */
    automaticallyAdjustKeyboardInsets: true,
    /**
     * Every screen already pads itself from `useSafeAreaInsets`, so letting
     * iOS also add its own automatic inset would double the top gap.
     */
    contentInsetAdjustmentBehavior: 'never',
    /**
     * Bounce even when the content is shorter than the screen, so a short
     * screen feels the same under the thumb as a long one.
     */
    alwaysBounceVertical: true,
    alwaysBounceHorizontal: false,
  },
  default: {},
}) as ScrollViewProps;

/** Vertical scrolling surfaces: screens, sheets, popups. */
export const ScrollDefaults: ScrollViewProps = {
  ...keyboard,
  ...iosInsets,
  showsVerticalScrollIndicator: false,
  scrollEventThrottle: 16,
};

/**
 * Horizontal strips (day pickers, month steppers, segmented tracks). No
 * keyboard insets — they never hold a field — and no vertical bounce.
 */
export const HorizontalScrollDefaults: ScrollViewProps = {
  ...keyboard,
  horizontal: true,
  showsHorizontalScrollIndicator: false,
  ...Platform.select<ScrollViewProps>({
    ios: { alwaysBounceHorizontal: true, alwaysBounceVertical: false, contentInsetAdjustmentBehavior: 'never' },
    default: {},
  }),
};

/**
 * FlatList/SectionList. Same keyboard contract as ScrollDefaults, plus the
 * windowing defaults that keep a long food search responsive.
 */
// Deliberately not annotated as `FlatListProps<unknown>`: spreading an
// annotated object pins the list's item type to `unknown` and every
// `renderItem` loses its typing.
export const ListDefaults = {
  ...ScrollDefaults,
  keyboardShouldPersistTaps: 'handled' as const,
  removeClippedSubviews: Platform.OS !== 'web',
  initialNumToRender: 12,
  windowSize: 9,
};
