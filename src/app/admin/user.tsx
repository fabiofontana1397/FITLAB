import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Radius, Spacing } from '@/constants/theme';
import { useAdminGuard } from '@/hooks/use-admin-guard';
import { useTheme } from '@/hooks/use-theme';
import { fetchAdminUserDetail, type AdminUserDetail } from '@/lib/api/admin';
import { mealTimeline, PROFILE_GROUPS, summaryRows } from '@/lib/questionnaire/profile-sections';

type Tab = 'profile' | 'diet' | 'training' | 'progress' | 'history';
const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profilo e questionario' },
  { id: 'diet', label: 'Dieta' },
  { id: 'training', label: 'Allenamento' },
  { id: 'progress', label: 'Peso e check-in' },
  { id: 'history', label: 'Storico piani' },
];

const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/** Admin panel, one user: everything the app stores about them, read-only. */
export default function AdminUserScreen() {
  const theme = useTheme();
  const guard = useAdminGuard();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('profile');

  useEffect(() => {
    if (guard !== 'allowed' || !id) return;
    fetchAdminUserDetail(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : 'Impossibile caricare l’utente'));
  }, [guard, id]);

  if (guard === 'checking') return null;
  if (guard === 'denied') return <Redirect href="/" />;

  const profile = detail?.profile as { name?: string } | null | undefined;

  return (
    <ScreenScroll>
      <Pressable onPress={() => router.replace('/admin' as never)} hitSlop={8} accessibilityRole="button">
        <ThemedText type="small" style={{ color: theme.accent, fontWeight: '700' }}>
          ‹ Tutti gli utenti
        </ThemedText>
      </Pressable>

      <View style={{ gap: 2 }}>
        <ThemedText type="title">{profile?.name?.trim() || detail?.user?.email || 'Utente'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {detail?.user ? `${detail.user.email ?? ''} · iscritto il ${day(detail.user.created_at)} · ultimo accesso ${day(detail.user.last_sign_in_at)}` : error ?? 'Caricamento…'}
        </ThemedText>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.tab, { backgroundColor: tab === t.id ? theme.accent : theme.backgroundElement }]}
            accessibilityRole="button">
            <ThemedText type="small" style={{ color: tab === t.id ? theme.onAccent : theme.text, fontWeight: '600' }}>
              {t.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {detail ? (
        <>
          {tab === 'profile' ? <ProfileTab detail={detail} /> : null}
          {tab === 'diet' ? <DietTab detail={detail} /> : null}
          {tab === 'training' ? <TrainingTab detail={detail} /> : null}
          {tab === 'progress' ? <ProgressTab detail={detail} /> : null}
          {tab === 'history' ? <HistoryTab detail={detail} /> : null}
        </>
      ) : null}
    </ScreenScroll>
  );
}

// ------------------------------------------------------------------ pieces --
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: Spacing.two }}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {children}
    </View>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={{ flex: 1.4, textAlign: 'right' }}>
        {value}
      </ThemedText>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <ThemedText themeColor="textSecondary">{text}</ThemedText>;
}

function RawJson({ value }: { value: unknown }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: Spacing.two }}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button">
        <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '700' }}>
          {open ? 'Nascondi JSON grezzo' : 'Mostra JSON grezzo'}
        </ThemedText>
      </Pressable>
      {open ? (
        <View style={[styles.raw, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="code" selectable>
            {JSON.stringify(value, null, 2)}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

// ----------------------------------------------------------------- profile --
function ProfileTab({ detail }: { detail: AdminUserDetail }) {
  const answers = detail.answers?.answers ?? {};
  const timeline = mealTimeline(answers);
  const p = detail.profile as Record<string, unknown> | null;
  return (
    <View style={{ gap: Spacing.five }}>
      <Section title="Profilo">
        {p ? (
          <FlatCard style={styles.card}>
            <KV label="Obiettivo" value={String(p.goal ?? '—')} />
            <KV label="Sesso" value={String(p.sex ?? '—')} />
            <KV label="Altezza" value={`${p.height_cm} cm`} />
            <KV label="Peso obiettivo" value={`${p.target_weight_kg} kg`} />
            <KV label="Target giornaliero" value={`${p.daily_calorie_target} kcal · P ${p.protein_g} · C ${p.carbs_g} · G ${p.fats_g}`} />
          </FlatCard>
        ) : (
          <Empty text="Nessun profilo." />
        )}
      </Section>

      {detail.answers ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Questionario v{detail.answers.questionnaire_version}, aggiornato il {day(detail.answers.updated_at)}
          </ThemedText>
          {timeline.length > 0 ? (
            <Section title="Pasti e orari">
              <FlatCard style={styles.card}>
                {timeline.map((m) => (
                  <KV key={m.id} label={m.label} value={m.time ?? '—'} />
                ))}
              </FlatCard>
            </Section>
          ) : null}
          {PROFILE_GROUPS.filter((g) => g.id !== 'meals').map((g) => {
            const rows = summaryRows(g, answers);
            if (rows.length === 0) return null;
            return (
              <Section key={g.id} title={g.title}>
                <FlatCard style={styles.card}>
                  {rows.map((r) =>
                    r.kind === 'chips' ? (
                      <KV key={r.id} label={r.label} value={r.values.length ? r.values.join(', ') : '—'} />
                    ) : (
                      <KV key={r.id} label={r.label} value={r.value ?? '—'} />
                    )
                  )}
                </FlatCard>
              </Section>
            );
          })}
          <RawJson value={answers} />
        </>
      ) : (
        <Empty text="Questionario non compilato." />
      )}
    </View>
  );
}

// -------------------------------------------------------------------- diet --
function MonthPills({ count, value, onChange }: { count: number; value: number; onChange: (i: number) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.tabs}>
      {Array.from({ length: count }, (_, i) => (
        <Pressable key={i} onPress={() => onChange(i)} style={[styles.tab, { backgroundColor: value === i ? theme.accent : theme.backgroundElement }]}>
          <ThemedText type="small" style={{ color: value === i ? theme.onAccent : theme.text, fontWeight: '600' }}>
            Mese {i + 1}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function DietTab({ detail }: { detail: AdminUserDetail }) {
  const [month, setMonth] = useState(0);
  const plan = detail.diet_plan;
  if (!plan) return <Empty text="Nessun piano alimentare." />;
  const m = plan.plan[month];
  return (
    <View style={{ gap: Spacing.four }}>
      <ThemedText type="small" themeColor="textSecondary">
        Generato il {day(plan.generated_at)} · {plan.duration_months} mesi · obiettivo {plan.goal}
      </ThemedText>
      <MonthPills count={plan.plan.length} value={month} onChange={setMonth} />
      {m ? (
        <>
          <ThemedText type="smallBold">
            {m.title} · {m.calorieTarget} kcal · P {m.macroTargetsG.protein} · C {m.macroTargetsG.carbs} · G {m.macroTargetsG.fats}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {m.focusNote}
          </ThemedText>
          {m.weeklySplit.map((d) => (
            <FlatCard key={d.weekday} style={styles.card}>
              <ThemedText type="smallBold">
                {d.weekday}
                {d.isTrainingDay ? ' · giorno di allenamento' : ''}
                {d.calorieTarget ? ` · target ${d.calorieTarget} kcal` : ''}
              </ThemedText>
              {d.meals.map((meal) => (
                <View key={meal.slotId} style={{ gap: 2, marginTop: Spacing.two }}>
                  <ThemedText type="small" style={{ fontWeight: '700' }}>
                    {meal.label} {meal.time} · {Math.round(meal.totalKcal)} kcal
                    {meal.macros ? ` (P ${Math.round(meal.macros.protein)} · C ${Math.round(meal.macros.carbs)} · G ${Math.round(meal.macros.fats)})` : ''}
                  </ThemedText>
                  {meal.isFreeMeal ? (
                    <ThemedText type="caption" themeColor="textSecondary">
                      Pasto libero
                    </ThemedText>
                  ) : (
                    <>
                      {meal.recipe ? (
                        <ThemedText type="caption" themeColor="textSecondary">
                          {meal.recipe.name}
                          {meal.recipe.flavorings.length ? ` — ${meal.recipe.flavorings.join(', ')}` : ''}
                        </ThemedText>
                      ) : null}
                      <ThemedText type="caption">{meal.items.map((i) => `${i.name} ${i.quantityLabel}`).join(' · ')}</ThemedText>
                    </>
                  )}
                </View>
              ))}
            </FlatCard>
          ))}
        </>
      ) : null}
      <RawJson value={plan} />
    </View>
  );
}

// ---------------------------------------------------------------- training --
function TrainingTab({ detail }: { detail: AdminUserDetail }) {
  const [month, setMonth] = useState(0);
  const plan = detail.training_plan;
  if (!plan) return <Empty text="Nessun piano di allenamento." />;
  const m = plan.plan[month];
  return (
    <View style={{ gap: Spacing.four }}>
      <ThemedText type="small" themeColor="textSecondary">
        Generato il {day(plan.generated_at)} · {plan.duration_months} mesi
      </ThemedText>
      <MonthPills count={plan.plan.length} value={month} onChange={setMonth} />
      {m ? (
        <>
          <ThemedText type="smallBold">{m.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {m.focusNote}
          </ThemedText>
          {m.weeklySplit.map((d) => (
            <FlatCard key={d.weekday} style={styles.card}>
              <ThemedText type="smallBold">
                {d.weekday} · {d.title}
              </ThemedText>
              {d.note ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  {d.note}
                </ThemedText>
              ) : null}
              {(d.exercises ?? []).map((e) => (
                <ThemedText key={e.id} type="caption">
                  {e.name} — {e.sets}×{e.reps} · rec {e.restSec}s{e.suggestedKg != null ? ` · ${e.suggestedKg} kg` : ''}
                  {e.needsManualReview ? ' · da rivedere' : ''}
                </ThemedText>
              ))}
            </FlatCard>
          ))}
        </>
      ) : null}
      <RawJson value={plan} />
    </View>
  );
}

// ---------------------------------------------------------------- progress --
function ProgressTab({ detail }: { detail: AdminUserDetail }) {
  const weights = useMemo(() => detail.body_metrics.filter((b) => b.weight_kg != null), [detail.body_metrics]);
  return (
    <View style={{ gap: Spacing.five }}>
      <Section title="Peso">
        {weights.length === 0 ? (
          <Empty text="Nessuna pesata." />
        ) : (
          <FlatCard style={styles.card}>
            {weights.map((w) => (
              <KV key={w.date} label={day(w.date)} value={`${w.weight_kg} kg${w.body_fat_pct != null ? ` · ${w.body_fat_pct}% grasso` : ''}`} />
            ))}
          </FlatCard>
        )}
      </Section>
      <Section title="Check-in mensili">
        {detail.checkins.length === 0 ? (
          <Empty text="Nessun check-in." />
        ) : (
          detail.checkins.map((c) => (
            <FlatCard key={c.month_index} style={styles.card}>
              <ThemedText type="smallBold">
                Mese {c.month_index} · {day(c.created_at)}
                {c.weight_trend_kg != null ? ` · trend ${c.weight_trend_kg} kg` : ''}
              </ThemedText>
              {Object.entries(c.answers).map(([k, v]) => (
                <KV key={k} label={k} value={String(v)} />
              ))}
            </FlatCard>
          ))
        )}
      </Section>
      <Section title="Attività registrate (ultime 60)">
        {detail.activity.length === 0 ? (
          <Empty text="Nessuna attività." />
        ) : (
          <FlatCard style={styles.card}>
            {detail.activity.map((a, i) => (
              <KV key={i} label={day(a.date)} value={`${a.activity_type} · ${a.duration_minutes} min · ${a.intensity} · ${a.estimated_kcal} kcal`} />
            ))}
          </FlatCard>
        )}
      </Section>
    </View>
  );
}

// ----------------------------------------------------------------- history --
function HistoryTab({ detail }: { detail: AdminUserDetail }) {
  return (
    <View style={{ gap: Spacing.five }}>
      <Section title="Versioni dei piani">
        {detail.plan_versions.length === 0 ? (
          <Empty text="Nessuna versione registrata." />
        ) : (
          <FlatCard style={styles.card}>
            {detail.plan_versions.map((v, i) => (
              <KV key={i} label={`${v.plan_type} v${v.version} · ${day(v.created_at)}`} value={`${v.trigger} · ${v.status}${v.algorithm_version ? ` · ${v.algorithm_version}` : ''}`} />
            ))}
          </FlatCard>
        )}
      </Section>
      <Section title="Target nutrizionali nel tempo">
        {detail.target_history.length === 0 ? (
          <Empty text="Nessuna variazione registrata." />
        ) : (
          <FlatCard style={styles.card}>
            {detail.target_history.map((t, i) => (
              <KV key={i} label={`${day(t.effective_date)} · ${t.source}`} value={`${t.calories} kcal · P ${t.protein_g} · C ${t.carbs_g} · G ${t.fats_g}`} />
            ))}
          </FlatCard>
        )}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill },
  card: { padding: Spacing.three, gap: 6 },
  kv: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  raw: { padding: Spacing.three, borderRadius: Radius.medium },
});
