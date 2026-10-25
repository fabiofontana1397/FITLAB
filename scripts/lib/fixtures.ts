/** Plans seeded into localStorage by the browser tests (workouts on Mon, Thu, Sat, a run on Wed, rest on the other days). */
const exercise = (n: number) => ({ id: `ex-${n}`, name: `Esercizio ${n}`, sets: 3, reps: '10', restSec: 60, suggestedKg: 20, tempo: '2-0-1' });
const workout = (weekday: string, title: string) => ({ weekday, type: 'workout', title, exercises: [exercise(1), exercise(2), exercise(3)] });
const rest = (weekday: string) => ({ weekday, type: 'rest', title: 'Riposo' });
export const TRAINING_PLAN = {
  generatedAt: new Date().toISOString(),
  durationMonths: 3,
  engine: 'training-2',
  calibration: {},
  months: [
    {
      monthIndex: 1,
      phase: 'adattamento',
      title: 'Mese 1',
      focusNote: '',
      weeklySplit: [
        workout('Lun', 'Petto e tricipiti'),
        rest('Mar'),
        { weekday: 'Mer', type: 'cardio', title: 'Corsa facile', note: 'Corsa facile 35 min' },
        workout('Gio', 'Schiena e bicipiti'),
        rest('Ven'),
        workout('Sab', 'Gambe'),
        rest('Dom'),
      ],
    },
  ],
};

