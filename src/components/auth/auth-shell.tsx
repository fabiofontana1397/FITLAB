import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FadeInView } from '@/components/ui/fade-in-view';
import { ThemedText } from '@/components/themed-text';
import { BrandWordmark } from '@/components/ui/brand-wordmark';
import { Icon, type IconName } from '@/components/ui/icon';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const LIGHT_WASH_TOP = '#F2F2F1';

export type AuthShellProps = {
  title: string;
  subtitle?: string;
  /** Shows the circular back button. Omitted on screens with nowhere to go back to (mid password recovery). */
  onBack?: () => void;
  /** Icon in a soft accent disc above the title, for the confirmation screens. */
  icon?: IconName;
  /** Pinned under the form, above the home indicator: the primary action. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
};

/**
 * Frame shared by sign-in, sign-up and password recovery: wordmark, large
 * title, the form in the middle (scrolls, rides above the keyboard) and the
 * primary action pinned at the bottom — the same structure as the
 * questionnaire screens, so the whole path from welcome to the first
 * question reads as one flow.
 */
export function AuthShell({ title, subtitle, onBack, icon, footer, children }: AuthShellProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {theme.tabBarBlur === 'light' ? (
        <LinearGradient colors={[LIGHT_WASH_TOP, theme.background, '#DEDEDD']} locations={[0, 0.45, 1]} style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]} />
      ) : null}
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.column, { paddingTop: insets.top + Spacing.two }]}>
          <View style={styles.topRow}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Indietro"
                style={[styles.back, { backgroundColor: theme.backgroundElement }]}>
                <Icon name="arrowBack" size={18} color={theme.text} />
              </Pressable>
            ) : (
              <View style={styles.back} />
            )}
            <BrandWordmark height={30} />
            <View style={styles.back} />
          </View>
        </View>

        <ScrollView style={styles.root} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.column, { gap: Spacing.five }]}>
            <FadeInView style={{ gap: Spacing.two, alignItems: 'center' }}>
              {icon ? (
                <View style={[styles.iconDisc, { backgroundColor: theme.accentSoft }]}>
                  <Icon name={icon} size={30} color={theme.accent} />
                </View>
              ) : null}
              <ThemedText type="display" style={styles.centered} accessibilityRole="header">
                {title}
              </ThemedText>
              {subtitle ? (
                <ThemedText type="default" themeColor="textSecondary" style={styles.centered}>
                  {subtitle}
                </ThemedText>
              ) : null}
            </FadeInView>
            {children ? <FadeInView delay={120} style={{ gap: Spacing.three }}>{children}</FadeInView> : null}
          </View>
        </ScrollView>

        {footer ? <View style={[styles.column, { paddingTop: Spacing.three, paddingBottom: insets.bottom + Spacing.three, gap: Spacing.two }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.four },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: Spacing.four },
  iconDisc: { width: 72, height: 72, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  centered: { textAlign: 'center' },
});
