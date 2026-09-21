import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { CharacterLook, Mood } from '../game/cast';
import { gradId, shade } from './color';

/**
 * Parametric character heads + bust portraits. The Head group is shared
 * with the full-body CharacterSprite so faces stay identical everywhere.
 * Expressions are swapped brows + mouth; blink and mouthOpen let sprites
 * blink and lip-flap while talking.
 */

interface HeadProps {
  look: CharacterLook;
  mood: Mood;
  blink?: boolean;
  mouthOpen?: boolean;
}

/** Head, hair, face, and head-level accessories, drawn in the 120×110 head zone. */
export function Head({ look, mood, blink, mouthOpen }: HeadProps) {
  const { skin, hair, hairColor, accessory } = look;
  const skinFill = `url(#${gradId('sk', skin)})`;
  const hairFill = `url(#${gradId('hr', hairColor)})`;
  return (
    <G>
      <Defs>
        {/* sphere-shaded skin: key light upper-left, soft falloff lower-right */}
        <RadialGradient id={gradId('sk', skin)} cx="42%" cy="34%" r="80%">
          <Stop offset="0" stopColor={shade(skin, 0.22)} />
          <Stop offset="0.55" stopColor={skin} />
          <Stop offset="1" stopColor={shade(skin, -0.24)} />
        </RadialGradient>
        <LinearGradient id={gradId('hr', hairColor)} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={shade(hairColor, 0.3)} />
          <Stop offset="0.45" stopColor={hairColor} />
          <Stop offset="1" stopColor={shade(hairColor, -0.3)} />
        </LinearGradient>
      </Defs>
      {/* ears with inner detail */}
      <Circle cx={26} cy={62} r={5.5} fill={skinFill} stroke="#00000022" strokeWidth={1.5} />
      <Circle cx={94} cy={62} r={5.5} fill={skinFill} stroke="#00000022" strokeWidth={1.5} />
      <Path d="M 25 60 q 3 2 1 5 M 95 60 q -3 2 -1 5" stroke="#00000030" strokeWidth={1.3} fill="none" />
      {/* head */}
      <Ellipse cx={60} cy={60} rx={35} ry={38} fill={skinFill} stroke="#00000018" strokeWidth={2} />
      {/* rim light on the shadow side */}
      <Path d="M 88 36 q 10 22 -2 48 q 10 -26 -2 -48 z" fill="#ffffff30" />
      {/* soft cheek shading */}
      <Path d="M 30 74 q 8 16 30 18 q -20 4 -30 -6 z" fill="#00000010" />

      {/* hair styles */}
      {hair === 'short' && <Path d="M 25 55 q 0 -33 35 -33 q 35 0 35 33 q 0 -14 -8 -18 q -4 6 -27 6 q -23 0 -27 -6 q -8 4 -8 18 z" fill={hairFill} />}
      {hair === 'curly' && (
        <G fill={hairFill}>
          <Circle cx={35} cy={33} r={12} /><Circle cx={52} cy={26} r={13} /><Circle cx={70} cy={26} r={13} />
          <Circle cx={86} cy={33} r={12} /><Circle cx={27} cy={46} r={9} /><Circle cx={93} cy={46} r={9} />
        </G>
      )}
      {hair === 'bun' && (
        <G fill={hairFill}>
          <Circle cx={60} cy={18} r={11} />
          <Path d="M 25 58 q 0 -32 35 -32 q 35 0 35 32 q 0 -12 -9 -16 q -6 5 -26 5 q -20 0 -26 -5 q -9 4 -9 16 z" />
        </G>
      )}
      {hair === 'long' && (
        <Path d="M 25 55 q 0 -33 35 -33 q 35 0 35 33 l 2 45 q -8 8 -14 4 l -2 -40 q -14 8 -42 0 l -2 40 q -6 4 -14 -4 z" fill={hairFill} />
      )}
      {hair === 'cap' && (
        <G>
          <Path d="M 25 50 q 0 -30 35 -30 q 35 0 35 30 l 0 4 l -70 0 z" fill={hairFill} />
          <Rect x={20} y={50} width={80} height={7} rx={3.5} fill={hairFill} opacity={0.85} />
        </G>
      )}
      {hair === 'bald' && <Path d="M 27 45 q 5 -20 33 -20 q 28 0 33 20 q -10 -8 -33 -8 q -23 0 -33 8 z" fill={skin} opacity={0.5} />}
      {hair === 'ponytail' && (
        <G fill={hairFill}>
          <Path d="M 25 55 q 0 -33 35 -33 q 35 0 35 33 q 0 -14 -8 -18 q -4 6 -27 6 q -23 0 -27 -6 q -8 4 -8 18 z" />
          <Path d="M 90 40 q 16 10 10 44 q -4 10 -10 2 q 4 -26 -6 -38 z" />
        </G>
      )}

      {/* hardhat sits on top of everything */}
      {accessory === 'hardhat' && (
        <G>
          <Path d="M 27 44 q 0 -26 33 -26 q 33 0 33 26 l 0 3 l -66 0 z" fill="#e8b830" />
          <Rect x={21} y={45} width={78} height={7} rx={3.5} fill="#d0a01e" />
          <Rect x={55} y={18} width={10} height={10} rx={3} fill="#e8b830" />
        </G>
      )}

      {/* hair sheen + forehead specular — the CGI glint */}
      {hair !== 'bald' && hair !== 'cap' && (
        <Path d="M 36 34 q 10 -13 30 -13 q 8 0 14 3 q -18 -2 -30 4 q -9 4 -14 6 z" fill="#ffffff" opacity={0.16} />
      )}
      <Ellipse cx={47} cy={47} rx={11} ry={5} fill="#ffffff" opacity={0.09} />
      <Face mood={mood} blink={blink} mouthOpen={mouthOpen} />

      {accessory === 'glasses' && (
        <G stroke="#2c2c34" strokeWidth={2.4} fill="none">
          <Circle cx={46} cy={62} r={9} />
          <Circle cx={74} cy={62} r={9} />
          <Line x1={55} y1={62} x2={65} y2={62} />
        </G>
      )}
    </G>
  );
}

function Face({ mood, blink, mouthOpen }: { mood: Mood; blink?: boolean; mouthOpen?: boolean }) {
  const brows: Record<Mood, React.ReactElement> = {
    neutral: (
      <G stroke="#2c2c34" strokeWidth={2.6} strokeLinecap="round">
        <Line x1={39} y1={51} x2={52} y2={51} />
        <Line x1={68} y1={51} x2={81} y2={51} />
      </G>
    ),
    happy: (
      <G stroke="#2c2c34" strokeWidth={2.6} strokeLinecap="round" fill="none">
        <Path d="M 39 52 q 6.5 -5 13 0" />
        <Path d="M 68 52 q 6.5 -5 13 0" />
      </G>
    ),
    worried: (
      <G stroke="#2c2c34" strokeWidth={2.6} strokeLinecap="round">
        <Line x1={39} y1={49} x2={52} y2={53} />
        <Line x1={68} y1={53} x2={81} y2={49} />
      </G>
    ),
    stern: (
      <G stroke="#2c2c34" strokeWidth={3} strokeLinecap="round">
        <Line x1={39} y1={53} x2={52} y2={49} />
        <Line x1={68} y1={49} x2={81} y2={53} />
      </G>
    ),
  };
  const mouths: Record<Mood, React.ReactElement> = {
    neutral: <Line x1={53} y1={81} x2={67} y2={81} stroke="#2c2c34" strokeWidth={2.6} strokeLinecap="round" />,
    happy: <Path d="M 50 79 q 10 9 20 0" stroke="#2c2c34" strokeWidth={2.6} fill="none" strokeLinecap="round" />,
    worried: <Path d="M 52 84 q 8 -6 16 0" stroke="#2c2c34" strokeWidth={2.6} fill="none" strokeLinecap="round" />,
    stern: <Line x1={52} y1={82} x2={68} y2={82} stroke="#2c2c34" strokeWidth={3.2} strokeLinecap="round" />,
  };
  return (
    <G>
      {brows[mood]}
      {blink ? (
        <G stroke="#2c2c34" strokeWidth={2.4} strokeLinecap="round">
          <Line x1={42} y1={62} x2={50} y2={62} />
          <Line x1={70} y1={62} x2={78} y2={62} />
        </G>
      ) : (
        <G>
          <Circle cx={46} cy={62} r={3.6} fill="#2c2c34" />
          <Circle cx={74} cy={62} r={3.6} fill="#2c2c34" />
          <Circle cx={44.8} cy={60.8} r={1.2} fill="#ffffff" opacity={0.85} />
          <Circle cx={72.8} cy={60.8} r={1.2} fill="#ffffff" opacity={0.85} />
        </G>
      )}
      {/* nose */}
      <Path d="M 59 68 q 3 3.5 0 6" stroke="#00000035" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      {mood === 'happy' && !blink && (
        <G fill="#e08d8d" opacity={0.45}>
          <Circle cx={38} cy={72} r={4} />
          <Circle cx={82} cy={72} r={4} />
        </G>
      )}
      {mouthOpen ? (
        <Ellipse cx={60} cy={81} rx={6.5} ry={4.5} fill="#2c2c34" />
      ) : (
        mouths[mood]
      )}
    </G>
  );
}

/** Bust portrait — HUD chips, setup preview. */
export default function Portrait({ look, mood = 'neutral', size = 96 }: { look: CharacterLook; mood?: Mood; size?: number }) {
  const { skin, clothes, accessory } = look;
  const s = Math.max(48, size);
  return (
    <Svg width={s} height={s * (140 / 120)} viewBox="0 0 120 140">
      <Defs>
        <LinearGradient id={gradId('cl', clothes)} x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={shade(clothes, 0.18)} />
          <Stop offset="0.5" stopColor={clothes} />
          <Stop offset="1" stopColor={shade(clothes, -0.28)} />
        </LinearGradient>
      </Defs>
      <Path d="M 20 140 q 0 -34 40 -34 q 40 0 40 34 z" fill={`url(#${gradId('cl', clothes)})`} />
      {accessory === 'apron' && <Path d="M 40 140 q 0 -26 20 -26 q 20 0 20 26 z" fill="#e9e2d0" opacity={0.9} />}
      {accessory === 'tie' && <Path d="M 57 108 h 6 l -1 6 l 3 16 l -5 6 l -5 -6 l 3 -16 z" fill="#b23a48" />}
      <Rect x={52} y={92} width={16} height={16} rx={5} fill={`url(#${gradId('sk', skin)})`} />
      <Head look={look} mood={mood} />
      {accessory === 'brooch' && <Circle cx={44} cy={116} r={4.5} fill="#e8c86a" />}
    </Svg>
  );
}
