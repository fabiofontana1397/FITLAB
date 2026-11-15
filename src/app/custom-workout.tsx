import { CustomPlanSheet } from '@/components/plans/custom-plan-sheet';

/** Load a workout card the person already has: the app turns it into their training plan, whether or not one exists. */
export default function CustomWorkoutScreen() {
  return <CustomPlanSheet kind="training" />;
}
