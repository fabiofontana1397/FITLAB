import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { Palette } from '@/constants/theme';

export type MeasurementZone = 'shouldersCm' | 'chestCm' | 'bicepsCm' | 'waistCm' | 'hipsCm' | 'thighCm';

const BAND: Record<MeasurementZone, { y: number; height: number }> = {
  shouldersCm: { y: 44, height: 12 },
  chestCm: { y: 52, height: 18 },
  bicepsCm: { y: 68, height: 14 },
  waistCm: { y: 76, height: 16 },
  hipsCm: { y: 96, height: 20 },
  thighCm: { y: 145, height: 22 },
};

export type BodySilhouetteProps = {
  zone: MeasurementZone;
  color: string;
  outlineColor?: string;
  width?: number;
  height?: number;
};

/** A simple, stylized humanoid front-view outline used to show where a measurement is taken. */
export function BodySilhouette({ zone, color, outlineColor = Palette.neutral[300], width = 140, height = 220 }: BodySilhouetteProps) {
  const band = BAND[zone];

  return (
    <Svg width={width} height={height} viewBox="0 0 120 220">
      {/* Head */}
      <Circle cx={60} cy={20} r={15} fill="none" stroke={outlineColor} strokeWidth={3} />
      {/* Neck */}
      <Rect x={53} y={34} width={14} height={10} rx={4} fill="none" stroke={outlineColor} strokeWidth={3} />
      {/* Torso */}
      <Path
        d="M40 46 Q60 40 80 46 L86 108 Q60 120 34 108 Z"
        fill="none"
        stroke={outlineColor}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* Arms */}
      <Path d="M40 48 L20 100 L26 140" fill="none" stroke={outlineColor} strokeWidth={3} strokeLinecap="round" />
      <Path d="M80 48 L100 100 L94 140" fill="none" stroke={outlineColor} strokeWidth={3} strokeLinecap="round" />
      {/* Legs */}
      <Path d="M42 112 L36 205" fill="none" stroke={outlineColor} strokeWidth={3} strokeLinecap="round" />
      <Path d="M78 112 L84 205" fill="none" stroke={outlineColor} strokeWidth={3} strokeLinecap="round" />
      <Path d="M56 116 L52 205" fill="none" stroke={outlineColor} strokeWidth={3} strokeLinecap="round" />
      <Path d="M64 116 L68 205" fill="none" stroke={outlineColor} strokeWidth={3} strokeLinecap="round" />

      {/* Highlighted measurement band */}
      <Rect x={22} y={band.y} width={76} height={band.height} rx={band.height / 2} fill={color} opacity={0.18} />
      <Line x1={16} y1={band.y + band.height / 2} x2={104} y2={band.y + band.height / 2} stroke={color} strokeWidth={2} strokeDasharray="4 4" />
      <Circle cx={16} cy={band.y + band.height / 2} r={3.5} fill={color} />
      <Circle cx={104} cy={band.y + band.height / 2} r={3.5} fill={color} />
    </Svg>
  );
}
