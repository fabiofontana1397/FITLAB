import { CustomPlanSheet } from '@/components/plans/custom-plan-sheet';

/** Load a diet the person already has: the app follows it in place of its own nutrition plan. */
export default function CustomDietScreen() {
  return <CustomPlanSheet kind="diet" />;
}
