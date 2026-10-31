# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users
Intermediate gym-goers who already train and want to optimise: build muscle, recompose, or cut without losing strength. They open the app before and after sessions and at meals, on an iPhone (installed app or the Home Screen web app), to see what to do today, log what they did, and check whether the week is on track.

## Product Purpose
FITLAB builds one coherent plan for training and nutrition from a questionnaire, then keeps it honest: the user logs workouts, meals, weight and effort, and the plan is re-evaluated against what actually happened. Success is the user trusting today's numbers enough to follow them, and seeing the trend move toward the goal.

## Positioning
- **Adaptive plan:** targets are an initial estimate that the Adaptive Nutrition Engine and RIR-based load progression revise from real behaviour (weight trend, adherence, reps in reserve), with versioned plans instead of a fixed day-0 calculation.
- **Training and diet as one system:** calories burned and eaten meet in a single daily and weekly energy balance against the goal, rather than two separate apps.

## Operating Context
- Four tabs: Home (daily balance, week, plan summaries), Training (today's session, exercises, logging), Nutrizione (calories, macros, meals by slot), Progressi (weight trend, measurements, photos).
- Gym-floor session mode used mid-set, at arm's length, under gym lighting.
- Multi-agent AI coach chat (trainer, nutritionist) that explains plan decisions.
- Monthly check-in, weekly and monthly summaries, HealthKit / Health Connect data.
- Italian-language UI.

## Capabilities and Constraints
- Expo SDK 57 / React Native 0.86 app with Expo Router; also exported to web (Vercel) and used as an iOS Home Screen web app.
- Supabase backend; plans stored as versioned JSON (`plan_versions`), nutrition target history.
- Calculations: Mifflin-St Jeor BMR, TDEE with activity and training bump, goal calorie factor, protein per kg, fats 25%, carbs remainder.

## Brand Commitments
- Name FITLAB and the FITLAB mark (`public/logo.svg`, `assets/images/fitlab-logo-*.webp`).

## Evidence on Hand
- No real user testimonials, metrics or press exist; do not fabricate them.
- Real meal images in `public/images/meals`.

## Product Principles
1. Today first: the user should know what to do now within one glance.
2. Show the estimate as an estimate: adaptive numbers explain where they come from and when they change.
3. One balance: training and nutrition always read against the same goal.
4. Respect the gym-floor context: legible, large targets, minimal typing mid-session.
