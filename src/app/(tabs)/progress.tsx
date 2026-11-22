import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { HorizontalScrollDefaults } from '@/constants/scroll';
import { BodySilhouette, type MeasurementZone } from '@/components/body/body-silhouette';
import { MeasurementInfoModal } from '@/components/body/measurement-info-modal';
import { PhotoDetailModal } from '@/components/body/photo-detail-modal';
import { PosePickerSheet } from '@/components/body/pose-picker-sheet';
import { QuickMeasurementSheet } from '@/components/body/quick-measurement-sheet';
import { TipsCard, type TipSection } from '@/components/body/tips-card';
import { WeightEntryModal } from '@/components/body/weight-entry-modal';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { GoalTrendChart } from '@/components/ui/goal-trend-chart';
import { Icon } from '@/components/ui/icon';
import { TabHeader } from '@/components/tab-header';
import { InsightCard } from '@/components/ui/insight-card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SwipeToDelete } from '@/components/ui/swipe-to-delete';
import { Layout, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRecentWeightSeries } from '@/hooks/use-weight-series';
import { generatePhotoInsight } from '@/lib/assistant/photo-insight';
import { latestSnapshot } from '@/lib/mock/body';
import { addDaysISO, daysAgoISO, formatFullDay } from '@/lib/mock/dates';
import { POSE_LABELS, useBodyStore, type BodyPhoto, type BodyPhotoPose } from '@/store/body-store';
import { useUserStore } from '@/store/user-store';

const SCREEN_PADDING = Layout.screenGutter;
const CARD_RADIUS = Radius.large;

// Top to bottom, roughly following the body itself.
const MEASUREMENTS: { zone: MeasurementZone; label: string }[] = [
  { zone: 'shouldersCm', label: 'Spalle' },
  { zone: 'chestCm', label: 'Petto' },
  { zone: 'bicepsCm', label: 'Bicipite' },
  { zone: 'waistCm', label: 'Vita' },
  { zone: 'hipsCm', label: 'Fianchi' },
  { zone: 'thighCm', label: 'Coscia' },
];

const MEASURE_TIPS: TipSection[] = [
  {
    icon: 'ruler',
    title: 'Come misurarti',
    points: [
      'Metro da sarta morbido, aderente alla pelle ma senza stringere.',
      'Sempre nelle stesse condizioni: al mattino, a digiuno, prima dell’allenamento.',
      'Ogni 2–4 settimane: bastano 5 minuti. Tocca una zona per vedere dove e come misurare.',
    ],
  },
  {
    icon: 'trendDown',
    title: 'Perché prendere le misure',
    points: [
      'Se perdi grasso e metti muscolo il peso può restare fermo, mentre vita e fianchi scendono.',
      'I centimetri mostrano dove cambia il corpo e se il piano sta funzionando.',
    ],
  },
];

const PHOTO_TIPS: TipSection[] = [
  {
    icon: 'camera',
    title: 'Come scattare le foto',
    points: [
      'Un posto ben illuminato, con luce uniforme.',
      '6 foto a corpo intero: frontale, laterale destro e sinistro, posteriore rilassato, poi frontale e posteriore in flessione.',
      'Sempre alla stessa ora: idealmente al mattino, a digiuno.',
      'Ripeti l’intera sequenza una volta al mese.',
    ],
  },
];

const GRID_GAP = 10;

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
  const removeMeasurement = useBodyStore((s) => s.removeMeasurement);
  const removePhoto = useBodyStore((s) => s.removePhoto);
  const removeEntry = useBodyStore((s) => s.removeEntry);
  const addPhoto = useBodyStore((s) => s.addPhoto);

  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [editDate, setEditDate] = useState<string | undefined>(undefined);
  const [infoZone, setInfoZone] = useState<MeasurementZone | null>(null);
  const [addMeasurementZone, setAddMeasurementZone] = useState<{ zone: MeasurementZone; label: string } | null>(null);
  const [posePickerOpen, setPosePickerOpen] = useState(false);
  const [detailPhoto, setDetailPhoto] = useState<BodyPhoto | null>(null);
  const [tab, setTab] = useState<'peso' | 'misure' | 'foto'>('peso');
  const [gridWidth, setGridWidth] = useState(0);
  const tileSize = gridWidth > 0 ? Math.floor((gridWidth - GRID_GAP * 2) / 3) : 0;
  const weightSeries = useRecentWeightSeries(entries, 30);

  const latest = useMemo(() => latestSnapshot(entries), [entries]);
  const startBody = entries[0] ?? latest;
  const photoInsight = generatePhotoInsight(photos, entries);

  // Change against the last weigh-in at least a week old (falls back to the
  // very first entry).
  const weekAgo = addDaysISO(daysAgoISO(0), -7);
  const lastWeekBody = [...entries].reverse().find((e) => e.date <= weekAgo) ?? startBody;
  const weekDelta = latest.weightKg - lastWeekBody.weightKg;

  const sinceStart = latest.weightKg - startBody.weightKg;
  // 0 = the person gave no goal weight: nothing about a goal is shown (never an invented one).
  const hasGoal = currentUser.targetWeightKg > 0;
  const totalToGo = startBody.weightKg - currentUser.targetWeightKg;
  const goalProgress = hasGoal && totalToGo !== 0 ? Math.min(Math.max((startBody.weightKg - latest.weightKg) / totalToGo, 0), 1) : 0;

  // Down is "good" green only when the goal is to lose weight.
  const wantsLoss = hasGoal ? currentUser.targetWeightKg < startBody.weightKg : currentUser.goal === 'loseFat';
  const deltaColor = (delta: number) => (delta === 0 ? theme.textTertiary : (delta < 0) === wantsLoss ? theme.brandGreen : theme.danger);

  // Contextual nudge above the measurement list: never measured, overdue
  // (4+ weeks since the last tape measure) or how many zones are still empty.
  const measureStatus = useMemo(() => {
    const lastMeasured = [...entries].reverse().find((e) => MEASUREMENTS.some((m) => Number.isFinite(e[m.zone])));
    if (!lastMeasured) return 'Non hai ancora preso nessuna misura: parti da vita e fianchi, sono le più indicative. Tocca + per registrarle.';
    if (lastMeasured.date <= addDaysISO(daysAgoISO(0), -28)) {
      return `Ultime misure del ${formatFullDay(lastMeasured.date)}: è passato quasi un mese, è il momento di aggiornarle.`;
    }
    const missing = MEASUREMENTS.filter((m) => !Number.isFinite(latest[m.zone])).length;
    if (missing > 0) return missing === 1 ? 'Ti manca 1 zona da misurare per avere il quadro completo.' : `Ti mancano ${missing} zone da misurare per avere il quadro completo.`;
    return null;
  }, [entries, latest]);

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
    <ScreenScroll
      reveal
      contentContainerStyle={styles.page}
      header={
        <>
          <TabHeader title="Progressi" />
          {/* Fixed under the title, as in Allenamento and Nutrizione. */}
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
        </>
      }>

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

        {hasGoal ? (
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
        ) : null}

        <View style={styles.chartBlock}>
          <GoalTrendChart
            points={weightSeries}
            target={hasGoal ? currentUser.targetWeightKg : null}
            dateGranularity="day"
            height={188}
            color={theme.accent}
            targetColor={theme.brandGreen}
            axisColor={theme.textTertiary}
            gridColor={theme.backgroundElement}
          />
        </View>

        <View style={styles.miniRow}>
          <View style={[styles.miniBox, { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.miniIcon, { backgroundColor: deltaColor(sinceStart) + '22' }]}>
              <Icon name={sinceStart <= 0 ? 'trendDown' : 'trendUp'} size={17} color={deltaColor(sinceStart)} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.miniValue, { color: deltaColor(sinceStart) }]}>{signedKg(sinceStart)} kg</ThemedText>
              <ThemedText style={styles.miniLabel} themeColor="textTertiary">
                da inizio piano
              </ThemedText>
            </View>
          </View>
          <View style={[styles.miniBox, { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.miniIcon, { backgroundColor: theme.brandGreen + '22' }]}>
              <Icon name="target" size={17} color={theme.brandGreen} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.miniValue}>{hasGoal ? `${currentUser.targetWeightKg} kg` : '—'}</ThemedText>
              <ThemedText style={styles.miniLabel} themeColor="textTertiary">
                {hasGoal ? 'obiettivo' : 'nessun peso obiettivo'}
              </ThemedText>
            </View>
          </View>
        </View>
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
            // Swipe left to delete, as for the foods in the calorie tracking; a tap edits the weigh-in.
            <SwipeToDelete
              key={entry.date}
              onDelete={() => removeEntry(entry.date)}
              onPress={() => {
                setEditDate(entry.date);
                setWeightModalOpen(true);
              }}
              accessibilityLabel={`Peso del ${entry.date}: ${entry.weightKg.toFixed(1)} kg`}>
            <View
              style={[
                styles.logRow,
                { backgroundColor: theme.backgroundElevated },
                i === 0 && { backgroundColor: theme.accentSoft },
                i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
              ]}>
              <View style={[styles.logDot, { backgroundColor: i === 0 ? theme.accent : theme.textTertiary }]} />
              <ThemedText style={styles.logDate} themeColor="textSecondary">
                {new Date(entry.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '')}
              </ThemedText>
              <ThemedText style={styles.logWeight}>{entry.weightKg.toFixed(1)} kg</ThemedText>
              <Icon name="chevronRight" size={16} color={theme.textTertiary} />
            </View>
            </SwipeToDelete>
          ))}
        {entries.length === 0 ? (
          <ThemedText style={[styles.hint, styles.emptyHint]} themeColor="textTertiary">
            Nessuna registrazione: tocca + per aggiungere il tuo peso.
          </ThemedText>
        ) : null}
      </FlatCard>

        </>
      ) : null}

      {tab === 'misure' ? (
      <View style={styles.measureList}>
        {measureStatus ? (
          <ThemedText style={styles.hint} themeColor="textTertiary">
            {measureStatus}
          </ThemedText>
        ) : null}
        <View style={styles.measureGrid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {tileSize > 0
            ? MEASUREMENTS.map((m) => {
                // Entries logged before this zone existed carry no value for it.
                const latestValue = latest[m.zone];
                // 0 means never measured (or the only measurement was deleted).
                const hasValue = Number.isFinite(latestValue) && latestValue > 0;
                return (
                  <Pressable
                    key={m.zone}
                    onPress={() => setInfoZone(m.zone)}
                    accessibilityRole="button"
                    accessibilityLabel={`${m.label}${hasValue ? `, ${latestValue} centimetri` : ''}. Come misurare e andamento`}
                    style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                  >
                    <FlatCard radius={22} style={[styles.measureTile, { width: tileSize, height: tileSize + 16 }]}>
                      <View style={styles.tileTop}>
                        <BodySilhouette zone={m.zone} height={56} />
                        <Pressable
                          onPress={() => setAddMeasurementZone(m)}
                          hitSlop={10}
                          accessibilityLabel={`Aggiungi misura: ${m.label}`}
                          style={[styles.tileAdd, { backgroundColor: theme.accentSoft }]}
                        >
                          <Icon name="plus" size={15} color={theme.accent} />
                        </Pressable>
                      </View>
                      <View style={styles.tileBottom}>
                        <ThemedText style={styles.tileLabel} themeColor="textSecondary" numberOfLines={1}>
                          {m.label}
                        </ThemedText>
                        {hasValue ? (
                          <View style={styles.tileValueRow}>
                            <ThemedText style={styles.tileValue}>{String(latestValue).replace('.', ',')}</ThemedText>
                            <ThemedText style={styles.tileUnit} themeColor="textSecondary">
                              cm
                            </ThemedText>
                          </View>
                        ) : (
                          <ThemedText style={styles.tileValue} themeColor="textTertiary">
                            —
                          </ThemedText>
                        )}
                      </View>
                    </FlatCard>
                  </Pressable>
                );
              })
            : null}
        </View>
        <TipsCard sections={MEASURE_TIPS} />
      </View>

      ) : null}

      {tab === 'foto' ? (
        <>
      <View style={{ gap: 14 }}>
        <Pressable onPress={() => setPosePickerOpen(true)} style={[styles.addPhotoRow, { borderColor: theme.boxEdge }]}>
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
              <ScrollView {...HorizontalScrollDefaults} contentContainerStyle={{ gap: 8 }}>
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

        <TipsCard sections={PHOTO_TIPS} />
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
      <MeasurementInfoModal
        zone={infoZone}
        entries={entries}
        onClose={() => setInfoZone(null)}
        onDelete={(zone, date) => removeMeasurement(zone, date)}
        onAdd={(zone) => {
          // The add sheet opens once the popup has left the screen.
          setInfoZone(null);
          const m = MEASUREMENTS.find((x) => x.zone === zone);
          if (m) setTimeout(() => setAddMeasurementZone(m), 220);
        }}
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
      <PhotoDetailModal
        photo={detailPhoto}
        allPhotos={photos}
        entries={entries}
        onClose={() => setDetailPhoto(null)}
        onDelete={(id) => {
          setDetailPhoto(null);
          removePhoto(id);
        }}
      />
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
  sectionTitle: {
    marginBottom: 14,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  // Sized so the whole card (weight, goal bar, chart, the two boxes) is visible as the page opens.
  weightCard: {
    padding: 16,
    gap: 12,
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
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  bigUnit: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '500',
  },
  deltaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  deltaText: {
    fontSize: 13,
    lineHeight: 17,
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
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  tabs: {
    marginTop: -4,
    marginBottom: 10,
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
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  miniIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniValue: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  miniLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  chartBlock: {
    marginHorizontal: -4,
    marginTop: 2,
  },
  logHeader: {
    marginTop: 22,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logAdd: {
    fontSize: 17,
    lineHeight: 22,
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
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  logWeight: {
    fontSize: 17,
    lineHeight: 22,
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
  measureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  measureTile: {
    padding: 12,
    justifyContent: 'space-between',
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tileAdd: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBottom: {
    gap: 1,
  },
  tileLabel: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  tileValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  tileValue: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  tileUnit: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  measureLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
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
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  emptyHint: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  hint: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 19,
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
    fontSize: 13,
    lineHeight: 18,
  },
});
