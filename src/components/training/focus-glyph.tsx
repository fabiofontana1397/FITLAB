import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import type { SpotFocus } from '@/lib/planning/training/spot-workouts';

/**
 * The goals of Allenamento veloce as line icons: a single thin outline of a
 * figure, with only the muscles the workout trains filled in. The three
 * styles that are not about a muscle (functional, cross training, HIIT) get a
 * tool drawn with the same thin line and one filled detail.
 */

/** On-screen line weight in points, the same for every icon whatever its zoom. */
const LINE_PT = 1.6;

/**
 * Each goal zooms on its own area (x, y, side of a square window in the
 * 40×60 drawing), so the trained muscle fills the icon instead of a whole
 * small figure. Total body is the only one that shows the full figure.
 */
const CROP: Record<SpotFocus, [number, number, number]> = {
  chest: [8, 6, 24],
  shoulders: [6, 3, 28],
  back: [8, 8, 24],
  arms: [4, 9, 32],
  core: [11, 15, 18],
  glutes: [11, 28.5, 18],
  legs: [9, 36.5, 22],
  total: [-10, 0, 60],
  functional: [8, 15, 24],
  cross: [2, 13, 36],
  hiit: [6, 16, 28],
};

// viewBox 0 0 40 60. The body outline in one closed path, left half then its mirror.
const BODY =
  'M18.3 10.4C16.6 11.1 14.6 11.5 13.1 12.4C11.5 13.4 11.1 15.5 10.9 18L9.5 32.4Q9.6 33.9 11.1 33.4L12.9 20.6L14.3 19.2' +
  'C14.6 24 14 28 14.4 32.8L15.2 56.6Q15.4 57.9 16.6 57.9H17.9Q18.8 57.9 18.9 57L19.4 38.4Q19.6 37.2 20 37.2' +
  'Q20.4 37.2 20.6 38.4L21.1 57Q21.2 57.9 22.1 57.9H23.4Q24.6 57.9 24.8 56.6L25.6 32.8C26 28 25.4 24 25.7 19.2' +
  'L27.1 20.6L28.9 33.4Q30.4 33.9 30.5 32.4L29.1 18C28.9 15.5 28.5 13.4 26.9 12.4C25.4 11.5 23.4 11.1 21.7 10.4Z';

/** The filled zone of each muscle goal, inside the outline. */
function Zone({ focus, fill }: { focus: SpotFocus; fill: string }) {
  switch (focus) {
    case 'glutes':
      return (
        <>
          <Ellipse cx={17.5} cy={34.6} rx={2.3} ry={2} fill={fill} />
          <Ellipse cx={22.5} cy={34.6} rx={2.3} ry={2} fill={fill} />
        </>
      );
    case 'legs':
      return (
        <>
          <Ellipse cx={17.3} cy={44.5} rx={1.7} ry={5.2} fill={fill} />
          <Ellipse cx={22.7} cy={44.5} rx={1.7} ry={5.2} fill={fill} />
        </>
      );
    case 'chest':
      return (
        <>
          <Ellipse cx={17.4} cy={16} rx={2.4} ry={1.8} fill={fill} />
          <Ellipse cx={22.6} cy={16} rx={2.4} ry={1.8} fill={fill} />
        </>
      );
    case 'back':
      return <Path d="M15.6 15.2H24.4L22.6 25.5Q20 27 17.4 25.5Z" fill={fill} />;
    case 'shoulders':
      return (
        <>
          <Circle cx={13.9} cy={14.4} r={1.9} fill={fill} />
          <Circle cx={26.1} cy={14.4} r={1.9} fill={fill} />
        </>
      );
    case 'arms':
      return (
        <>
          <Ellipse cx={11.7} cy={22.5} rx={1} ry={3.2} fill={fill} transform="rotate(8 11.7 22.5)" />
          <Ellipse cx={28.3} cy={22.5} rx={1} ry={3.2} fill={fill} transform="rotate(-8 28.3 22.5)" />
        </>
      );
    case 'core':
      return <Rect x={17.6} y={20.2} width={4.8} height={9.6} rx={2} fill={fill} />;
    default:
      return null;
  }
}

export function FocusGlyph({ focus, size = 50, line, accent }: { focus: SpotFocus; size?: number; line: string; accent: string }) {
  const [cx, cy, side] = CROP[focus];
  const viewBox = `${cx} ${cy} ${side} ${side}`;
  const common = {
    stroke: line,
    strokeWidth: (LINE_PT * side) / size,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (focus === 'functional' || focus === 'cross' || focus === 'hiit') {
    return (
      <View style={{ width: size, height: size, overflow: 'hidden' }}>
        <Svg width={size} height={size} viewBox={viewBox}>
          {focus === 'functional' ? (
            <>
              <Path d="M14.6 28.4C13.6 26.6 13.3 25 13.3 23.8a6.7 4.6 0 0 1 13.4 0c0 1.2-.3 2.8-1.3 4.6" fill="none" {...common} />
              <Circle cx={20} cy={33.2} r={7.6} fill="none" {...common} />
              <Circle cx={20} cy={33.2} r={2.6} fill={accent} />
            </>
          ) : focus === 'cross' ? (
            <>
              <Path d="M4 30h32" fill="none" {...common} />
              <Rect x={8} y={23} width={3.6} height={14} rx={1.6} fill={accent} />
              <Rect x={28.4} y={23} width={3.6} height={14} rx={1.6} fill={accent} />
              <Rect x={12.6} y={25.5} width={2.4} height={9} rx={1.2} fill="none" {...common} />
              <Rect x={25} y={25.5} width={2.4} height={9} rx={1.2} fill="none" {...common} />
            </>
          ) : (
            <>
              <Path d="M17.5 17.5h5M20 17.5v3" fill="none" {...common} />
              <Circle cx={20} cy={32} r={11} fill="none" {...common} />
              <Path d="M21.3 24.8 16.6 32.6h3.8l-1.3 6.6 4.7-7.8H20z" fill={accent} />
            </>
          )}
        </Svg>
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }}>
      <Svg width={size} height={size} viewBox={viewBox}>
        {focus === 'total' ? <Path d={BODY} fill={accent} opacity={0.35} /> : null}
        <Zone focus={focus} fill={accent} />
        <Circle cx={20} cy={5.8} r={3.4} fill="none" {...common} />
        <Path d={BODY} fill="none" {...common} />
      </Svg>
    </View>
  );
}
