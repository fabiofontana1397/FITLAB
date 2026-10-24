import { ShaderGradient, ShaderGradientCanvas } from 'shadergradient';

import { Brand } from '@/constants/theme';

/**
 * The shader-gradient layer of the coach orb. Web only, and loaded through
 * `lazy()` from coach-orb.web.tsx — importing this module is what pulls in
 * three.js, so nothing else may import it directly.
 *
 * The gradient is a slowly turning sphere in the brand oranges, which is
 * the same thing the hand-drawn orb underneath is approximating: three warm
 * fields drifting inside a ball. `shadergradient` takes its whole
 * configuration as a URL (the format its own editor emits), so the colours
 * are interpolated from the Brand ramp rather than written twice.
 */
const [deep, mid, bright] = Brand.orbWarm;

const GRADIENT_URL =
  'https://www.shadergradient.co/customize' +
  '?animate=on' +
  '&axesHelper=off' +
  '&brightness=1.3' +
  // A plane rather than a sphere: the orb is already a circle (its parent
  // clips to one), and a sphere draws its own silhouette inside that circle,
  // leaving a visible hard edge. A plane fills the frame edge to edge, so
  // what shows through the circular mask is pure gradient.
  '&cAzimuthAngle=180&cDistance=3.6&cPolarAngle=90&cameraZoom=9.5' +
  `&color1=${encodeURIComponent(bright)}` +
  `&color2=${encodeURIComponent(mid)}` +
  `&color3=${encodeURIComponent(deep)}` +
  '&embedMode=off&envPreset=city&format=gif&fov=45&frameRate=10' +
  '&grain=off&lightType=env&pixelDensity=1' +
  '&positionX=0&positionY=0&positionZ=0' +
  '&rotationX=50&rotationY=0&rotationZ=-60' +
  '&range=disabled&rangeEnd=40&rangeStart=0' +
  '&reflection=0.1' +
  '&shader=defaults&type=plane' +
  '&uDensity=1.8&uFrequency=5.5&uSpeed=0.18&uStrength=4.2&uTime=0' +
  '&wireframe=false';

export default function CoachOrbShader({ size }: { size: number }) {
  return (
    <ShaderGradientCanvas
      pixelDensity={1}
      style={{ width: size, height: size, pointerEvents: 'none' }}>
      <ShaderGradient control="query" urlString={GRADIENT_URL} />
    </ShaderGradientCanvas>
  );
}
