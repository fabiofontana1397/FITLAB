import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Children, Fragment, isValidElement } from 'react';

import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Layout, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticTap } from '@/lib/haptics';

/** Width of a row's leading icon tile plus its gap: hairlines start here, so
 * they line up under the labels like iOS Settings, not under the icons. */
const ICON_TILE = 28;
const ROW_INSET = Spacing.four;
const GROUP_RADIUS = 26;

export type ListGroupProps = {
  /** Small uppercase heading above the card. */
  header?: string;
  /** Explanatory text under the card. */
  footer?: string;
  /** Inset the separators past a leading icon (set when rows have icons). */
  insetSeparators?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/**
 * An iOS-style grouped list section: optional header, one card holding
 * rows divided by hairlines, optional footer. Related settings sit together
 * in a single compact surface instead of a scatter of separate cards.
 */
export function ListGroup({ header, footer, insetSeparators, style, children }: ListGroupProps) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.group, style]}>
      {header ? (
        <ThemedText type="label" themeColor="textSecondary" style={styles.header} accessibilityRole="header">
          {header}
        </ThemedText>
      ) : null}
      <FlatCard radius={GROUP_RADIUS}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 ? (
              <View
                style={[
                  styles.separator,
                  { backgroundColor: theme.border, marginLeft: ROW_INSET + (insetSeparators ? ICON_TILE + Spacing.three : 0) },
                ]}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </FlatCard>
      {footer ? (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.footer}>
          {footer}
        </ThemedText>
      ) : null}
    </View>
  );
}

export type ListRowProps = {
  title: string;
  /** Second line under the title, for what the row does. */
  subtitle?: string;
  icon?: IconName;
  /** Tile color behind the icon; defaults to the accent's soft tint. */
  iconTint?: string;
  iconColor?: string;
  /** Right-hand control or value (a Switch, a time field, a count…). */
  trailing?: React.ReactNode;
  /** Makes the row tappable and shows a chevron unless `trailing` is set. */
  onPress?: () => void;
  destructive?: boolean;
  accessibilityLabel?: string;
};

export function ListRow({ title, subtitle, icon, iconTint, iconColor, trailing, onPress, destructive, accessibilityLabel }: ListRowProps) {
  const theme = useTheme();
  const titleColor = destructive ? theme.danger : theme.text;
  const content = (
    <>
      {icon ? (
        <View style={styles.iconTile}>
          <Icon name={icon} size={22} color={iconColor ?? (destructive ? theme.danger : theme.textTertiary)} />
        </View>
      ) : null}
      <View style={styles.texts}>
        <ThemedText type="default" style={[styles.title, { color: titleColor }]}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {trailing ?? (onPress && !destructive ? <Icon name="chevronRight" size={16} color={theme.textTertiary} /> : null)}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundSelected }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  header: {
    paddingHorizontal: ROW_INSET,
  },
  footer: {
    paddingHorizontal: ROW_INSET,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  row: {
    minHeight: Layout.minTouch + 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: ROW_INSET,
    paddingVertical: 12,
  },
  iconTile: {
    width: ICON_TILE,
    height: ICON_TILE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
});
