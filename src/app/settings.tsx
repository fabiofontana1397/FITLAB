import { router } from 'expo-router';
import { View } from 'react-native';

import { IntegrationsSection } from '@/components/profile/integrations-section';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { useTheme } from '@/hooks/use-theme';
import { hapticWarning } from '@/lib/haptics';
import { useAppStore, type AppearanceMode } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';

const APPEARANCE_OPTIONS: { value: AppearanceMode; label: string }[] = [
  { value: 'light', label: 'Chiaro' },
  { value: 'dark', label: 'Scuro' },
  { value: 'system', label: 'Automatico' },
];

/** Impostazioni, from the header menu: the light/dark theme, the health devices and apps, and sign-out. */
export default function SettingsScreen() {
  const theme = useTheme();
  const appearance = useAppStore((s) => s.appearance);
  const setAppearance = useAppStore((s) => s.setAppearance);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    hapticWarning();
    await logout();
    router.replace('/welcome');
  };

  return (
    <SheetScreen title="Impostazioni">
      <View>
        <SectionHeader title="Tema" />
        <SegmentedControl options={APPEARANCE_OPTIONS} value={appearance} onChange={setAppearance} />
      </View>

      <IntegrationsSection />

      <ListGroup footer="FITLAB · v0.1.0 prototype">
        <ListRow icon="logout" title="Esci" destructive iconTint={theme.backgroundElement} onPress={handleLogout} />
      </ListGroup>
    </SheetScreen>
  );
}
