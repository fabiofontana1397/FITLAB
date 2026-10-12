import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScreenScroll } from '@/components/screen-scroll';
import { AppTextInput } from '@/components/ui/app-text';
import { FlatCard } from '@/components/ui/flat-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useAdminGuard } from '@/hooks/use-admin-guard';
import { useTheme } from '@/hooks/use-theme';
import { fetchAdminUsers, type AdminUserRow } from '@/lib/api/admin';

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');

/** Admin panel, user list: who signed up, whether they finished the questionnaire, and whether their plans exist. */
export default function AdminUsersScreen() {
  const theme = useTheme();
  const guard = useAdminGuard();
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    fetchAdminUsers()
      .then((r) => {
        setError(null);
        setRows(r);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Impossibile caricare gli utenti'));
  }, []);

  useEffect(() => {
    if (guard === 'allowed') load();
  }, [guard, load]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    if (!rows) return [];
    return q ? rows.filter((r) => normalize(`${r.name ?? ''} ${r.email ?? ''}`).includes(q)) : rows;
  }, [rows, query]);

  if (guard === 'checking') return null;
  if (guard === 'denied') {
    return (
      <ScreenScroll>
        <ThemedText type="title">Area riservata</ThemedText>
        <ThemedText themeColor="textSecondary">Questo account non è abilitato al pannello admin.</ThemedText>
        <PrimaryButton label="Torna all'app" variant="outline" onPress={() => router.replace('/')} />
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText type="caption" themeColor="textTertiary" style={styles.eyebrow}>
            ADMIN · SOLA LETTURA
          </ThemedText>
          <ThemedText type="title">Utenti</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {rows ? `${rows.length} account` : 'Caricamento…'}
          </ThemedText>
        </View>
        <PrimaryButton label="Aggiorna" icon="refresh" variant="outline" dense onPress={load} />
      </View>

      <AppTextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Cerca per nome o email"
        placeholderTextColor={theme.textTertiary}
        style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
      />

      {error ? (
        <ThemedText style={{ color: theme.danger }}>
          {error.includes('not authorized') ? 'Account non abilitato.' : error} Se hai appena aggiunto la migrazione 0020, lanciala con `npx supabase db push`.
        </ThemedText>
      ) : null}

      <View style={{ gap: Spacing.two }}>
        {visible.map((r) => (
          <Pressable key={r.user_id} onPress={() => router.push({ pathname: '/admin/user' as never, params: { id: r.user_id } })} accessibilityRole="button">
            <FlatCard radius={Radius.medium} style={styles.row}>
              <View style={{ flex: 1.4, minWidth: 160 }}>
                <ThemedText type="smallBold">{r.name?.trim() || 'Senza nome'}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {r.email ?? '—'}
                </ThemedText>
              </View>
              <Cell label="Iscritto" value={day(r.created_at)} />
              <Cell label="Ultimo accesso" value={day(r.last_sign_in_at)} />
              <Cell label="Questionario" value={r.has_answers ? `v${r.questionnaire_version}` : 'non fatto'} warn={!r.has_answers} />
              <Cell label="Dieta" value={r.diet_months ? `${r.diet_months} mesi` : 'assente'} warn={!r.diet_months} />
              <Cell label="Allenamento" value={r.training_months ? `${r.training_months} mesi` : 'assente'} warn={!r.training_months} />
              <Cell label="Peso" value={r.latest_weight_kg != null ? `${r.latest_weight_kg} kg · ${r.weigh_ins}` : '—'} />
              <Cell label="Check-in" value={String(r.checkins)} />
            </FlatCard>
          </Pressable>
        ))}
        {rows && visible.length === 0 ? <ThemedText themeColor="textSecondary">Nessun utente trovato.</ThemedText> : null}
      </View>
    </ScreenScroll>
  );
}

function Cell({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 90 }}>
      <ThemedText type="caption" themeColor="textTertiary">
        {label}
      </ThemedText>
      <ThemedText type="small" style={warn ? { color: theme.textTertiary } : undefined}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.three },
  eyebrow: { letterSpacing: 0.8, fontWeight: '700' },
  search: { borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: 10, fontSize: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
});
