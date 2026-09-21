import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { CharacterLook, Mood } from '../game/cast';
import { gradId, shade } from './color';
import { Head } from './Portrait';

/**
 * A full-body character with a designed silhouette: sloped shoulders,
 * attached arms with cuffs, a tapered torso over a hip block, and proper
 * boots — every major shape carries a soft outline so the figure reads
 * as one piece. Alive by default: blinks, lip-flaps and gestures while
 * `talking`, strides on scissoring legs while `walking`, faces its
 * direction of travel, and stands on a grounding shadow.
 */

interface Props {
  look: CharacterLook;
  mood: Mood;
  talking?: boolean;
  walking?: boolean;
  facing?: 'left' | 'right';
  height?: number;
}

const PANTS = '#3a4052';
const PANTS_SHADE = '#2e3342';
const SHOES = '#23262f';
const OUT = '#00000030';   // soft outline that works over any fill
const OUT_W = 2;

export default function CharacterSprite({ look, mood, talking, walking, facing = 'right', height = 190 }: Props) {
  const { skin, clothes, accessory } = look;
  const [blink, setBlink] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [armUp, setArmUp] = useState(false);
  const [stridePhase, setStridePhase] = useState(0);

  // autonomous blinking
  useEffect(() => {
    let closeId: ReturnType<typeof setTimeout>;
    let openId: ReturnType<typeof setTimeout>;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      closeId = setTimeout(() => {
        setBlink(true);
        openId = setTimeout(() => { setBlink(false); loop(); }, 140);
      }, 2200 + Math.random() * 2600);
    };
    loop();
    return () => { alive = false; clearTimeout(closeId); clearTimeout(openId); };
  }, []);

  // lip-flap + hand gestures while talking
  useEffect(() => {
    if (!talking) { setMouthOpen(false); setArmUp(false); return; }
    const mouthId = setInterval(() => setMouthOpen((m) => !m), 170);
    setArmUp(true);
    const armId = setInterval(() => setArmUp((a) => !a), 900);
    return () => { clearInterval(mouthId); clearInterval(armId); setMouthOpen(false); setArmUp(false); };
  }, [talking]);

  // stride cycle while walking
  useEffect(() => {
    if (!walking) { setStridePhase(0); return; }
    const id = setInterval(() => setStridePhase((p) => (p ? 0 : 1)), 160);
    return () => { clearInterval(id); setStridePhase(0); };
  }, [walking]);

  const holdsProp = accessory === 'clipboard' || accessory === 'phone';
  const w = height * (120 / 240);
  const legA = walking ? (stridePhase ? -7 : 7) : 0;
  const legB = -legA;

  const clothesFill = `url(#${gradId('cl', clothes)})`;
  const pantsFill = `url(#${gradId('pn', PANTS)})`;
  const skinBody = `url(#${gradId('sb', skin)})`;

  return (
    <View style={{ transform: [{ scaleX: facing === 'left' ? -1 : 1 }] }}>
      <Svg width={w} height={height} viewBox="0 0 120 240">
        <Defs>
          <LinearGradient id={gradId('cl', clothes)} x1="0" y1="0" x2="0.3" y2="1">
            <Stop offset="0" stopColor={shade(clothes, 0.18)} />
            <Stop offset="0.5" stopColor={clothes} />
            <Stop offset="1" stopColor={shade(clothes, -0.28)} />
          </LinearGradient>
          <LinearGradient id={gradId('pn', PANTS)} x1="0" y1="0" x2="0.25" y2="1">
            <Stop offset="0" stopColor={shade(PANTS, 0.12)} />
            <Stop offset="1" stopColor={shade(PANTS, -0.3)} />
          </LinearGradient>
          <LinearGradient id={gradId('sb', skin)} x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor={shade(skin, 0.14)} />
            <Stop offset="1" stopColor={shade(skin, -0.16)} />
          </LinearGradient>
        </Defs>
        {/* grounding shadow */}
        <Ellipse cx={60} cy={233} rx={walking ? 30 : 34} ry={5.5} fill="#000000" opacity={0.22} />

        {/* legs — scissor while walking, boots with soles */}
        <G transform={`translate(${legA} 0)`}>
          <Path d="M 45 172 q -1 34 1 46 q 0.5 4 5 4 l 4 0 q 4.5 0 5 -4 q 2 -12 1 -46 z" fill={pantsFill} stroke={OUT} strokeWidth={OUT_W} />
          <Path d="M 44 218 l 0 6 q 0 6 7 6 l 10 0 q 5 0 4 -5 q -0.5 -4 -5 -5 l -3 -2 z" fill={SHOES} stroke={OUT} strokeWidth={OUT_W} />
          <Path d="M 44 228 l 21 1" stroke="#00000040" strokeWidth={1.6} />
          <Ellipse cx={50} cy={222} rx={3.5} ry={1.6} fill="#ffffff28" />
        </G>
        <G transform={`translate(${legB} 0)`}>
          <Path d="M 64 172 q -1 34 1 46 q 0.5 4 5 4 l 4 0 q 4.5 0 5 -4 q 2 -12 1 -46 z" fill={pantsFill} stroke={OUT} strokeWidth={OUT_W} />
          <Path d="M 63 218 l 0 6 q 0 6 7 6 l 10 0 q 5 0 4 -5 q -0.5 -4 -5 -5 l -3 -2 z" fill={SHOES} stroke={OUT} strokeWidth={OUT_W} />
          <Path d="M 63 228 l 21 1" stroke="#00000040" strokeWidth={1.6} />
          <Ellipse cx={69} cy={222} rx={3.5} ry={1.6} fill="#ffffff28" />
        </G>

        {/* hip block ties torso to legs */}
        <Path d="M 42 166 h 36 q 4 0 4 5 l 0 6 h -44 l 0 -6 q 0 -5 4 -5 z" fill={pantsFill} stroke={OUT} strokeWidth={OUT_W} />

        {/* far arm (viewer's left): swings opposite the near leg */}
        <G transform={walking ? `rotate(${legB * 1.2} 38 112)` : undefined}>
          <Path d="M 40 108 q -16 8 -13 54 q 0.5 6 7 5 q 6 -1 5.5 -6 q -1 -28 6 -44 z" fill={clothesFill} stroke={OUT} strokeWidth={OUT_W} />
          <Path d="M 28 156 l 11 2" stroke="#00000028" strokeWidth={2} />
          <Circle cx={33} cy={166} r={6} fill={skinBody} stroke={OUT} strokeWidth={1.5} />
        </G>

        {/* torso: sloped shoulders, gentle waist */}
        <Path d="M 34 172 q -5 -52 8 -62 q 8 -7 18 -7 q 10 0 18 7 q 13 10 8 62 z" fill={clothesFill} stroke={OUT} strokeWidth={OUT_W} />
        {/* side shading + key-light sweep */}
        <Path d="M 70 104 q 18 8 16 68 l -9 0 q 3 -56 -12 -66 z" fill="#00000018" />
        <Path d="M 40 116 q 2 -8 10 -11 q -4 34 -2 62 l -7 0 q -4 -30 -1 -51 z" fill="#ffffff" opacity={0.10} />
        {/* collar */}
        <Path d="M 51 105 l 9 11 l 9 -11" stroke="#00000030" strokeWidth={2.6} fill="none" strokeLinecap="round" />
        {/* buttons (hidden under apron when present) */}
        {accessory !== 'apron' && (
          <G fill="#00000028">
            <Circle cx={60} cy={130} r={2.2} />
            <Circle cx={60} cy={146} r={2.2} />
            <Circle cx={60} cy={162} r={2.2} />
          </G>
        )}

        {/* apron with straps and pocket */}
        {accessory === 'apron' && (
          <G>
            <Path d="M 44 172 q -3 -40 16 -44 q 19 4 16 44 z" fill="#e9e2d0" opacity={0.95} stroke="#00000020" strokeWidth={1.8} />
            <Path d="M 46 134 q 14 7 28 0" stroke="#c9bfa4" strokeWidth={2.2} fill="none" />
            <Path d="M 52 152 h 16 v 12 q -8 3 -16 0 z" fill="#d9d0b8" stroke="#00000015" strokeWidth={1.4} />
            <Path d="M 48 130 l -6 -14 M 72 130 l 6 -14" stroke="#c9bfa4" strokeWidth={2.4} strokeLinecap="round" />
          </G>
        )}
        {accessory === 'tie' && (
          <G>
            <Path d="M 56.5 110 h 7 l -1 7 l 3.5 24 l -6 8 l -6 -8 l 3.5 -24 z" fill="#b23a48" stroke="#00000025" strokeWidth={1.5} />
            <Path d="M 56.5 110 l 3.5 5 l 3.5 -5" stroke="#8f2e39" strokeWidth={2} fill="none" />
          </G>
        )}
        {accessory === 'brooch' && <Circle cx={46} cy={122} r={4.5} fill="#e8c86a" stroke="#00000030" strokeWidth={1.5} />}

        {/* near arm (viewer's right): prop, gesture, or swing */}
        {holdsProp ? (
          <G>
            <Path d="M 80 108 q 16 10 10 44 q -1 6 -7.5 5 q -6 -1 -5.5 -7 q 2 -22 -3 -36 z" fill={clothesFill} stroke={OUT} strokeWidth={OUT_W} />
            {accessory === 'clipboard' && (
              <G>
                <Rect x={66} y={138} width={27} height={34} rx={3} fill="#caa46a" stroke={OUT} strokeWidth={1.6} transform="rotate(-10 80 155)" />
                <Rect x={70} y={143} width={19} height={24} rx={2} fill="#f2ead6" transform="rotate(-10 80 155)" />
                <Path d="M 74 150 l 11 -2 M 75 156 l 10 -2 M 76 162 l 8 -1.5" stroke="#8a8474" strokeWidth={1.4} transform="rotate(-10 80 155)" />
                <Circle cx={79} cy={141} r={3} fill="#8b8b93" />
              </G>
            )}
            {accessory === 'phone' && (
              <G>
                <Rect x={76} y={132} width={16} height={28} rx={4} fill="#22262e" stroke={OUT} strokeWidth={1.5} transform="rotate(16 84 146)" />
                <Rect x={79} y={136} width={10} height={17} rx={1.5} fill="#3d9be9" opacity={0.5} transform="rotate(16 84 146)" />
              </G>
            )}
            <Circle cx={84} cy={162} r={6} fill={skinBody} stroke={OUT} strokeWidth={1.5} />
          </G>
        ) : armUp && !walking ? (
          <G>
            <Path d="M 82 110 q 22 0 28 -20 q 2 -8 -5 -9.5 q -7 -1 -9 5 q -4 11 -18 13 z" fill={clothesFill} stroke={OUT} strokeWidth={OUT_W} />
            <Circle cx={108} cy={78} r={6.5} fill={skinBody} stroke={OUT} strokeWidth={1.5} />
          </G>
        ) : (
          <G transform={walking ? `rotate(${legA * 1.2} 82 112)` : undefined}>
            <Path d="M 80 108 q 16 8 13 54 q -0.5 6 -7 5 q -6 -1 -5.5 -6 q 1 -28 -6 -44 z" fill={clothesFill} stroke={OUT} strokeWidth={OUT_W} />
            <Path d="M 81 156 l 11 -2" stroke="#00000028" strokeWidth={2} />
            <Circle cx={87} cy={166} r={6} fill={skinBody} stroke={OUT} strokeWidth={1.5} />
          </G>
        )}

        {/* neck, tapered, with chin shadow */}
        <Path d="M 53 90 h 14 l -1.5 14 q -5.5 3 -11 0 z" fill={skinBody} stroke={OUT} strokeWidth={1.5} />
        <Path d="M 52 100 q 8 5 16 0 l 0 4 q -8 4 -16 0 z" fill="#00000015" />
        <Head look={look} mood={mood} blink={blink} mouthOpen={mouthOpen} />
      </Svg>
    </View>
  );
}
