import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { GoalTrendChart } from '@/components/ui/goal-trend-chart';
import { Icon } from '@/components/ui/icon';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { WeeklyBurnChart } from '@/components/ui/weekly-burn-chart';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWeeklyEnergy } from '@/hooks/use-weekly-energy';
import { useWeightSeries, weightDateGranularity, type WeightRange } from '@/hooks/use-weight-series';
import { latestSnapshot } from '@/lib/mock/body';
import { useBodyStore } from '@/store/body-store';
import { useUserStore } from '@/store/user-store';

/**
 * The weight-trend and weekly-energy charts that used to live at the
 * bottom of Home — moved here so they get a proper dedicated tab instead
 * of competing for space under the new daily-focused Home hero section.
 * Reads the same useWeeklyEnergy() pipeline Home's own weekly goal card
 * uses, so the two screens can never disagree on the numbers.
 */
export default function ProgressScreen() {
  const theme = useTheme();
  const currentUser = useUserStore();
  const bodyEntries = useBodyStore((s) => s.entries);

  const latestBody = useMemo(() => latestSnapshot(bodyEntries), [bodyEntries]);
  const startBody = bodyEntries[0] ?? latestBody;
  const doneSoFar = startBody.weightKg - latestBody.weightKg;

  const [weightRange, setWeightRange] = useState<WeightRange>('settimana');
  const weightSeries = useWeightSeries(bodyEntries, weightRange);

  const { weekDaysWithActivity, todayEstimatedBalance, weekEstimatedExpenditureSoFar, weeklyProgrammedKcal } = useWeeklyEnergy();

  return (
    <ScreenScroll>
      <ScreenHeader eyebrow="Andamento" title="Progressi" />

      <View>
        <SectionHeader title="Obiettivo" />
        <GlassSurface level="card" radius={Radius.large} style={{ gap: Spacing.three, padding: Spacing.four }}>
          <SegmentedControl
            options={[
              { value: 'settimana', label: 'Settimana' },
              { value: 'mese', label: 'Mese' },
              { value: 'anno', label: 'Anno' },
            ]}
            value={weightRange}
            onChange={(v) => setWeightRange(v as typeof weightRange)}
          />

          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <ThemedText type="caption" themeColor="textSecondary">
                Peso attuale
              </ThemedText>
              <ThemedText type="subtitle">{latestBody.weightKg.toFixed(1)} kg</ThemedText>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <ThemedText type="caption" themeColor="textSecondary">
                Progressi finora
              </ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name={doneSoFar > 0 ? 'trendDown' : 'trendUp'} size={14} color={doneSoFar > 0 ? theme.success : theme.danger} />
                <ThemedText type="subtitle" style={{ color: doneSoFar > 0 ? theme.success : theme.danger }}>
                  {doneSoFar > 0 ? '-' : '+'}
                  {Math.abs(doneSoFar).toFixed(1)} kg
                </ThemedText>
              </View>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <ThemedText type="caption" themeColor="textSecondary">
                Peso target
              </ThemedText>
              <ThemedText type="subtitle" style={{ color: theme.success }}>
                {currentUser.targetWeightKg} kg
              </ThemedText>
            </View>
          </View>

          <GoalTrendChart
            points={weightSeries}
            target={currentUser.targetWeightKg}
            dateGranularity={weightDateGranularity(weightRange)}
            height={240}
            color={theme.accent}
            targetColor={theme.success}
            axisColor={theme.textTertiary}
            gridColor={theme.backgroundElement}
          />
        </GlassSurface>
      </View>

      <View>
        <SectionHeader title="Dispendio stimato e calorie assunte" />
        <GlassSurface level="card" radius={Radius.large} style={{ gap: Spacing.three, padding: Spacing.four }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <ThemedText type="caption" themeColor="textSecondary">
                Oggi
              </ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name={todayEstimatedBalance >= 0 ? 'trendDown' : 'trendUp'} size={14} color={todayEstimatedBalance >= 0 ? theme.success : theme.danger} />
                <ThemedText type="subtitle" style={{ color: todayEstimatedBalance >= 0 ? theme.success : theme.danger }}>
                  {todayEstimatedBalance >= 0 ? '-' : '+'}
                  {Math.abs(Math.round(todayEstimatedBalance))} kcal
                </ThemedText>
              </View>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <ThemedText type="caption" themeColor="textSecondary">
                Settimana
              </ThemedText>
              <ThemedText type="smallBold">Dispendio stimato {Math.round(weekEstimatedExpenditureSoFar)} kcal</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Target settimanale {Math.round(weeklyProgrammedKcal)} kcal
              </ThemedText>
            </View>
          </View>
          <WeeklyBurnChart
            days={weekDaysWithActivity.map((d) => ({
              label: d.label,
              date: d.date,
              estimatedExpenditureKcal: d.estimatedExpenditureKcal,
              eatenKcal: d.eatenKcal,
              isToday: d.isToday,
              hasHappened: d.hasHappened,
              rings: { training: d.trainingProgress, diet: d.dietProgress, steps: d.stepsProgress },
            }))}
            expenditureColor={theme.accent}
            eatenColor={theme.success}
            deficitColor={theme.calorieDeficit}
            surplusColor={theme.calorieSurplus}
            trackColor={theme.backgroundElement}
            axisColor={theme.textTertiary}
            todayBadgeColor={theme.accent}
            todayBadgeTextColor={theme.onAccent}
            trainingColor={theme.accent}
            dietColor={theme.success}
            stepsColor={theme.warning}
          />
        </GlassSurface>
      </View>
    </ScreenScroll>
  );
}
