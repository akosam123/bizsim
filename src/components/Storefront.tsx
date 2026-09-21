import React from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { businessOf } from '../game/config';
import { BusinessId, LocationId } from '../game/types';

interface Props {
  business: BusinessId;
  location: LocationId;
  storeTier: number;      // 1-3
  crowd: number;          // 0-1 how busy it looks
  reputation: number;     // 0-100
  width: number;
  /** hide the baked-in sidewalk figures (animated Walkers overlay them instead) */
  hideCustomers?: boolean;
}

const PALETTE = {
  sky: '#8ecbe8',
  skyHigh: '#a7b8d8',
  ground: '#9aa76a',
  road: '#6b6f76',
  wallBase: ['#c9b8a3', '#d9c9ae', '#e8ddc4'], // nicer walls per tier
};

function Customer({ x, y, tone }: { x: number; y: number; tone: string }) {
  return (
    <G>
      <Circle cx={x} cy={y - 10} r={4} fill={tone} />
      <Rect x={x - 3.5} y={y - 6} width={7} height={12} rx={3} fill={tone} />
    </G>
  );
}

/** Background scenery that changes with population density. */
function Backdrop({ location }: { location: LocationId }) {
  if (location === 'low') {
    return (
      <G>
        {/* rolling hills and trees */}
        <Ellipse cx={60} cy={150} rx={120} ry={40} fill="#a8b878" />
        <Ellipse cx={340} cy={155} rx={140} ry={45} fill="#98aa68" />
        {[30, 330, 370].map((x, i) => (
          <G key={i}>
            <Rect x={x - 2} y={118} width={4} height={14} fill="#7a5a3a" />
            <Circle cx={x} cy={112} r={12} fill="#5d7d46" />
          </G>
        ))}
      </G>
    );
  }
  if (location === 'average') {
    return (
      <G>
        {/* neighbor houses */}
        {[10, 300].map((x, i) => (
          <G key={i}>
            <Rect x={x} y={110} width={64} height={48} fill="#c7a98c" />
            <Polygon points={`${x - 6},110 ${x + 32},88 ${x + 70},110`} fill="#8c5a44" />
            <Rect x={x + 12} y={126} width={14} height={14} fill="#eee8c8" />
            <Rect x={x + 38} y={126} width={14} height={14} fill="#eee8c8" />
          </G>
        ))}
      </G>
    );
  }
  return (
    <G>
      {/* downtown skyline */}
      {[
        { x: 0, w: 46, h: 105 }, { x: 50, w: 34, h: 130 }, { x: 88, w: 42, h: 90 },
        { x: 296, w: 40, h: 120 }, { x: 340, w: 34, h: 95 }, { x: 378, w: 42, h: 135 },
      ].map((b, i) => (
        <G key={i}>
          <Rect x={b.x} y={158 - b.h} width={b.w} height={b.h} fill={i % 2 ? '#7d8aa5' : '#8c99b5'} />
          {Array.from({ length: Math.floor(b.h / 22) }).map((_, r) =>
            Array.from({ length: 2 }).map((_, c) => (
              <Rect key={`${r}-${c}`} x={b.x + 8 + c * 16} y={166 - b.h + r * 22} width={8} height={10}
                fill={(r + c + i) % 3 ? '#f4e9b8' : '#5a6478'} />
            ))
          )}
        </G>
      ))}
    </G>
  );
}

/** Business-specific sign artwork. */
function SignArt({ business, cx, cy }: { business: BusinessId; cx: number; cy: number }) {
  if (business === 'restaurant') {
    return (
      <G>
        {/* fork + knife */}
        <Line x1={cx - 8} y1={cy - 7} x2={cx - 8} y2={cy + 7} stroke="#fff" strokeWidth={2} />
        <Line x1={cx - 11} y1={cy - 7} x2={cx - 11} y2={cy - 2} stroke="#fff" strokeWidth={1.6} />
        <Line x1={cx - 5} y1={cy - 7} x2={cx - 5} y2={cy - 2} stroke="#fff" strokeWidth={1.6} />
        <Path d={`M ${cx + 7} ${cy - 7} q 4 4 0 8 l 0 6`} stroke="#fff" strokeWidth={2} fill="none" />
      </G>
    );
  }
  if (business === 'coffee') {
    return (
      <G>
        <Path d={`M ${cx - 7} ${cy - 4} h 12 v 7 a 6 6 0 0 1 -12 0 z`} fill="#fff" />
        <Path d={`M ${cx + 5} ${cy - 2} a 4 4 0 0 1 0 7`} stroke="#fff" strokeWidth={2} fill="none" />
        <Path d={`M ${cx - 4} ${cy - 7} q 2 -3 0 -5 M ${cx + 1} ${cy - 7} q 2 -3 0 -5`} stroke="#fff" strokeWidth={1.4} fill="none" />
      </G>
    );
  }
  if (business === 'bakery') {
    return (
      <G>
        {/* croissant crescent */}
        <Path d={`M ${cx - 8} ${cy + 3} a 9 9 0 0 1 16 0 a 7 5 0 0 0 -16 0`} fill="#fff" />
        <Path d={`M ${cx - 4} ${cy - 3} v 5 M ${cx} ${cy - 4.5} v 6 M ${cx + 4} ${cy - 3} v 5`} stroke="#e8a94a" strokeWidth={1.3} />
      </G>
    );
  }
  if (business === 'barber') {
    return (
      <G>
        {/* barber pole */}
        <Rect x={cx - 3.5} y={cy - 8} width={7} height={16} rx={3} fill="#fff" />
        <Path d={`M ${cx - 3.5} ${cy - 5} l 7 3 M ${cx - 3.5} ${cy - 1} l 7 3 M ${cx - 3.5} ${cy + 3} l 7 3`} stroke="#e05b4b" strokeWidth={2} />
        <Circle cx={cx} cy={cy - 9} r={2} fill="#e8c86a" />
      </G>
    );
  }
  return (
    <SvgText x={cx} y={cy + 5} fontSize={13} fontWeight="bold" fill="#fff" textAnchor="middle">24</SvgText>
  );
}

export default function Storefront({ business, location, storeTier, crowd, reputation, width, hideCustomers }: Props) {
  const biz = businessOf(business);
  const safeWidth = Math.max(240, width); // window dims can read 0 for a frame
  const height = safeWidth * 0.55;
  const wall = PALETTE.wallBase[storeTier - 1];
  const nCustomers = Math.round(crowd * 8);
  const tones = ['#3f5570', '#7a4b5e', '#4c6b4f', '#8a6a3d', '#54497a', '#356b6e', '#6e4632', '#5a5a5a'];
  const sparkle = reputation >= 75;

  return (
    <Svg width={safeWidth} height={height} viewBox="0 0 420 231">
      {/* sky + ground */}
      <Rect x={0} y={0} width={420} height={158} fill={location === 'high' ? PALETTE.skyHigh : PALETTE.sky} />
      <Circle cx={370} cy={34} r={16} fill="#ffe9a3" />
      <Circle cx={370} cy={34} r={22} fill="#ffe9a3" opacity={0.25} />
      {/* clouds */}
      <G fill="#ffffff" opacity={0.85}>
        <Ellipse cx={84} cy={38} rx={28} ry={10} />
        <Ellipse cx={108} cy={31} rx={18} ry={8} />
        <Ellipse cx={62} cy={32} rx={14} ry={7} />
        <Ellipse cx={248} cy={20} rx={22} ry={8} />
        <Ellipse cx={268} cy={26} rx={15} ry={6} />
      </G>
      {/* birds */}
      <G stroke="#4a5568" strokeWidth={1.6} fill="none" opacity={0.7}>
        <Path d="M 158 52 q 4 -4 8 0 q 4 -4 8 0" />
        <Path d="M 186 44 q 3 -3 6 0 q 3 -3 6 0" />
      </G>
      <Rect x={0} y={158} width={420} height={73} fill={location === 'low' ? PALETTE.ground : PALETTE.road} />
      <Backdrop location={location} />
      {/* sidewalk */}
      <Rect x={0} y={158} width={420} height={26} fill="#b9bcc2" />
      <Line x1={0} y1={162} x2={420} y2={162} stroke="#ffffff40" strokeWidth={1.5} />
      {[60, 150, 240, 330].map((x) => (
        <Line key={x} x1={x} y1={162} x2={x - 8} y2={184} stroke="#9da0a6" strokeWidth={1.5} />
      ))}
      {/* road lane markings */}
      {location !== 'low' && [0, 1, 2, 3, 4, 5].map((i) => (
        <Rect key={i} x={12 + i * 74} y={206} width={36} height={5} rx={2.5} fill="#f4e9c8" opacity={0.5} />
      ))}
      {location === 'low' && (
        <G>
          {/* wildflowers in the grass */}
          {[30, 96, 350, 396].map((x, i) => (
            <G key={x}>
              <Line x1={x} y1={214} x2={x} y2={204} stroke="#5d7d46" strokeWidth={2} />
              <Circle cx={x} cy={201} r={3.5} fill={['#e8c86a', '#e05b4b', '#c2588a', '#e8c86a'][i]} />
            </G>
          ))}
        </G>
      )}

      {/* the store */}
      <G>
        <Rect x={130} y={78} width={160} height={82} fill={wall} stroke="#8a7f6d" strokeWidth={1.5} />
        {/* roofline / parapet grows fancier with tier */}
        <Rect x={124} y={70} width={172} height={12} fill={biz.accent} rx={2} />
        {storeTier >= 3 && <Rect x={124} y={62} width={172} height={6} fill="#e8c86a" rx={2} />}

        {/* sign */}
        <Rect x={150} y={84} width={120} height={24} rx={4} fill={biz.accent} />
        <SignArt business={business} cx={188} cy={96} />
        <SvgText x={230} y={100} fontSize={11} fontWeight="bold" fill="#fff" textAnchor="middle">
          {biz.name.split(' ')[0].toUpperCase()}
        </SvgText>

        {/* awning appears at tier 2+ */}
        {storeTier >= 2 && (
          <G>
            {Array.from({ length: 8 }).map((_, i) => (
              <Path key={i} d={`M ${134 + i * 19} 112 h 19 l -3 10 h -13 z`} fill={i % 2 ? '#fff' : biz.accent} />
            ))}
          </G>
        )}

        {/* window: you can see the lit shop inside */}
        <Rect x={142} y={118} width={78} height={36} fill="#4a4038" />
        <Rect x={142} y={118} width={78} height={36} fill="#f4d9a0" opacity={0.18 + crowd * 0.4} />
        {/* display shelf with goods in the window */}
        <Rect x={146} y={136} width={70} height={3} fill="#00000045" />
        {[0, 1, 2, 3].map((i) => (
          <Circle key={i} cx={154 + i * 18} cy={131} r={4}
            fill={['#e05b4b', '#e8c86a', '#7a9c8e', '#d9995b'][i]} opacity={0.95} />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <Rect key={i} x={150 + i * 18} y={142} width={8} height={9} rx={2}
            fill={['#d9995b', '#3d9be9', '#e8c86a', '#c2588a'][i]} opacity={0.9} />
        ))}
        <Rect x={142} y={118} width={78} height={36} fill="#cfe6ef" opacity={0.16} />
        <Path d="M 148 154 l 20 -36 l 10 0 l -20 36 z" fill="#ffffff" opacity={0.18} />
        <Rect x={142} y={118} width={78} height={36} fill="none" stroke="#7d8894" strokeWidth={2.5} />
        <Line x1={181} y1={118} x2={181} y2={154} stroke="#7d8894" strokeWidth={1.5} />
        {/* OPEN sign */}
        <Rect x={146} y={121} width={22} height={9} rx={2} fill="#1e3a2a" />
        <Line x1={149} y1={125.5} x2={165} y2={125.5} stroke="#7ee8a2" strokeWidth={2.2} strokeLinecap="round" />
        {/* the door, with its own little window */}
        <Rect x={236} y={116} width={34} height={44} rx={3} fill="#6d4c33" />
        <Rect x={241} y={121} width={24} height={18} rx={2} fill="#f4d9a0" opacity={0.55} />
        <Rect x={241} y={121} width={24} height={18} rx={2} fill="none" stroke="#54391f" strokeWidth={2} />
        <Circle cx={263} cy={144} r={2.2} fill="#e8c86a" />
        <Rect x={234} y={160} width={38} height={4} rx={2} fill="#00000025" />
        {/* hanging bracket sign */}
        <Line x1={292} y1={90} x2={310} y2={90} stroke="#5d554c" strokeWidth={2.5} />
        <Line x1={306} y1={90} x2={306} y2={96} stroke="#5d554c" strokeWidth={2} />
        <Rect x={296} y={96} width={20} height={20} rx={4} fill={biz.accent} stroke="#00000030" strokeWidth={1.5} />
        <Circle cx={306} cy={106} r={5.5} fill="#ffffff" opacity={0.9} />

        {/* tier-3 flourish: planters + string lights */}
        {storeTier >= 3 && (
          <G>
            <Rect x={128} y={148} width={12} height={12} fill="#7a5a3a" />
            <Circle cx={134} cy={144} r={7} fill="#5d7d46" />
            <Rect x={280} y={148} width={12} height={12} fill="#7a5a3a" />
            <Circle cx={286} cy={144} r={7} fill="#5d7d46" />
            <Path d="M 130 76 q 40 14 80 8 q 40 -6 80 8" stroke="#e8c86a" strokeWidth={1.4} fill="none" />
            {[150, 175, 200, 225, 250, 270].map((x, i) => (
              <Circle key={i} cx={x} cy={82 + (i % 2) * 4} r={2} fill="#ffe9a3" />
            ))}
          </G>
        )}

        {/* reputation sparkle */}
        {sparkle && (
          <G>
            <SvgText x={300} y={78} fontSize={14} fill="#ffdd55">✦</SvgText>
            <SvgText x={116} y={92} fontSize={10} fill="#ffdd55">✦</SvgText>
          </G>
        )}
      </G>

      {/* customers on the sidewalk — count scales with how busy you are */}
      {!hideCustomers && Array.from({ length: nCustomers }).map((_, i) => {
        const x = 60 + ((i * 47) % 300) + (i % 3) * 8;
        const y = 172 + (i % 2) * 7;
        return <Customer key={i} x={x} y={y} tone={tones[i % tones.length]} />;
      })}
      {!hideCustomers && nCustomers === 0 && (
        <SvgText x={210} y={200} fontSize={11} fill="#3c3f45" textAnchor="middle" opacity={0.7}>
          …it's quiet out here
        </SvgText>
      )}
    </Svg>
  );
}
