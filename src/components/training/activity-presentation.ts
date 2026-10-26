import type { IconName } from '@/components/ui/icon';
import type { ActivityType } from '@/lib/nutrition/activity-log';

/** The glyph each logged activity wears, in the training list and in its sheet. */
export const ACTIVITY_ICON: Partial<Record<ActivityType, IconName>> = {
  gym: 'gym',
  running: 'running',
  cycling: 'cycling',
  swimming: 'swimming',
  walking: 'footsteps',
  functional: 'functional',
  tennis: 'tennis',
  hiking: 'footsteps',
};

/** The broad kind of effort an activity is, shown as "Attività" in its sheet. */
export const ACTIVITY_CATEGORY: Record<ActivityType, string> = {
  gym: 'Forza',
  running: 'Cardio',
  cycling: 'Cardio',
  swimming: 'Cardio',
  walking: 'Cardio',
  hiking: 'Cardio',
  functional: 'Funzionale',
  boxing: 'Funzionale',
  tennis: 'Sport',
  soccer: 'Sport',
  basketball: 'Sport',
  volleyball: 'Sport',
  skiing: 'Sport',
  yoga: 'Mobilità',
  other: 'Altro',
};
