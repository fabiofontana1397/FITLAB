/**
 * Switch for the features that spend Claude credits: chat, Home insights and photo
 * analysis. Off by default — the local coach (local-coach.ts) answers from the data
 * the app already has. To turn them back on, set EXPO_PUBLIC_AI_COACH=true in .env
 * (and keep the matching Edge Functions deployed).
 *
 * The plan strategy is not covered by this switch: it is cached per similar profile
 * and uses a small model (see docs/ARCHITECTURE-AGENTS.md, "Costi dell'AI").
 */
export const AI_COACH_ENABLED = process.env.EXPO_PUBLIC_AI_COACH === 'true';
