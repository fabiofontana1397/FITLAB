export const dailyStepsTarget = 9000;

// There's no real step-tracking feature in the app yet (no pedometer/health
// integration, no manual step-logging action) — this used to ship with two
// weeks of fabricated history, which showed up as real activity for an
// account that had never used the app. Empty until a real data source
// exists; every read site already treats a missing day as 0 steps.
export const stepsHistory: { date: string; steps: number }[] = [];
