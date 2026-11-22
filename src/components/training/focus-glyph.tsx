import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import type { SpotFocus } from '@/lib/planning/training/spot-workouts';

/**
 * The goals of Allenamento veloce as line icons that follow human anatomy: an
 * athletic outline (trapezius slope, deltoid cap, V taper, quad sweep, calf),
 * the muscles of the view drawn as faint contours, and the trained ones filled
 * in the accent with their real shape (fan-shaped pecs, deltoid caps, spindle
 * biceps, a six-pack, lat wings, glutes, teardrop quads). Each icon zooms on
 * its own area; the tools (functional, cross training, HIIT) use the same line.
 */

/** On-screen line weight in points, the same for every icon whatever its zoom. */
const LINE_PT = 1.5;
/** Muscle contours are drawn lighter than the outline. */
const CONTOUR_OPACITY = 0.38;

// viewBox 0 0 40 60. Left half only: everything is drawn again mirrored around x = 20.
const OUTLINE =
  'M18.2 9.6V10.8C16.8 11.6 15 11.8 13.4 12.2C10.8 12.6 9.6 14.6 9.8 17.4C9.4 19.6 8.8 22 8.9 24.4C8.6 25.6 8.2 26.4 8 27.6' +
  'C7.6 29.6 7.8 31.6 8.2 33.4C8.3 34.6 9.6 35 10 34C10.4 32 10.6 29.8 11 27.8C11.4 26 11.4 24.4 11.8 22.6C12 21 12.6 19.8 13.4 19' +
  'C13.8 21.6 14.6 24.6 15 27.4C15.1 29.4 14.4 31 14 33C13.4 37 13.6 41 14.4 45.6C14.6 47 14.4 48.2 14.6 49.4' +
  'C14.2 51.6 14.6 53.6 15.4 56L15.6 57.8Q16 58.6 17.2 58.4L18.4 58.2C18.6 56 18.4 54 18.4 52.2C18.4 50.6 18.8 49.6 18.8 48.2' +
  'C19 44 19.4 40 20 37.6';
/** The same half closed along the centre line, to fill the whole figure. */
const SILHOUETTE = `${OUTLINE}V10.2Z`;

type Muscle = 'traps' | 'delts' | 'pecs' | 'biceps' | 'forearms' | 'abs' | 'obliques' | 'lats' | 'glutes' | 'quads' | 'calves';

const MUSCLE: Record<Muscle, string[]> = {
  traps: ['M20 10.2C18.6 11.2 16.4 12 14.2 12.6C16.4 13.4 18.4 15 20 18.4Z'],
  delts: ['M13.6 12.6C11.6 12.6 10.2 14 10.1 16.6C10.2 18 10.6 19 11.2 19.6C11.8 18 12.8 16.4 14.2 14.4C14.2 13.4 14 12.8 13.6 12.6Z'],
  pecs: ['M19.6 13.2C17.4 12.8 15.2 13 13.8 14C13.4 15.6 14 17.2 15.2 18.4C16.6 19.4 18.4 19.6 19.6 19Z'],
  biceps: ['M11.4 18.8C10.4 19.8 9.8 21.8 9.8 23.8C9.9 25 10.4 25.8 10.9 26C11.4 24.6 11.8 22.6 11.9 20.4C11.9 19.6 11.7 19 11.4 18.8Z'],
  forearms: ['M9 27.2C8.4 28.8 8.3 30.8 8.7 32.6C9.3 31 9.9 29.4 10.4 27.6C9.9 27.2 9.4 27.1 9 27.2Z'],
  abs: [
    'M17.6 20.2H19.4V22.9H17.9Q17.4 22.9 17.4 22.4V20.6Q17.4 20.2 17.6 20.2Z',
    'M17.6 23.6H19.4V26.4H17.9Q17.4 26.4 17.4 25.9V24Q17.4 23.6 17.6 23.6Z',
    'M17.7 27.1H19.4V30H18.1Q17.5 30 17.5 29.5V27.5Q17.5 27.1 17.7 27.1Z',
    'M17.7 30.7H19.4V35.4C18.6 34.6 17.8 33 17.7 30.7Z',
  ],
  obliques: ['M15.4 21.2C16.2 23.6 16.6 26.8 16.6 30.6C16 31.6 15.4 32.2 14.8 32.6C15.2 30.4 15.4 28.6 15.1 26.4C15 24.6 15.2 22.8 15.4 21.2Z'],
  lats: ['M14.2 19C15.6 19.4 17.4 20.4 19.4 22.4L19.6 25C18.4 26.6 16.6 27.6 15.4 27.8C15 25 14.6 22 14.2 19Z'],
  glutes: ['M19.8 32.4C18 31.6 15.6 31.8 14.4 33.4C13.8 35.2 14.2 37.4 15.6 38.6C17.2 39.4 18.8 39 19.8 38Z'],
  quads: ['M15.2 36.6C14.4 39.6 14.6 43.4 15.4 46C16.2 47.4 17.4 47.6 18.2 46.6C18.8 43.8 19 40.2 18.6 37.4C17.6 36.2 16 36 15.2 36.6Z'],
  calves: ['M15 50.2C14.6 52 15 53.6 15.8 54.8C16.8 54 17.8 52.2 18 50.4C17.4 49.6 15.8 49.6 15 50.2Z'],
};

/** Muscles seen from the front and from the back (the outline is the same). */
const FRONT: Muscle[] = ['delts', 'pecs', 'biceps', 'forearms', 'abs', 'obliques', 'quads', 'calves'];
const BACK: Muscle[] = ['traps', 'delts', 'lats', 'forearms', 'glutes', 'calves'];

const VIEW: Partial<Record<SpotFocus, { muscles: Muscle[]; lit: Muscle[] }>> = {
  chest: { muscles: FRONT, lit: ['pecs'] },
  shoulders: { muscles: FRONT, lit: ['delts'] },
  arms: { muscles: FRONT, lit: ['biceps', 'forearms'] },
  core: { muscles: FRONT, lit: ['abs', 'obliques'] },
  legs: { muscles: FRONT, lit: ['quads', 'calves'] },
  total: { muscles: FRONT, lit: FRONT },
  back: { muscles: BACK, lit: ['traps', 'lats'] },
  glutes: { muscles: BACK, lit: ['glutes'] },
};

/** Square window (x, y, side) on the 40×60 drawing: each goal zooms on its own area. */
const CROP: Record<SpotFocus, [number, number, number]> = {
  chest: [8, 7.5, 24],
  shoulders: [5, 6, 30],
  back: [6, 7, 28],
  arms: [6.5, 12, 27],
  core: [11, 17.5, 18],
  glutes: [10, 27.5, 20],
  legs: [7, 34, 26],
  total: [-10, 0, 60],
  functional: [8, 15, 24],
  cross: [2, 13, 36],
  hiit: [6, 16, 28],
};

const MIRROR = 'translate(40 0) scale(-1 1)';

export function FocusGlyph({ focus, size = 50, line, accent }: { focus: SpotFocus; size?: number; line: string; accent: string }) {
  const [cx, cy, side] = CROP[focus];
  const stroke = { stroke: line, strokeWidth: (LINE_PT * side) / size, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const view = VIEW[focus];

  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }}>
      <Svg width={size} height={size} viewBox={`${cx} ${cy} ${side} ${side}`}>
        {view ? (
          <>
            {[undefined, MIRROR].map((transform) => (
              <G key={transform ?? 'left'} transform={transform}>
                {focus === 'total' ? <Path d={SILHOUETTE} fill={accent} opacity={0.18} /> : null}
                {view.muscles.map((m) =>
                  MUSCLE[m].map((d, i) =>
                    view.lit.includes(m) ? (
                      <Path key={`${m}-${i}`} d={d} fill={accent} />
                    ) : (
                      <Path key={`${m}-${i}`} d={d} fill="none" {...stroke} strokeWidth={stroke.strokeWidth * 0.8} opacity={CONTOUR_OPACITY} />
                    )
                  )
                )}
                <Path d={OUTLINE} fill="none" {...stroke} />
              </G>
            ))}
            <Circle cx={20} cy={5.6} r={3.3} fill="none" {...stroke} />
          </>
        ) : focus === 'functional' ? (
          <>
            <Path d="M14.6 28.4C13.6 26.6 13.3 25 13.3 23.8a6.7 4.6 0 0 1 13.4 0c0 1.2-.3 2.8-1.3 4.6" fill="none" {...stroke} />
            <Circle cx={20} cy={33.2} r={7.6} fill="none" {...stroke} />
            <Circle cx={20} cy={33.2} r={2.6} fill={accent} />
          </>
        ) : focus === 'cross' ? (
          <>
            <Path d="M4 30h32" fill="none" {...stroke} />
            <Rect x={8} y={23} width={3.6} height={14} rx={1.6} fill={accent} />
            <Rect x={28.4} y={23} width={3.6} height={14} rx={1.6} fill={accent} />
            <Rect x={12.6} y={25.5} width={2.4} height={9} rx={1.2} fill="none" {...stroke} />
            <Rect x={25} y={25.5} width={2.4} height={9} rx={1.2} fill="none" {...stroke} />
          </>
        ) : (
          <>
            <Path d="M17.5 17.5h5M20 17.5v3" fill="none" {...stroke} />
            <Circle cx={20} cy={32} r={11} fill="none" {...stroke} />
            <Path d="M21.3 24.8 16.6 32.6h3.8l-1.3 6.6 4.7-7.8H20z" fill={accent} />
          </>
        )}
      </Svg>
    </View>
  );
}
