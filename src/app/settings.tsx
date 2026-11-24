import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassPreview } from '@/components/profile/glass-preview';
import { IntegrationsSection } from '@/components/profile/integrations-section';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { PageScreen } from '@/components/ui/page-screen';
import { useTheme } from '@/hooks/use-theme';
import { deleteAccount } from '@/lib/api/consents';
import { hapticError, hapticWarning } from '@/lib/haptics';
import { LEGAL_ENTITY, type LegalDocId } from '@/lib/legal/content';
import { useAppStore, type AppearanceMode } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';

const APPEARANCE_OPTIONS: { value: AppearanceMode; label: string }[] = [
  { value: 'light', label: 'Chiaro' },
  { value: 'dark', label: 'Scuro' },
  { value: 'system', label: 'Automatico' },
];

/**
 * Impostazioni, from the header menu: the light/dark theme, the health devices and apps, the legal texts, sign-out
 * and account deletion (App Store guideline 5.1.1(v): it must be possible to start it from inside the app).
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const appearance = useAppStore((s) => s.appearance);
  const setAppearance = useAppStore((s) => s.setAppearance);
  const logout = useAuthStore((s) => s.logout);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleLogout = async () => {
    hapticWarning();
    await logout();
    router.replace('/welcome');
  };

  const openDoc = (doc: LegalDocId) => router.push({ pathname: '/legal', params: { doc } });

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    const error = await deleteAccount();
    if (error) {
      hapticError();
      setDeleting(false);
      setDeleteError(error);
      return;
    }
    hapticWarning();
    // The auth user no longer exists: sign out locally (clears every store through the auth gate).
    await logout();
    router.replace('/welcome');
  };

  return (
    <PageScreen title="Impostazioni" subtitle="Tema, dispositivi salute, privacy e account">
      <View>
        <SectionHeader title="Tema" />
        <SegmentedControl options={APPEARANCE_OPTIONS} value={appearance} onChange={setAppearance} />
      </View>

      <GlassPreview />

      <IntegrationsSection />

      <ListGroup header="Privacy e note legali" footer={`Per esercitare i tuoi diritti privacy scrivi a ${LEGAL_ENTITY.email}.`} insetSeparators>
        <ListRow icon="alert" title="Avvertenza sulla salute" onPress={() => openDoc('disclaimer')} />
        <ListRow icon="file" title="Termini d’uso" onPress={() => openDoc('terms')} />
        <ListRow icon="lock" title="Informativa privacy" onPress={() => openDoc('privacy')} />
      </ListGroup>

      <ListGroup footer="FITLAB · v0.1.0 prototype" insetSeparators>
        <ListRow icon="logout" title="Esci" destructive iconTint={theme.backgroundElement} onPress={handleLogout} />
        <ListRow
          icon="trash"
          title="Elimina account"
          subtitle="Cancella account e dati, anche le foto"
          destructive
          iconTint={theme.backgroundElement}
          onPress={() => {
            hapticWarning();
            setConfirmDelete(true);
          }}
        />
      </ListGroup>

      {confirmDelete ? (
        <FlatCard radius={24} style={styles.confirm}>
          <ThemedText type="smallBold">Eliminare definitivamente l’account?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Verranno cancellati account, profilo, questionario, piani, pasti, allenamenti, misure, foto, conversazioni con il coach e consensi. L’operazione non si può annullare. Revocare il consenso al trattamento dei dati sulla salute equivale a eliminare l’account.
          </ThemedText>
          {deleteError ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {deleteError}
            </ThemedText>
          ) : null}
          <PrimaryButton label={deleting ? 'Eliminazione in corso…' : 'Elimina definitivamente'} dense onPress={handleDelete} disabled={deleting} />
          <PrimaryButton label="Annulla" variant="ghost" dense onPress={() => setConfirmDelete(false)} disabled={deleting} />
        </FlatCard>
      ) : null}
    </PageScreen>
  );
}

const styles = StyleSheet.create({
  confirm: { padding: 20, gap: 10 },
});
