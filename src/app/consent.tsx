import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useTheme } from '@/hooks/use-theme';
import { hapticError, hapticSuccess, hapticTap } from '@/lib/haptics';
import { CONSENT_ITEMS, DISCLAIMER, type ConsentItemId, type LegalDocId } from '@/lib/legal/content';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { useConsentStore } from '@/store/consent-store';

/**
 * Consent gate, shown after sign-up and BEFORE the questionnaire (which already collects health data: age, weight,
 * pregnancy, medical conditions). The person reads the health disclaimer and gives three separate, unticked
 * consents: age 18+, Terms + disclaimer, explicit consent to health data (GDPR art. 9.2.a). Shown again when the
 * legal texts change version. Declining signs out: the service cannot work without these data.
 */
export default function ConsentScreen() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const accept = useConsentStore((s) => s.accept);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const [checked, setChecked] = useState<Record<ConsentItemId, boolean>>({ age: false, terms: false, health: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = CONSENT_ITEMS.every((c) => checked[c.id]);

  const onAccept = async () => {
    if (!allChecked || !user || saving) return;
    setSaving(true);
    const err = await accept(user.id);
    setSaving(false);
    if (err) {
      hapticError();
      setError(err);
      return;
    }
    hapticSuccess();
    router.replace(hasOnboarded ? '/' : '/onboarding');
  };

  const onDecline = async () => {
    await logout();
    router.replace('/welcome');
  };

  const openDoc = (doc: LegalDocId) => router.push({ pathname: '/legal', params: { doc } });

  return (
    <AuthShell
      title="Prima di iniziare"
      subtitle="FitLab ti propone spunti di alimentazione e allenamento, non prescrizioni. Leggi l’avvertenza e dai il tuo consenso per continuare."
      footer={
        <>
          <PrimaryButton label={saving ? 'Salvataggio…' : 'Accetto e continuo'} onPress={onAccept} disabled={!allChecked || saving} />
          <Pressable onPress={onDecline} hitSlop={8} accessibilityRole="button" style={styles.declineRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Non accetto ed esco
            </ThemedText>
          </Pressable>
        </>
      }>
      <FlatCard radius={24} style={styles.card}>
        <View style={styles.cardTitle}>
          <Icon name="alert" size={18} color={theme.text} />
          <ThemedText type="smallBold">{DISCLAIMER.title}</ThemedText>
        </View>
        {DISCLAIMER.sections[0].paragraphs.map((p, i) => (
          <ThemedText key={i} type="small" themeColor="textSecondary">
            {p}
          </ThemedText>
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          Consulta un medico prima di iniziare, soprattutto in caso di gravidanza o allattamento, patologie, farmaci, disturbi alimentari, infortuni recenti o se hai più di 65 anni.
        </ThemedText>
        <Pressable onPress={() => openDoc('disclaimer')} hitSlop={6} accessibilityRole="link">
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            Leggi l’avvertenza completa
          </ThemedText>
        </Pressable>
      </FlatCard>

      <View style={styles.items}>
        {CONSENT_ITEMS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              hapticTap();
              setError(null);
              setChecked((c) => ({ ...c, [item.id]: !c[item.id] }));
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: checked[item.id] }}
            style={styles.itemRow}>
            <View
              style={[
                styles.box,
                { borderColor: checked[item.id] ? theme.accent : theme.border, backgroundColor: checked[item.id] ? theme.accent : 'transparent' },
              ]}>
              {checked[item.id] ? <Icon name="check" size={14} color={theme.onAccent} /> : null}
            </View>
            <ThemedText type="small" style={styles.itemText}>
              {item.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.links}>
        <Pressable onPress={() => openDoc('terms')} hitSlop={6} accessibilityRole="link">
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            Termini d’uso
          </ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary">
          ·
        </ThemedText>
        <Pressable onPress={() => openDoc('privacy')} hitSlop={6} accessibilityRole="link">
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            Informativa privacy
          </ThemedText>
        </Pressable>
      </View>

      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 8 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  items: { gap: 14, marginTop: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  itemText: { flex: 1 },
  links: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  declineRow: { alignSelf: 'center', paddingVertical: 8 },
});
