import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DietMonthsView, TrainingMonthsView } from '@/components/admin/plan-views';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Radius, Spacing } from '@/constants/theme';
import { useAdminGuard } from '@/hooks/use-admin-guard';
import { useTheme } from '@/hooks/use-theme';
import { fetchAdminUserDetail, fetchAdminUsers, type AdminUserDetail, type AdminUserRow } from '@/lib/api/admin';
import { dietStats, generateFromAnswers, trainingStats, type Answers } from '@/lib/admin/lab';
import type { DietMonthPlan, TrainingMonthPlan } from '@/lib/planning/types';
import { PERSONAS } from '../../../scripts/agent-tests/personas';

type Source = {
  label: string;
  note: string;
  answers: Answers;
  /** What the account has stored today (real users only), to compare with the fresh plans. */
  saved?: { diet: DietMonthPlan[] | null; training: TrainingMonthPlan[] | null };
};

type View_ = 'new' | 'saved';
type Kind = 'diet' | 'training';

/** Admin test lab: regenerate the plans of a test persona or a real account with the engine running now. */
export default function AdminLabScreen() {
  const theme = useTheme();
  const guard = useAdminGuard();
  const [source, setSource] = useState<Source | null>(null);
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>('diet');
  const [view, setView] = useState<View_>('new');

  const result = useMemo(() => {
    if (!source) return null;
    try {
      return { bundle: generateFromAnswers(source.answers), error: null as string | null };
    } catch (e) {
      return { bundle: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [source]);

  if (guard === 'checking') return null;
  if (guard === 'denied') return <Redirect href="/" />;

  const pickPersona = (id: string) => {
    const p = PERSONAS.find((x) => x.id === id)!;
    setError(null);
    setView('new');
    setSource({ label: p.name, note: `${p.summary}. Atteso: ${p.expectation}`, answers: p.answers });
  };

  const loadUsers = () => {
    fetchAdminUsers()
      .then((r) => setUsers(r.filter((u) => u.has_answers)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Impossibile caricare gli utenti'));
  };

  const pickUser = (u: AdminUserRow) => {
    setLoadingUser(true);
    setError(null);
    fetchAdminUserDetail(u.user_id)
      .then((d: AdminUserDetail) => {
        if (!d.answers) throw new Error('Questo utente non ha risposte al questionario.');
        setView('new');
        setSource({
          label: u.name?.trim() || u.email || 'Utente',
          note: 'Risposte reali di questo account, rigenerate con il motore attuale.',
          answers: d.answers.answers,
          saved: { diet: d.diet_plan?.plan ?? null, training: d.training_plan?.plan ?? null },
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Impossibile caricare l’utente'))
      .finally(() => setLoadingUser(false));
  };

  const bundle = result?.bundle ?? null;
  const dietMonths = bundle?.diet?.months ?? null;
  const trainingMonths = bundle?.training?.months ?? null;
  const savedDiet = source?.saved?.diet ?? null;
  const savedTraining = source?.saved?.training ?? null;
  const shownDiet = view === 'saved' ? savedDiet : dietMonths;
  const shownTraining = view === 'saved' ? savedTraining : trainingMonths;

  return (
    <ScreenScroll>
      <Pressable onPress={() => router.replace('/admin' as never)} hitSlop={8} accessibilityRole="button">
        <ThemedText type="small" style={{ color: theme.accent, fontWeight: '700' }}>
          ‹ Tutti gli utenti
        </ThemedText>
      </Pressable>

      <View style={{ gap: 2 }}>
        <ThemedText type="caption" themeColor="textTertiary" style={styles.eyebrow}>
          ADMIN · LABORATORIO DI TEST
        </ThemedText>
        <ThemedText type="title">Genera e confronta</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Rigenera dieta e allenamento con il motore attuale. Non scrive nulla sul database e non usa crediti AI.
        </ThemedText>
      </View>

      <View style={{ gap: Spacing.two }}>
        <ThemedText type="subtitle">Persone di prova</ThemedText>
        <View style={styles.pills}>
          {PERSONAS.map((p) => (
            <Chip key={p.id} label={p.name} active={source?.label === p.name} onPress={() => pickPersona(p.id)} />
          ))}
        </View>
      </View>

      <View style={{ gap: Spacing.two }}>
        <ThemedText type="subtitle">Account reali</ThemedText>
        {users === null ? (
          <Chip label="Mostra gli account con questionario" active={false} onPress={loadUsers} />
        ) : users.length === 0 ? (
          <ThemedText themeColor="textSecondary">Nessun account ha compilato il questionario.</ThemedText>
        ) : (
          <View style={styles.pills}>
            {users.map((u) => (
              <Chip key={u.user_id} label={u.name?.trim() || u.email || 'Utente'} active={source?.label === (u.name?.trim() || u.email)} onPress={() => pickUser(u)} />
            ))}
          </View>
        )}
        {loadingUser ? <ThemedText themeColor="textSecondary">Caricamento…</ThemedText> : null}
      </View>

      {error ? <ThemedText style={{ color: theme.danger }}>{error}</ThemedText> : null}

      {source ? (
        <View style={{ gap: Spacing.four }}>
          <View style={{ gap: 2 }}>
            <ThemedText type="subtitle">{source.label}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {source.note}
            </ThemedText>
          </View>

          {result?.error ? <ThemedText style={{ color: theme.danger }}>Generazione fallita: {result.error}</ThemedText> : null}

          {bundle ? (
            <>
              <ThemedText type="caption" themeColor="textTertiary">
                Piano di {bundle.durationMonths} mesi generato adesso
              </ThemedText>

              {dietMonths ? <StatsTable title="Dieta" fresh={dietStats(dietMonths)} saved={savedDiet ? dietStats(savedDiet) : null} /> : null}
              {trainingMonths ? <TrainingStatsTable fresh={trainingStats(trainingMonths)} saved={savedTraining ? trainingStats(savedTraining) : null} /> : null}

              <View style={styles.pills}>
                <Chip label="Dieta" active={kind === 'diet'} onPress={() => setKind('diet')} />
                <Chip label="Allenamento" active={kind === 'training'} onPress={() => setKind('training')} />
                {source.saved ? <View style={{ width: Spacing.three }} /> : null}
                {source.saved ? <Chip label="Piano nuovo" active={view === 'new'} onPress={() => setView('new')} /> : null}
                {source.saved ? <Chip label="Piano salvato" active={view === 'saved'} onPress={() => setView('saved')} /> : null}
              </View>

              {kind === 'diet' ? (
                shownDiet ? (
                  <DietMonthsView key={`d-${view}-${source.label}`} months={shownDiet} />
                ) : (
                  <ThemedText themeColor="textSecondary">Nessun piano alimentare.</ThemedText>
                )
              ) : shownTraining ? (
                <TrainingMonthsView key={`t-${view}-${source.label}`} months={shownTraining} />
              ) : (
                <ThemedText themeColor="textSecondary">Nessun piano di allenamento.</ThemedText>
              )}
            </>
          ) : null}
        </View>
      ) : null}
    </ScreenScroll>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.pill, { backgroundColor: active ? theme.accent : theme.backgroundElement }]} accessibilityRole="button">
      <ThemedText type="small" style={{ color: active ? theme.onAccent : theme.text, fontWeight: '600' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

type Row = { label: string; fresh: string; saved: string | null };

function Compare({ title, rows, hasSaved }: { title: string; rows: Row[]; hasSaved: boolean }) {
  return (
    <FlatCard style={styles.card}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <View style={styles.tableRow}>
        <ThemedText type="caption" themeColor="textTertiary" style={{ flex: 1.4 }}>
          Mese
        </ThemedText>
        <ThemedText type="caption" themeColor="textTertiary" style={{ flex: 2 }}>
          Nuovo
        </ThemedText>
        {hasSaved ? (
          <ThemedText type="caption" themeColor="textTertiary" style={{ flex: 2 }}>
            Salvato
          </ThemedText>
        ) : null}
      </View>
      {rows.map((r) => (
        <View key={r.label} style={styles.tableRow}>
          <ThemedText type="small" style={{ flex: 1.4 }}>
            {r.label}
          </ThemedText>
          <ThemedText type="small" style={{ flex: 2 }}>
            {r.fresh}
          </ThemedText>
          {hasSaved ? (
            <ThemedText type="small" themeColor="textSecondary" style={{ flex: 2 }}>
              {r.saved ?? '—'}
            </ThemedText>
          ) : null}
        </View>
      ))}
    </FlatCard>
  );
}

function StatsTable({ title, fresh, saved }: { title: string; fresh: ReturnType<typeof dietStats>; saved: ReturnType<typeof dietStats> | null }) {
  const fmt = (s: ReturnType<typeof dietStats>[number] | undefined) =>
    s ? `${s.kcalAvg}/${s.kcalTarget} kcal · scarto max ${s.worstDayGapPct}% · P ${s.proteinPct ?? '—'}% · ripetizioni ${s.maxRepeat} · ${s.distinctDishes} piatti` : null;
  return <Compare title={`${title}: consegnato / target, scarto peggiore del giorno, proteine, ripetizioni nella settimana`} hasSaved={saved !== null} rows={fresh.map((s, i) => ({ label: `Mese ${s.month}`, fresh: fmt(s)!, saved: fmt(saved?.[i]) }))} />;
}

function TrainingStatsTable({ fresh, saved }: { fresh: ReturnType<typeof trainingStats>; saved: ReturnType<typeof trainingStats> | null }) {
  const fmt = (s: ReturnType<typeof trainingStats>[number] | undefined) => (s ? `${s.sessions} sedute · ${s.exercises} esercizi${s.reviewFlags ? ` · ${s.reviewFlags} da rivedere` : ''}` : null);
  return <Compare title="Allenamento: sedute e esercizi a settimana" hasSaved={saved !== null} rows={fresh.map((s, i) => ({ label: `Mese ${s.month}`, fresh: fmt(s)!, saved: fmt(saved?.[i]) }))} />;
}

const styles = StyleSheet.create({
  eyebrow: { letterSpacing: 0.8, fontWeight: '700' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill },
  card: { padding: Spacing.three, gap: 6 },
  tableRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
});
