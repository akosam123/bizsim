import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * The render pass that sells the "lit set" look: a soft key light from
 * above and a vignette pulling the eye to center stage. Sits over the
 * backdrop, under the actors.
 */
export default function SceneLight({ width }: { width: number }) {
  const w = Math.max(240, width);
  const h = w * 0.55;
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={w} height={h}>
      <Defs>
        <LinearGradient id="scn-key" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fff7e0" stopOpacity="0.13" />
          <Stop offset="0.4" stopColor="#fff7e0" stopOpacity="0" />
          <Stop offset="1" stopColor="#101320" stopOpacity="0.10" />
        </LinearGradient>
        <RadialGradient id="scn-vgn" cx="50%" cy="40%" r="78%">
          <Stop offset="0.62" stopColor="#000000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000000" stopOpacity="0.32" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#scn-key)" />
      <Rect x={0} y={0} width={w} height={h} fill="url(#scn-vgn)" />
    </Svg>
  );
}
