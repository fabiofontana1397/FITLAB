import { useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { PrimaryButton } from '@/components/ui/primary-button';
import { IosSwitch } from '@/components/ui/ios-switch';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { Layout, Spacing } from '@/constants/theme';
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
      <View style={styles.groups}>
        <ListGroup header="Pasti" insetSeparators>
          <ListRow
            icon="nutrition"
            title="Promemoria pasti"
            subtitle="Un avviso per i pasti principali."
            trailing={<IosSwitch value={preferences.meal_enabled} onValueChange={(value) => update('meal_enabled', value)} />}
          />
          {TIME_FIELDS.slice(0, 3).map(({ key, label }) => (
            <TimeRow key={key} label={label} value={String(preferences[key])} disabled={!preferences.meal_enabled} onChange={(value) => update(key, value)} />
          ))}
        </ListGroup>

        <ListGroup header="Allenamento" insetSeparators>
          <ListRow
            icon="training"
            title="Promemoria allenamento"
            subtitle="All’ora che preferisci."
            trailing={<IosSwitch value={preferences.training_enabled} onValueChange={(value) => update('training_enabled', value)} />}
          />
          <TimeRow label="Orario" value={preferences.training_time} disabled={!preferences.training_enabled} onChange={(value) => update('training_time', value)} />
        </ListGroup>

        <ListGroup header="Riepiloghi">
          <ListRow
            title="Settimanale"
            subtitle="I progressi della settimana, ogni domenica."
            trailing={<IosSwitch value={preferences.weekly_enabled} onValueChange={(value) => update('weekly_enabled', value)} />}
          />
          <ListRow
            title="Mensile"
            subtitle="Check-in e ricalibrazione del piano."
            trailing={<IosSwitch value={preferences.monthly_enabled} onValueChange={(value) => update('monthly_enabled', value)} />}
          />
        </ListGroup>

        <ListGroup
          header="Su questo iPhone"
          footer="Per riceverle con FitLab chiusa, apri il sito da Safari, aggiungilo alla schermata Home e concedi il permesso.">
          <ListRow
            icon="bell"
            title={pushEnabled ? 'Notifiche abilitate' : 'Abilita notifiche'}
            iconTint={pushEnabled ? theme.successSoft : undefined}
            iconColor={pushEnabled ? theme.success : undefined}
            onPress={busy || pushEnabled ? undefined : onEnablePush}
            trailing={pushEnabled ? <Icon name="checkCircle" size={20} color={theme.success} /> : undefined}
          />
        </ListGroup>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label={busy ? 'Salvataggio…' : 'Salva preferenze'} disabled={busy} onPress={onSave} />
        <ThemedText type="caption" themeColor="textSecondary" style={styles.footnote}>
          Gli orari seguono il fuso orario del dispositivo. Puoi modificare o revocare il permesso dalle impostazioni di iPhone.
        </ThemedText>
      </View>
    </SheetScreen>
  );
}

function TimeRow({ label, value, disabled, onChange }: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.timeRow, disabled && styles.disabled]}>
      <View style={styles.timeIcon}>
        <Icon name="clock" size={17} color={theme.textSecondary} />
      </View>
      <ThemedText type="default" style={styles.timeLabel}>
        {label}
      </ThemedText>
      <TextInput
        accessibilityLabel={`Orario ${label}`}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        keyboardType="numbers-and-punctuation"
        placeholder="08:00"
        placeholderTextColor={theme.textTertiary}
        maxLength={5}
        style={[styles.timeInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: Layout.sectionGap },
  actions: { gap: Spacing.three },
  timeRow: { minHeight: Layout.minTouch + 8, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: 6 },
  timeIcon: { width: 30, alignItems: 'center' },
  timeLabel: { flex: 1 },
  timeInput: { width: 76, height: 36, borderRadius: 10, paddingHorizontal: Spacing.two, textAlign: 'center', fontSize: 17, fontVariant: ['tabular-nums'] },
  disabled: { opacity: 0.45 },
  footnote: { paddingHorizontal: Spacing.three, textAlign: 'center' },
});
