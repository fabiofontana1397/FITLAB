import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { bmr } from '@/domain/energy';
import { useHealthEnergy } from '@/hooks/use-health-energy';
import { useTheme } from '@/hooks/use-theme';
import { useUserContext } from '@/hooks/use-user-context';
import { healthProvider } from '@/lib/health/health-provider';
import type { HealthProviderId } from '@/lib/health/types';
import { daysAgoISO } from '@/lib/mock/dates';
import { useHealthStore } from '@/store/health-store';

type ProviderMeta = { id: HealthProviderId; name: string; detail: string; platform: 'ios' | 'android'; icon: IconName };

const PROVIDERS: ProviderMeta[] = [
  { id: 'appleHealth', name: 'Apple Salute', detail: 'iPhone e Apple Watch', platform: 'ios', icon: 'heart' },
  {
    id: 'healthConnect',
    name: 'Health Connect di Google',
    detail: 'Android: Google Fit, Samsung Health, Fitbit e smartwatch Android',
    platform: 'android',
    icon: 'heart',
  },
];

const fmt = (n: number) => Math.round(n).toLocaleString('it-IT');

/**
 * "Dispositivi e app salute" in Profilo: connects the phone's health store
 * (Apple Salute on iPhone, Health Connect on Android) and shows what FITLAB
 * learned from it — steps, active and resting calories, and how they refine
 * the burned-calories estimate (domain/health-calibration.ts).
 */
export function IntegrationsSection() {
  const theme = useTheme();
  const provider = useHealthStore((s) => s.provider);
  const lastSyncAt = useHealthStore((s) => s.lastSyncAt);
  const isSyncing = useHealthStore((s) => s.isSyncing);
  const lastError = useHealthStore((s) => s.lastError);
  const connect = useHealthStore((s) => s.connect);
  const disconnect = useHealthStore((s) => s.disconnect);
  const sync = useHealthStore((s) => s.sync);
  const days = useHealthStore((s) => s.days);
  const { calibration } = useHealthEnergy();
  const ctx = useUserContext();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const today = days[daysAgoISO(0)];
  const yesterday = days[daysAgoISO(1)];
  const estimatedBmr = Math.round(bmr(ctx));

  const onConnect = async () => {
    setBusy(true);
    setMessage(null);
    const result = await connect();
    setBusy(false);
    if (!result.ok) setMessage(result.message ?? null);
  };

  return (
    <View style={{ gap: Spacing.two }}>
      <ThemedText type="subtitle">Dispositivi e app salute</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        Collega l’app salute del telefono: passi e calorie (a riposo e in movimento) rendono più precisa la stima delle calorie che bruci, del tuo metabolismo basale e dei tuoi allenamenti.
      </ThemedText>

      <GlassSurface level="card" radius={Radius.large} style={styles.list}>
        {PROVIDERS.map((p, i) => {
          const onThisDevice = Platform.OS === p.platform;
          const isConnected = provider === p.id;
          return (
            <View key={p.id} style={[styles.providerBlock, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
              <View style={[styles.row, !onThisDevice && { opacity: 0.5 }]}>
                <View style={[styles.rowIcon, { backgroundColor: isConnected ? theme.accentSoft : theme.backgroundElement }]}>
                  <Icon name={p.icon} size={18} color={isConnected ? theme.accent : theme.textSecondary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText type="smallBold">{p.name}</ThemedText>
                  <ThemedText type="caption" themeColor="textTertiary">
                    {onThisDevice ? p.detail : `Disponibile su ${p.platform === 'ios' ? 'iPhone' : 'Android'}`}
                  </ThemedText>
                </View>
                {isConnected ? (
                  <View style={[styles.pill, { backgroundColor: theme.successSoft }]}>
                    <Icon name="check" size={13} color={theme.success} />
                    <ThemedText type="caption" style={{ color: theme.success, fontWeight: '700' }}>
                      Collegato
                    </ThemedText>
                  </View>
                ) : onThisDevice ? (
                  <Pressable onPress={onConnect} disabled={busy} style={[styles.pill, { backgroundColor: theme.accent }]}>
                    {busy ? (
                      <ActivityIndicator size="small" color={theme.onAccent} />
                    ) : (
                      <ThemedText type="caption" style={{ color: theme.onAccent, fontWeight: '700' }}>
                        Collega
                      </ThemedText>
                    )}
                  </Pressable>
                ) : null}
              </View>

              {isConnected ? (
                <View style={{ gap: Spacing.three }}>
                  <View style={styles.tiles}>
                    <DataTile icon="footsteps" label="Passi oggi" value={today?.steps != null ? fmt(today.steps) : '—'} />
                    <DataTile icon="flame" label="Kcal attive oggi" value={today?.activeKcal != null ? fmt(today.activeKcal) : '—'} />
                    <DataTile icon="moon" label="Kcal a riposo ieri" value={yesterday?.basalKcal != null ? fmt(yesterday.basalKcal) : '—'} />
                  </View>

                  <View style={[styles.insight, { backgroundColor: theme.backgroundElement }]}>
                    <InsightLine
                      icon="heart"
                      title="Metabolismo basale"
                      text={
                        calibration?.restingKcal
                          ? `${fmt(calibration.restingKcal)} kcal/giorno misurate (stima dalla formula: ${fmt(estimatedBmr)}). Usiamo il tuo valore reale.`
                          : `Stima dalla formula: ${fmt(estimatedBmr)} kcal/giorno. Bastano 3 giorni di dati per usare il tuo valore reale (${calibration?.restingDays ?? 0}/3).`
                      }
                    />
                    <InsightLine
                      icon="barbell"
                      title="Calorie degli allenamenti"
                      text={
                        calibration?.exerciseFactor
                          ? `Le tue sessioni bruciano ${calibration.exerciseFactor >= 1 ? 'il ' + Math.round((calibration.exerciseFactor - 1) * 100) + '% in più' : 'il ' + Math.round((1 - calibration.exerciseFactor) * 100) + '% in meno'} della stima: le prossime sono corrette di conseguenza.`
                          : 'Completa almeno 2 allenamenti registrati dallo smartwatch: confrontiamo le calorie misurate con la stima e la correggiamo.'
                      }
                    />
                    <InsightLine
                      icon="footsteps"
                      title="Attività quotidiana"
                      text="Nei giorni passati usiamo passi e calorie attive reali al posto della stima dal tipo di lavoro."
                    />
                  </View>

                  <View style={styles.actions}>
                    <ThemedText type="caption" themeColor="textTertiary" style={{ flex: 1 }}>
                      {isSyncing
                        ? 'Aggiornamento…'
                        : lastError
                          ? lastError
                          : lastSyncAt
                            ? `Aggiornato alle ${new Date(lastSyncAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
                            : ''}
                    </ThemedText>
                    <Pressable onPress={() => void sync({ force: true })} hitSlop={8} disabled={isSyncing}>
                      <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '700' }}>
                        Aggiorna
                      </ThemedText>
                    </Pressable>
                  </View>
                  {healthProvider.openSettings ? (
                    <PrimaryButton label="Gestisci permessi" variant="outline" dense onPress={healthProvider.openSettings} />
                  ) : null}
                  <Pressable onPress={disconnect} hitSlop={8}>
                    <ThemedText type="caption" style={{ color: theme.danger, textAlign: 'center' }}>
                      Scollega {p.name}
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </GlassSurface>

      {message ? (
        <ThemedText type="caption" style={{ color: theme.warning }}>
          {message}
        </ThemedText>
      ) : null}
      {Platform.OS === 'web' ? (
        <ThemedText type="caption" themeColor="textTertiary">
          Il collegamento si attiva dall’app FITLAB sul telefono: dal browser non è possibile leggere i dati salute.
        </ThemedText>
      ) : null}
    </View>
  );
}

function DataTile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.backgroundElement }]}>
      <Icon name={icon} size={15} color={theme.accent} />
      <ThemedText type="smallBold">{value}</ThemedText>
      <ThemedText type="caption" themeColor="textTertiary" numberOfLines={2}>
        {label}
      </ThemedText>
    </View>
  );
}

function InsightLine({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.insightLine}>
      <Icon name={icon} size={15} color={theme.textSecondary} />
      <View style={{ flex: 1, gap: 1 }}>
        <ThemedText type="caption" style={{ fontWeight: '700' }}>
          {title}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {text}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.three },
  providerBlock: { paddingVertical: Spacing.three, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowIcon: { width: 36, height: 36, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: Radius.pill, minWidth: 76, justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: Spacing.two },
  tile: { flex: 1, gap: 2, padding: Spacing.two + 2, borderRadius: Radius.medium },
  insight: { gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.medium },
  insightLine: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
