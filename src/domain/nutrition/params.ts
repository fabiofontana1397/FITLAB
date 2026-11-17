/**
 * Every tunable number of the adaptive nutrition engine, in one place (documented in docs/nutrition-engine.md).
 * Changing a value here changes the behaviour everywhere: no threshold is repeated elsewhere.
 */
export const NUTRITION_PARAMS = {
  weight: {
    /** A weigh-in further than this from its neighbours' median (kg, or share of body weight, the larger) is an anomaly. */
    anomalyKg: 1.0,
    anomalyShare: 0.015,
    /** Trend usable for safety decisions only (e.g. losing too fast). */
    limitedMinCount: 3,
    limitedMinSpanDays: 14,
    /** Representative trend: needed for any calorie change on a stall / slow progress (3+ weeks). */
    goodMinCount: 6,
    goodMinSpanDays: 21,
    /** |rate| under this share of body weight per week counts as "still". */
    stillShare: 0.001,
    /** Ratio measured / expected rate: below `plateauRatio` stall, below `slowRatio` slow, above `fastRatio` fast. */
    plateauRatio: 0.25,
    slowRatio: 0.6,
    fastRatio: 1.5,
    /** Losing more than this share of body weight per week is too fast whatever the plan. */
    maxLossShare: 0.01,
    /** Gaining is "too fast" only above this share per week as well (muscle gain is slow). */
    gainFastShare: 0.005,
    /** Maintenance: stable within max(this kg, this share) per week. */
    maintenanceBandKg: 0.2,
    maintenanceBandShare: 0.003,
  },
  adherence: {
    high: 0.75,
    low: 0.5,
    /** Logged intake further than this from the target means the weight reflects what was eaten, not the plan. */
    intakeOffShare: 0.2,
    minTrackedDays: 10,
  },
  calories: {
    /** Largest single monthly step and largest cumulative correction on top of the model. */
    maxMonthlyStep: 150,
    maxTotalAdjustment: 500,
    /** Steps by situation (sign applied by goal direction). */
    stallStep: 150,
    slowStep: 100,
    fastStep: 100,
    driftStep: 100,
    /** A cut while hunger/energy/recovery are strained is reduced to this. */
    strainedCut: 50,
    /** After a change in the opposite direction last month, only this share of a new step is applied (no see-saw). */
    reversalShare: 0.5,
  },
  safety: {
    /** Deficit never deeper than this share of the best expenditure estimate — the same limit as the first plan. */
    maxDeficitShare: 0.2,
    /** Surplus never larger than this share of expenditure, nor than `maxSurplusKcal`. */
    maxSurplusShare: 0.15,
    maxSurplusKcal: 500,
    /** Individual floor: the larger of the sex floor and this share of the resting expenditure (BMR). */
    bmrFloorShare: 0.9,
    /** Fats never under this many g per kg nor under this share of calories. */
    minFatPerKg: 0.6,
    minFatShare: 0.2,
    /** Protein range in g per kg of reference weight. */
    minProteinPerKg: 1.2,
    maxProteinPerKg: 2.4,
    /** Satiety profile: extra protein per kg (within the 30% of calories cap). */
    satietyProteinBonusPerKg: 0.2,
    minCarbsG: 100,
    /**
     * A target that drifts past a limit only because the energy model moved (new weight, new estimate) is
     * recalculated only beyond this share of expenditure. Decisions never use it: a cut can never go past
     * the limit itself.
     */
    driftToleranceShare: 0.02,
  },
  tdee: {
    /** Dynamic expenditure: only with this many tracked days, good weight data and high adherence. */
    minTrackedDays: 20,
    /** Share of the gap between observed and estimated expenditure taken each month. */
    blend: 0.5,
    /** The estimate never strays further than this share from the energy model… */
    maxOffsetShare: 0.15,
    /** …and moves by at most this share of the model in one month (gradual, even with striking data). */
    maxOffsetStepShare: 0.075,
    kcalPerKg: 7700,
  },
  planning: {
    /** Flexible times: a window of ±this many minutes. */
    flexibleWindowMin: 60,
    /** Distribution "even": how far the slot shares move toward equal (0 = unchanged, 1 = all equal). */
    evenBlend: 0.5,
    /** Distribution "lighterMains": share taken off lunch and dinner, moved to breakfast and snacks. */
    lighterMainsShare: 0.15,
    /** Max times the same main protein food in the week's lunches and dinners (canned tuna: `maxTunaPerWeek`). */
    maxSameProteinPerWeek: 3,
    maxTunaPerWeek: 2,
    /** Share of dishes that may repeat last month's (above it the validator warns). */
    maxRepeatedDishShare: 0.5,
  },
} as const;
