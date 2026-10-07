import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BodySilhouette, type MeasurementZone } from '@/components/body/body-silhouette';
import { MeasurementInfoModal } from '@/components/body/measurement-info-modal';
import { MeasurementTrendModal } from '@/components/body/measurement-trend-modal';
import { PhotoDetailModal } from '@/components/body/photo-detail-modal';
import { PosePickerSheet } from '@/components/body/pose-picker-sheet';
import { QuickMeasurementSheet } from '@/components/body/quick-measurement-sheet';
import { WeightEntryModal } from '@/components/body/weight-entry-modal';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { GoalTrendChart } from '@/components/ui/goal-trend-chart';
import { Icon } from '@/components/ui/icon';
import { InsightCard } from '@/components/ui/insight-card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TrendChart } from '@/components/ui/trend-chart';
import { useTheme } from '@/hooks/use-theme';
import { useWeightSeries, weightDateGranularity, type WeightRange } from '@/hooks/use-weight-series';
import { generatePhotoInsight } from '@/lib/assistant/photo-insight';
import { latestSnapshot, seriesOf } from '@/lib/mock/body';
import { addDaysISO, daysAgoISO, formatFullDay } from '@/lib/mock/dates';
import { POSE_LABELS, useBodyStore, type BodyPhoto, type BodyPhotoPose } from '@/store/body-store';
import { useUserStore } from '@/store/user-store';

const SCREEN_PADDING = 20;
const CARD_RADIUS = 20;

// Top to bottom, roughly following the body itself.
const MEASUREMENTS: { zone: MeasurementZone; label: string }[] = [
  { zone: 'shouldersCm', label: 'Spalle' },
  { zone: 'chestCm', label: 'Petto' },
  { zone: 'bicepsCm', label: 'Bicipite' },
  { zone: 'waistCm', label: 'Vita' },
  { zone: 'hipsCm', label: 'Fianchi' },
  { zone: 'thighCm', label: 'Coscia' },
];

/** "-0,8" — Italian decimal comma, explicit sign. */
function signedKg(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (rounded === 0) return '0,0';
  return `${rounded < 0 ? '-' : '+'}${Math.abs(rounded).toFixed(1).replace('.', ',')}`;
}

/** Progressi, as in the Figma: weight card (change vs last week, quick add,
 * range switch, trend chart), goal card, body measurements and progress
 * photos. It replaces the old separate "Corpo" tab. */
export default function ProgressScreen() {
  const theme = useTheme();
  const currentUser = useUserStore();
  const entries = useBodyStore((s) => s.entries);
  const photos = useBodyStore((s) => s.photos);
  const addWeightEntry = useBodyStore((s) => s.addWeightEntry);
  const addMeasurement = useBodyStore((s) => s.addMeasurement);
  const addPhoto = useBodyStore((s) => s.addPhoto);

  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [editDate, setEditDate] = useState<string | undefined>(undefined);
  const [infoZone, setInfoZone] = useState<MeasurementZone | null>(null);
  const [trendMeasurement, setTrendMeasurement] = useState<{ zone: MeasurementZone; label: string } | null>(null);
  const [addMeasurementZone, setAddMeasurementZone] = useState<{ zone: MeasurementZone; label: string } | null>(null);
  const [posePickerOpen, setPosePickerOpen] = useState(false);
  const [detailPhoto, setDetailPhoto] = useState<BodyPhoto | null>(null);
  const [weightRange, setWeightRange] = useState<WeightRange>('settimana');
  const [tab, setTab] = useState<'peso' | 'misure' | 'foto'>('peso');
  const weightSeries = useWeightSeries(entries, weightRange);

  const latest = useMemo(() => latestSnapshot(entries), [entries]);
  const startBody = entries[0] ?? latest;
  const photoInsight = generatePhotoInsight(photos, entries);

  // Change against the last weigh-in at least a week old (falls back to the
  // very first entry).
  const weekAgo = addDaysISO(daysAgoISO(0), -7);
  const lastWeekBody = [...entries].reverse().find((e) => e.date <= weekAgo) ?? startBody;
  const weekDelta = latest.weightKg - lastWeekBody.weightKg;

  const sinceStart = latest.weightKg - startBody.weightKg;
  const totalToGo = startBody.weightKg - currentUser.targetWeightKg;
  const goalProgress = totalToGo !== 0 ? Math.min(Math.max((startBody.weightKg - latest.weightKg) / totalToGo, 0), 1) : 0;

  // Down is "good" green only when the goal is to lose weight.
  const wantsLoss = currentUser.targetWeightKg < startBody.weightKg;
  const deltaColor = (delta: number) => (delta === 0 ? theme.textTertiary : (delta < 0) === wantsLoss ? theme.brandGreen : theme.danger);

  // Every photo taken on the same day grouped into its own box, most recent
  // session first.
  const photosByDay = useMemo(() => {
    const map = new Map<string, BodyPhoto[]>();
    for (const p of photos) map.set(p.date, [...(map.get(p.date) ?? []), p]);
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [photos]);

  const pickPhoto = async (pose: BodyPhotoPose) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) addPhoto(result.assets[0].uri, pose);
  };

  return (
    <ScreenScroll contentContainerStyle={styles.page}>
      <View style={styles.headerRow}>
        <ThemedText style={styles.pageTitle}>Progressi</ThemedText>
        <Pressable onPress={() => router.push('/profile')} hitSlop={8} style={[styles.avatar, { backgroundColor: theme.text }]}>
          <Icon name="personFilled" size={22} color={theme.background} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <SegmentedControl
          options={[
            { value: 'peso', label: 'Peso' },
            { value: 'misure', label: 'Misure' },
            { value: 'foto', label: 'Foto' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as 'peso' | 'misure' | 'foto')}
        />
      </View>

      {tab === 'peso' ? (
        <>
      <FlatCard radius={CARD_RADIUS} style={styles.weightCard}>
        <View style={styles.weightTop}>
          <View>
            <View style={styles.bigRow}>
              <ThemedText style={styles.bigNumber}>{latest.weightKg.toFixed(1)}</ThemedText>
              <ThemedText style={styles.bigUnit} themeColor="textSecondary">
                kg
              </ThemedText>
            </View>
            <View style={styles.deltaRow}>
              <Icon name={weekDelta <= 0 ? 'trendDown' : 'trendUp'} size={14} color={deltaColor(weekDelta)} />
              <ThemedText style={[styles.deltaText, { color: deltaColor(weekDelta) }]}>{signedKg(weekDelta)} kg</ThemedText>
              <ThemedText style={styles.deltaText} themeColor="textTertiary">
                vs. settimana scorsa
              </ThemedText>
            </View>
          </View>
          <Pressable
            onPress={() => {
              setEditDate(undefined);
              setWeightModalOpen(true);
            }}
            accessibilityLabel="Registra peso"
            style={[styles.addWeight, { backgroundColor: theme.accent }]}>
            <Icon name="plus" size={20} color={theme.onAccent} />
          </Pressable>
        </View>

        <View style={styles.progressBlock}>
          <View style={[styles.goalTrack, { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.goalFill, { width: `${Math.round(goalProgress * 100)}%`, backgroundColor: theme.accent }]} />
          </View>
          <View style={styles.progressCaption}>
            <ThemedText style={styles.deltaText} themeColor="textTertiary">
              {startBody.weightKg.toFixed(1)} kg
            </ThemedText>
            <ThemedText style={[styles.deltaText, { color: theme.accent }]}>{Math.round(goalProgress * 100)}% verso l’obiettivo</ThemedText>
            <ThemedText style={styles.deltaText} themeColor="textTertiary">
              {currentUser.targetWeightKg} kg
            </ThemedText>
          </View>
        </View>

        <View style={styles.miniRow}>
          <View style={[styles.miniBox, { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.miniIcon, { backgroundColor: deltaColor(sinceStart) + '22' }]}>
              <Icon name={sinceStart <= 0 ? 'trendDown' : 'trendUp'} size={20} color={deltaColor(sinceStart)} />
            </View>
            <View>
              <ThemedText style={[styles.miniValue, { color: deltaColor(sinceStart) }]}>{signedKg(sinceStart)} kg</ThemedText>
              <ThemedText style={styles.miniLabel} themeColor="textTertiary">
                da inizio piano
              </ThemedText>
            </View>
          </View>
          <View style={[styles.miniBox, { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.miniIcon, { backgroundColor: theme.brandGreen + '22' }]}>
              <Icon name="target" size={20} color={theme.brandGreen} />
            </View>
            <View>
              <ThemedText style={styles.miniValue}>{currentUser.targetWeightKg} kg</ThemedText>
              <ThemedText style={styles.miniLabel} themeColor="textTertiary">
                obiettivo
              </ThemedText>
            </View>
          </View>
        </View>
      </FlatCard>

      <FlatCard radius={CARD_RADIUS} style={styles.chartCard}>
        <ThemedText style={styles.chartTitle}>Andamento peso</ThemedText>
        <SegmentedControl
          options={[
            { value: 'settimana', label: 'Settimana' },
            { value: 'mese', label: 'Mese' },
            { value: 'anno', label: 'Anno' },
          ]}
          value={weightRange}
          onChange={(v) => setWeightRange(v as WeightRange)}
        />
        <GoalTrendChart
          points={weightSeries}
          target={currentUser.targetWeightKg}
          dateGranularity={weightDateGranularity(weightRange)}
          height={200}
          color={theme.accent}
          targetColor={theme.brandGreen}
          axisColor={theme.textTertiary}
          gridColor={theme.backgroundElement}
        />
      </FlatCard>

      <View style={styles.logHeader}>
        <ThemedText style={styles.chartTitle}>Registrazioni</ThemedText>
        <Pressable
          onPress={() => {
            setEditDate(undefined);
            setWeightModalOpen(true);
          }}
          hitSlop={8}>
          <ThemedText style={[styles.logAdd, { color: theme.accent }]}>Aggiungi</ThemedText>
        </Pressable>
      </View>
      <FlatCard radius={CARD_RADIUS} style={styles.logCard}>
        {[...entries]
          .sort((x, y) => y.date.localeCompare(x.date))
          .slice(0, 8)
          .map((entry, i) => (
            <Pressable
              key={entry.date}
              onPress={() => {
                setEditDate(entry.date);
                setWeightModalOpen(true);
              }}
              style={[
                styles.logRow,
                i === 0 && { backgroundColor: theme.accentSoft },
                i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
              ]}>
              <View style={[styles.logDot, { backgroundColor: i === 0 ? theme.accent : theme.textTertiary }]} />
              <ThemedText style={styles.logDate} themeColor="textSecondary">
                {new Date(entry.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '')}
              </ThemedText>
              <ThemedText style={styles.logWeight}>{entry.weightKg.toFixed(1)} kg</ThemedText>
              <Icon name="chevronRight" size={16} color={theme.textTertiary} />
            </Pressable>
          ))}
        {entries.length === 0 ? (
          <ThemedText style={styles.hint} themeColor="textTertiary">
            Nessuna registrazione: tocca + per aggiungere il tuo peso.
          </ThemedText>
        ) : null}
      </FlatCard>

        </>
      ) : null}

      {tab === 'misure' ? (
      <View style={styles.measureList}>
        {MEASUREMENTS.map((m) => {
          // Entries logged before this zone existed (or never recorded) carry
          // no value for it — filter those out rather than let a missing
          // number reach the chart as NaN.
          const series = seriesOf(entries, m.zone).filter((v) => Number.isFinite(v));
          const latestValue = latest[m.zone];
          const hasValue = Number.isFinite(latestValue);
          // A single value has no line to draw — the sparkline (and the
          // "andamento" popup it opens) needs at least two measurements.
          const hasTrend = series.length >= 2;
          return (
            <FlatCard key={m.zone} radius={16} style={styles.measureRow}>
              <BodySilhouette zone={m.zone} color={theme.accent} outlineColor={theme.textTertiary} width={22} height={34} />
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText style={styles.measureLabel}>{m.label}</ThemedText>
                <ThemedText style={styles.measureValue}>{hasValue ? `${latestValue} cm` : 'Non ancora misurato'}</ThemedText>
              </View>
              {hasTrend ? (
                <Pressable onPress={() => setTrendMeasurement(m)} hitSlop={8}>
                  <TrendChart data={series} width={56} height={28} color={theme.accent} />
                </Pressable>
              ) : (
                <View style={{ width: 56, height: 28 }} />
              )}
              <Pressable onPress={() => setAddMeasurementZone(m)} hitSlop={8} style={[styles.roundButton, { backgroundColor: theme.accentSoft }]}>
                <Icon name="plus" size={16} color={theme.accent} />
              </Pressable>
              <Pressable onPress={() => setInfoZone(m.zone)} hitSlop={8} style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
                <Icon name="info" size={16} color={theme.textSecondary} />
              </Pressable>
            </FlatCard>
          );
        })}
      </View>

      ) : null}

      {tab === 'foto' ? (
        <>
      <View style={{ gap: 14 }}>
        <InsightCard
          icon="camera"
          tone="neutral"
          headline="Come scattare le foto"
          body={
            'Scegli un posto ben illuminato, con luce uniforme.\n' +
            'Scatta 6 foto a corpo intero: frontale, laterale destro, laterale sinistro e posteriore rilassato, poi frontale e posteriore flettendo i muscoli.\n' +
            'Sempre alla stessa ora — idealmente al mattino, a digiuno e dopo essere andato in bagno.\n' +
            'Ripeti l’intera sequenza una volta al mese.'
          }
        />

        <Pressable onPress={() => setPosePickerOpen(true)} style={[styles.addPhotoRow, { borderColor: theme.border }]}>
          <Icon name="camera" size={20} color={theme.accent} />
          <ThemedText style={[styles.addPhotoLabel, { color: theme.accent }]}>Aggiungi foto</ThemedText>
        </Pressable>

        {photosByDay.length === 0 ? (
          <ThemedText style={styles.hint} themeColor="textTertiary">
            Non hai ancora scattato foto di progresso.
          </ThemedText>
        ) : (
          photosByDay.map(([date, dayPhotos]) => (
            <FlatCard key={date} radius={CARD_RADIUS} style={styles.photoDayCard}>
              <ThemedText style={styles.measureLabel}>{formatFullDay(date)}</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {dayPhotos.map((photo) => (
                  <Pressable key={photo.id} onPress={() => setDetailPhoto(photo)}>
                    <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                    <ThemedText style={styles.photoThumbLabel} themeColor="textSecondary" numberOfLines={1}>
                      {POSE_LABELS[photo.pose] ?? 'Foto'}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </FlatCard>
          ))
        )}

        {photoInsight ? (
          <InsightCard icon="sparkle" tone="positive" headline="Cosa nota il coach AI" body={photoInsight} />
        ) : photos.length === 0 ? (
          <ThemedText style={styles.hint} themeColor="textTertiary">
            Aggiungi almeno 2 foto nel tempo per ricevere un confronto automatico dei tuoi progressi.
          </ThemedText>
        ) : null}
      </View>

        </>
      ) : null}

      <WeightEntryModal
        visible={weightModalOpen}
        initialWeightKg={(editDate ? entries.find((e) => e.date === editDate)?.weightKg : undefined) ?? latest.weightKg}
        date={editDate}
        markedDates={entries.map((e) => e.date)}
        onClose={() => setWeightModalOpen(false)}
        onSave={(weightKg, date) => addWeightEntry(weightKg, date)}
      />
      <MeasurementInfoModal zone={infoZone} onClose={() => setInfoZone(null)} />
      <MeasurementTrendModal
        zone={trendMeasurement?.zone ?? null}
        label={trendMeasurement?.label ?? ''}
        entries={entries}
        color={theme.accent}
        onClose={() => setTrendMeasurement(null)}
      />
      <QuickMeasurementSheet
        visible={addMeasurementZone != null}
        label={addMeasurementZone?.label ?? ''}
        currentValueCm={addMeasurementZone && Number.isFinite(latest[addMeasurementZone.zone]) ? Number(latest[addMeasurementZone.zone]) : 0}
        onClose={() => setAddMeasurementZone(null)}
        onSave={(valueCm) => {
          if (addMeasurementZone) addMeasurement({ [addMeasurementZone.zone]: valueCm });
        }}
      />
      <PosePickerSheet
        visible={posePickerOpen}
        onClose={() => setPosePickerOpen(false)}
        onSelect={(pose) => {
          setPosePickerOpen(false);
          pickPhoto(pose);
        }}
      />
      <PhotoDetailModal photo={detailPhoto} allPhotos={photos} entries={entries} onClose={() => setDetailPhoto(null)} />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  avatar: {
    width: 37,
    height: 37,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    marginBottom: 14,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  weightCard: {
    padding: 16,
    gap: 14,
  },
  weightTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  bigRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  bigNumber: {
    fontSize: 46,
    lineHeight: 54,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  bigUnit: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  deltaText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  addWeight: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  tabs: {
    marginTop: 16,
    marginBottom: 14,
  },
  progressBlock: {
    gap: 6,
  },
  progressCaption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniRow: {
    flexDirection: 'row',
    gap: 10,
  },
  miniBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    padding: 12,
  },
  miniIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniValue: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  miniLabel: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '500',
  },
  chartCard: {
    marginTop: 14,
    padding: 16,
    gap: 14,
  },
  logHeader: {
    marginTop: 22,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logAdd: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  logCard: {
    overflow: 'hidden',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  logDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  logDate: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  logWeight: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  goalCard: {
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  goalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  goalTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  goalValue: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  goalTrack: {
    alignSelf: 'stretch',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  goalFill: {
    height: '100%',
    borderRadius: 4,
  },
  measureList: {
    gap: 12,
  },
  measureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  measureLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  measureValue: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  roundButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addPhotoLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  hint: {
    textAlign: 'center',
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  photoDayCard: {
    padding: 12,
    gap: 8,
  },
  photoThumb: {
    width: 84,
    height: 112,
    borderRadius: 12,
  },
  photoThumbLabel: {
    width: 84,
    textAlign: 'center',
    marginTop: 4,
    fontSize: 11,
    lineHeight: 14,
  },
});
