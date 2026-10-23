import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  enableWebPush,
  getNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/notifications/web-push';
import { useAuthStore } from '@/store/auth-store';

const TIME_FIELDS: { key: keyof NotificationPreferences; label: string }[] = [
  { key: 'breakfast_time', label: 'Colazione' },
  { key: 'lunch_time', label: 'Pranzo' },
  { key: 'dinner_time', label: 'Cena' },
  { key: 'training_time', label: 'Allenamento' },
];

export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const userId = useAuthStore((state) => state.user?.id);
  const [preferences, setPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES);
  const [busy, setBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(
    () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted'
  );

  useEffect(() => {
    if (!userId) return;
    getNotificationPreferences(userId).then(setPreferences).catch(() => undefined);
  }, [userId]);

  const update = (key: keyof NotificationPreferences, value: boolean | string) =>
    setPreferences((current) => ({ ...current, [key]: value }));

  const reportError = (message: string) => {
    if (typeof window !== 'undefined') window.alert(message);
    else Alert.alert('FitLab', message);
  };

  const onEnablePush = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      await enableWebPush(userId);
      // The dispatcher only reminds people with saved preferences: enabling push saves the ones on screen too.
      await saveNotificationPreferences(userId, preferences);
      setPushEnabled(true);
      reportError('Notifiche attivate su questo dispositivo: riceverai i promemoria agli orari impostati.');
    } catch (error) {
      reportError(error instanceof Error ? error.message : 'Non è stato possibile attivare le notifiche.');
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (!userId) return;
    const invalid = TIME_FIELDS.some(({ key }) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(preferences[key])));
    if (invalid) return reportError('Inserisci gli orari nel formato 24 ore, per esempio 08:30.');
    setBusy(true);
    try {
      await saveNotificationPreferences(userId, preferences);
      reportError('Preferenze salvate.');
    } catch {
      reportError('Non sono riuscito a salvare le preferenze. Riprova tra poco.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetScreen title="Promemoria" eyebrow="Scegli quando FitLab ti accompagna durante la giornata.">
      <FlatCard style={styles.card}>
        <View style={styles.sectionHeading}>
          <View style={[styles.iconBox, { backgroundColor: theme.accentSoft }]}><Icon name="nutrition" size={18} color={theme.accent} /></View>
          <View style={styles.heading}>
            <ThemedText type="subtitle">Orari dei pasti</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">Un promemoria per i pasti principali.</ThemedText>
          </View>
          <Switch value={preferences.meal_enabled} onValueChange={(value) => update('meal_enabled', value)} trackColor={{ true: theme.accent }} />
        </View>
        {TIME_FIELDS.slice(0, 3).map(({ key, label }) => <TimeRow key={key} label={label} value={String(preferences[key])} onChange={(value) => update(key, value)} />)}
      </FlatCard>

      <FlatCard style={styles.card}>
        <View style={styles.sectionHeading}>
          <View style={[styles.iconBox, { backgroundColor: theme.accentSoft }]}><Icon name="training" size={18} color={theme.accent} /></View>
          <View style={styles.heading}>
            <ThemedText type="subtitle">Allenamento</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">Imposta l’ora che preferisci.</ThemedText>
          </View>
          <Switch value={preferences.training_enabled} onValueChange={(value) => update('training_enabled', value)} trackColor={{ true: theme.accent }} />
        </View>
        <TimeRow label="Promemoria" value={preferences.training_time} onChange={(value) => update('training_time', value)} />
      </FlatCard>

      <FlatCard style={styles.card}>
        <ThemedText type="subtitle">Riepiloghi</ThemedText>
        <PreferenceRow title="Settimana" description="Ricevi il riepilogo dei progressi ogni domenica." value={preferences.weekly_enabled} onChange={(value) => update('weekly_enabled', value)} />
        <PreferenceRow title="Mese" description="Un promemoria per il check-in e la ricalibrazione del piano." value={preferences.monthly_enabled} onChange={(value) => update('monthly_enabled', value)} />
      </FlatCard>

      <FlatCard style={styles.pushCard}>
        <ThemedText type="subtitle">Notifiche su questo iPhone</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">Per riceverle con FitLab chiusa, apri il sito da Safari, aggiungilo alla schermata Home e concedi il permesso.</ThemedText>
        <PrimaryButton label={pushEnabled ? 'Notifiche abilitate' : 'Abilita notifiche'} icon="bell" disabled={busy || pushEnabled} onPress={onEnablePush} />
      </FlatCard>

      <PrimaryButton label={busy ? 'Salvataggio…' : 'Salva preferenze'} disabled={busy} onPress={onSave} />
      <ThemedText type="caption" themeColor="textTertiary" style={styles.footnote}>Gli orari seguono il fuso orario del dispositivo. Puoi modificare o revocare il permesso dalle impostazioni di iPhone.</ThemedText>
    </SheetScreen>
  );
}

function TimeRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.timeRow}>
      <ThemedText type="small">{label}</ThemedText>
      <TextInput
        accessibilityLabel={`Orario ${label}`}
        value={value}
        onChangeText={onChange}
        keyboardType="numbers-and-punctuation"
        placeholder="08:00"
        maxLength={5}
        style={[styles.timeInput, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
      />
    </View>
  );
}

function PreferenceRow({ title, description, value, onChange }: { title: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.heading}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">{description}</ThemedText>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: theme.accent }} />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flex: 1, gap: 4 },
  card: { padding: Spacing.four, gap: Spacing.three, borderRadius: Radius.large },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconBox: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.medium },
  timeRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeInput: { width: 84, height: 40, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.two, textAlign: 'center', fontSize: 15, fontVariant: ['tabular-nums'] },
  preferenceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pushCard: { padding: Spacing.four, gap: Spacing.three, borderRadius: Radius.large },
  footnote: { lineHeight: 18, paddingHorizontal: Spacing.one },
});
