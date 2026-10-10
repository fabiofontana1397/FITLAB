import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useIntegrationsStore, type IntegrationData, type IntegrationId } from '@/store/integrations-store';

type Provider = {
  id: IntegrationId;
  name: string;
  icon: IconName;
  /** Only on this OS (HealthKit lives on iPhone, Health Connect on Android). */
  platform?: 'ios' | 'android';
  data: IntegrationData[];
};

const PROVIDERS: Provider[] = [
  { id: 'appleHealth', name: 'Apple Salute', icon: 'heart', platform: 'ios', data: ['steps', 'weight', 'workouts', 'sleep', 'heartRate'] },
  { id: 'healthConnect', name: 'Health Connect', icon: 'heart', platform: 'android', data: ['steps', 'weight', 'workouts', 'sleep', 'heartRate'] },
  { id: 'garmin', name: 'Garmin Connect', icon: 'watch', data: ['steps', 'workouts', 'sleep', 'heartRate', 'weight'] },
  { id: 'fitbit', name: 'Fitbit', icon: 'watch', data: ['steps', 'workouts', 'sleep', 'heartRate', 'weight'] },
  { id: 'whoop', name: 'Whoop', icon: 'bolt', data: ['workouts', 'sleep', 'heartRate'] },
  { id: 'strava', name: 'Strava', icon: 'running', data: ['workouts'] },
];

const DATA_META: Record<IntegrationData, { label: string; icon: IconName; use: string }> = {
  steps: { label: 'Passi', icon: 'footsteps', use: 'calcolo del dispendio giornaliero' },
  weight: { label: 'Peso', icon: 'scale', use: 'andamento e check-in mensile' },
  workouts: { label: 'Allenamenti', icon: 'barbell', use: 'calorie bruciate e progressi' },
  sleep: { label: 'Sonno', icon: 'moon', use: 'recupero' },
  heartRate: { label: 'Frequenza cardiaca', icon: 'heart', use: 'intensità degli allenamenti' },
};

const PLATFORM_NAME = { ios: 'iPhone', android: 'Android' } as const;

/** "Dispositivi e app salute" in Profilo: lets the person choose which health apps / wearables to connect and which data each may share. */
export function IntegrationsSection() {
  const theme = useTheme();
  const linked = useIntegrationsStore((s) => s.linked);
  const [openId, setOpenId] = useState<IntegrationId | null>(null);
  const open = PROVIDERS.find((p) => p.id === openId) ?? null;

  return (
    <View style={{ gap: Spacing.two }}>
      <View style={styles.sectionTitleRow}>
        <ThemedText type="subtitle">Dispositivi e app salute</ThemedText>
      </View>
      <ThemedText type="caption" themeColor="textSecondary">
        Collega smartwatch e app salute: passi, peso, allenamenti e sonno entrano in FITLAB senza doverli registrare a mano.
      </ThemedText>
      <GlassSurface level="card" radius={Radius.large} style={styles.list}>
        {PROVIDERS.map((provider, i) => {
          const link = linked[provider.id];
          const unavailable = provider.platform != null && Platform.OS !== provider.platform;
          return (
            <Pressable
              key={provider.id}
              onPress={() => setOpenId(provider.id)}
              disabled={unavailable}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, unavailable && { opacity: 0.5 }]}>
              <View style={[styles.rowIcon, { backgroundColor: link ? theme.accentSoft : theme.backgroundElement }]}>
                <Icon name={provider.icon} size={18} color={link ? theme.accent : theme.textSecondary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText type="smallBold">{provider.name}</ThemedText>
                <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1}>
                  {unavailable
                    ? `Disponibile su ${PLATFORM_NAME[provider.platform!]}`
                    : link
                      ? link.data.map((d) => DATA_META[d].label).join(' · ')
                      : provider.data.map((d) => DATA_META[d].label).join(' · ')}
                </ThemedText>
              </View>
              {unavailable ? null : link ? (
                <View style={[styles.pill, { backgroundColor: theme.successSoft }]}>
                  <Icon name="check" size={13} color={theme.success} />
                  <ThemedText type="caption" style={{ color: theme.success, fontWeight: '700' }}>
                    Attivo
                  </ThemedText>
                </View>
              ) : (
                <View style={[styles.pill, { backgroundColor: theme.accent }]}>
                  <ThemedText type="caption" style={{ color: theme.onAccent, fontWeight: '700' }}>
                    Collega
                  </ThemedText>
                </View>
              )}
            </Pressable>
          );
        })}
      </GlassSurface>

      <ConnectPopup provider={open} onClose={() => setOpenId(null)} />
    </View>
  );
}

function ConnectPopup({ provider, onClose }: { provider: Provider | null; onClose: () => void }) {
  const theme = useTheme();
  const link = useIntegrationsStore((s) => (provider ? s.linked[provider.id] : undefined));
  const linkProvider = useIntegrationsStore((s) => s.link);
  const unlinkProvider = useIntegrationsStore((s) => s.unlink);
  const [chosen, setChosen] = useState<IntegrationData[] | null>(null);
  const selected = chosen ?? link?.data ?? provider?.data ?? [];

  const close = () => {
    setChosen(null);
    onClose();
  };
  const toggle = (d: IntegrationData) => setChosen(selected.includes(d) ? selected.filter((x) => x !== d) : [...selected, d]);

  return (
    <GlassPopup visible={provider != null} onClose={close} style={{ gap: Spacing.three }}>
      {provider ? (
        <>
          <View style={styles.popupHeader}>
            <View style={[styles.popupIcon, { backgroundColor: theme.accentSoft }]}>
              <Icon name={provider.icon} size={22} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="subtitle">{provider.name}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {link ? 'Collegamento attivo' : 'Scegli cosa condividere con FITLAB'}
              </ThemedText>
            </View>
          </View>

          <View style={{ gap: Spacing.two }}>
            {provider.data.map((d) => {
              const on = selected.includes(d);
              return (
                <Pressable key={d} onPress={() => toggle(d)} style={[styles.dataRow, { backgroundColor: theme.backgroundElement }]}>
                  <Icon name={DATA_META[d].icon} size={18} color={on ? theme.accent : theme.textTertiary} />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="smallBold">{DATA_META[d].label}</ThemedText>
                    <ThemedText type="caption" themeColor="textTertiary">
                      Per {DATA_META[d].use}
                    </ThemedText>
                  </View>
                  <Icon name={on ? 'checkCircle' : 'addCircle'} size={22} color={on ? theme.accent : theme.textTertiary} />
                </Pressable>
              );
            })}
          </View>

          <ThemedText type="caption" themeColor="textTertiary">
            La sincronizzazione automatica con {provider.name} arriva con l’app nativa: il consenso che dai ora resta salvato e puoi revocarlo quando vuoi.
          </ThemedText>

          <PrimaryButton
            label={link ? 'Aggiorna dati condivisi' : 'Collega'}
            icon="link"
            disabled={selected.length === 0}
            onPress={() => {
              linkProvider(provider.id, selected);
              close();
            }}
          />
          {link ? (
            <Pressable
              onPress={() => {
                unlinkProvider(provider.id);
                close();
              }}
              hitSlop={8}>
              <ThemedText type="caption" style={{ color: theme.danger, textAlign: 'center' }}>
                Scollega {provider.name}
              </ThemedText>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </GlassPopup>
  );
}

const styles = StyleSheet.create({
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  list: {
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  popupIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
});
