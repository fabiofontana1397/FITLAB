import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import type { SpotFocus } from '@/lib/planning/training/spot-workouts';

/**
 * The goals of Allenamento veloce as small "muscle maps": a stylised figure
 * drawn in quiet segments, with the muscles the workout trains lit in the
 * accent. Total body lights them all; the three styles that are not about a
 * muscle (functional, cross training, HIIT) get a tool drawn the same way —
 * a muted body with the meaningful part in the accent.
 */

/** An ellipse (cx, cy, rx, ry, rotation) or a path, in a 40×60 box. */
type Shape = { e: [number, number, number, number, number?] } | { d: string };
type Part = 'traps' | 'delts' | 'chest' | 'arms' | 'forearms' | 'abs' | 'obliques' | 'glutes' | 'quads' | 'calves';

/** Left-side shapes; the right side is mirrored around x = 20. */
const LEFT: Record<Part, Shape[]> = {
  traps: [{ d: 'M20 10.2C18 10.2 16.2 11 15 12.6C16.8 12.9 18.6 13.3 20 14Z' }],
  delts: [{ e: [12.2, 14.9, 3.2, 2.7, -28] }],
  chest: [{ d: 'M19.4 13.6C16.6 13.1 14.2 14.1 14 16.6C13.9 19 16 20.4 19.4 19.8Z' }],
  arms: [{ e: [10, 22.4, 1.95, 4.4, 12] }],
  forearms: [{ e: [8.2, 31.6, 1.65, 4.3, 14] }],
  abs: [
    { e: [18.3, 22.6, 1.35, 1.5] },
    { e: [18.3, 26.2, 1.35, 1.5] },
    { e: [18.4, 29.8, 1.3, 1.6] },
  ],
  obliques: [{ d: 'M15 21.2C13.8 24 13.8 28.4 15.3 32.2L16.6 32.2C16.2 28.6 16.2 24.6 16.6 21.4Z' }],
  glutes: [{ e: [17, 36.4, 3.3, 2.9] }],
  quads: [{ e: [17.1, 45.6, 2.85, 6.3, 3] }],
  calves: [{ e: [17.6, 55.2, 1.95, 3.9, 2] }],
};

const ALL_PARTS = Object.keys(LEFT) as Part[];

const LIT: Partial<Record<SpotFocus, Part[]>> = {
  glutes: ['glutes'],
  legs: ['quads', 'calves'],
  chest: ['chest'],
  back: ['traps', 'obliques'],
  shoulders: ['delts'],
  arms: ['arms', 'forearms'],
  core: ['abs', 'obliques'],
  total: ALL_PARTS,
};

function ShapeEl({ shape, fill, mirror }: { shape: Shape; fill: string; mirror: boolean }) {
  const flip = mirror ? 'translate(40 0) scale(-1 1)' : undefined;
  if ('d' in shape) return <Path d={shape.d} fill={fill} transform={flip} />;
  const [cx, cy, rx, ry, rot = 0] = shape.e;
  return <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} transform={`${flip ?? ''} rotate(${rot} ${cx} ${cy})`.trim()} />;
}

export function FocusGlyph({ focus, size = 50, muted, accent }: { focus: SpotFocus; size?: number; muted: string; accent: string }) {
  const width = (size * 40) / 60;
  const lit = LIT[focus];

  if (lit) {
    return (
      <Svg width={width} height={size} viewBox="0 0 40 60">
        <Ellipse cx={20} cy={5.4} rx={3.3} ry={3.9} fill={focus === 'total' ? accent : muted} />
        {ALL_PARTS.map((part) =>
          LEFT[part].flatMap((shape, i) =>
            [false, true].map((mirror) => (
              <ShapeEl key={`${part}-${i}-${mirror}`} shape={shape} mirror={mirror} fill={lit.includes(part) ? accent : muted} />
            ))
          )
        )}
      </Svg>
    );
  }

  // Tools, centred in the same 40×60 box so every tile lines up.
  return (
    <Svg width={width} height={size} viewBox="0 0 40 60">
      {focus === 'functional' ? (
        <>
          <Path d="M13.5 26v-4a6.5 6.5 0 0 1 13 0v4" stroke={muted} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Circle cx={20} cy={35} r={10} fill={accent} />
          <Rect x={15} y={40.5} width={10} height={2.4} rx={1.2} fill={muted} opacity={0.6} />
        </>
      ) : focus === 'cross' ? (
        <>
          <Rect x={2} y={28.8} width={36} height={2.4} rx={1.2} fill={muted} />
          <Rect x={6.5} y={21} width={4.6} height={18} rx={2} fill={accent} />
          <Rect x={11.8} y={24} width={3} height={12} rx={1.5} fill={accent} />
          <Rect x={28.9} y={21} width={4.6} height={18} rx={2} fill={accent} />
          <Rect x={25.2} y={24} width={3} height={12} rx={1.5} fill={accent} />
        </>
      ) : (
        <>
          <Rect x={17} y={15} width={6} height={3} rx={1.5} fill={muted} />
          <Circle cx={20} cy={33} r={12} stroke={muted} strokeWidth={3} fill="none" />
          <Path d="M21.6 23.5 15.5 34h4.6l-1.7 8.5 6.1-10.5h-4.6z" fill={accent} />
        </>
      )}
    </Svg>
  );
}
