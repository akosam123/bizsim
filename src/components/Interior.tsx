import React from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { BusinessId } from '../game/types';

/**
 * Interior sets, one per business, plus a shared back office for the
 * money scenes. Same flat art language as the street, drawn in the same
 * 420×231 frame so actors stand on the floor line. Store tier dresses
 * the room up: tier 2 adds plants and wall art, tier 3 adds a chandelier
 * or neon.
 */

interface Props {
  business: BusinessId;
  storeTier: number;
  width: number;
  /** 0-1: how busy the room feels (light warmth) */
  crowd: number;
  room?: 'inside' | 'back' | 'office';
}

export default function Interior({ business, storeTier, width, crowd, room = 'inside' }: Props) {
  const safeWidth = Math.max(240, width);
  const height = safeWidth * 0.55;
  return (
    <Svg width={safeWidth} height={height} viewBox="0 0 420 231">
      {room === 'office' ? <Office />
        : room === 'back' ? <BackRoom business={business} />
        : <Room business={business} storeTier={storeTier} crowd={crowd} />}
    </Svg>
  );
}

/* ─────────────────────────── shared props ─────────────────────────── */

function WoodFloor({ color = '#8a6a4a' }: { color?: string }) {
  return (
    <G>
      <Rect x={0} y={172} width={420} height={59} fill={color} />
      {[0, 1, 2].map((r) => (
        <Line key={r} x1={0} y1={186 + r * 15} x2={420} y2={186 + r * 15} stroke="#00000022" strokeWidth={1.5} />
      ))}
      {[40, 130, 220, 310, 390].map((x, i) => (
        <Line key={i} x1={x + (i % 2) * 40} y1={172 + (i % 3) * 15} x2={x + (i % 2) * 40} y2={186 + (i % 3) * 15} stroke="#00000018" strokeWidth={1.5} />
      ))}
    </G>
  );
}

function CheckerFloor() {
  const tiles = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 14; c++) {
      if ((r + c) % 2 === 0) tiles.push(<Rect key={`${r}-${c}`} x={c * 30} y={172 + r * 15} width={30} height={15} fill="#d8d4c8" />);
    }
  }
  return (
    <G>
      <Rect x={0} y={172} width={420} height={59} fill="#3c4250" />
      {tiles}
    </G>
  );
}

function SideWindow({ warm }: { warm: number }) {
  return (
    <G>
      <Rect x={14} y={40} width={58} height={86} rx={4} fill="#a8cde4" />
      <Rect x={14} y={40} width={58} height={86} rx={4} fill="#f4e9c8" opacity={0.15 + warm * 0.2} />
      <Line x1={43} y1={40} x2={43} y2={126} stroke="#5d554c" strokeWidth={3} />
      <Line x1={14} y1={83} x2={72} y2={83} stroke="#5d554c" strokeWidth={3} />
      <Rect x={10} y={36} width={66} height={94} rx={5} fill="none" stroke="#5d554c" strokeWidth={4} />
      {/* light pooling on the floor */}
      <Path d="M 14 172 l 58 0 l 26 32 l -110 0 z" fill="#f4e9c8" opacity={0.06 + warm * 0.08} />
    </G>
  );
}

function MenuBoard({ x, y, w = 88, h = 52, dark = '#3a3430' }: { x: number; y: number; w?: number; h?: number; dark?: string }) {
  return (
    <G>
      <Rect x={x} y={y} width={w} height={h} rx={4} fill={dark} stroke="#c9b898" strokeWidth={3} />
      {[0, 1, 2].map((r) => (
        <G key={r}>
          <Line x1={x + 8} y1={y + 13 + r * 14} x2={x + w * 0.55} y2={y + 13 + r * 14} stroke="#e8dcc0" strokeWidth={2.5} strokeLinecap="round" />
          <Line x1={x + w - 22} y1={y + 13 + r * 14} x2={x + w - 8} y2={y + 13 + r * 14} stroke="#e8c86a" strokeWidth={2.5} strokeLinecap="round" />
        </G>
      ))}
    </G>
  );
}

function Plant({ x, scale = 1 }: { x: number; scale?: number }) {
  return (
    <G transform={`translate(${x} 0) scale(${scale})`}>
      <Path d="M 0 172 q -4 -22 6 -34 q 2 16 0 34 z" fill="#4c6b4f" />
      <Path d="M 4 172 q 10 -20 2 -38 q -10 12 -8 38 z" fill="#5d7d5f" />
      <Path d="M -2 138 q 8 8 6 34 l -2 0 q -8 -18 -4 -34 z" fill="#436046" />
      <Path d="M -8 172 h 20 l -3 22 h -14 z" fill="#a5643f" />
    </G>
  );
}

function WallArt({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Rect x={x} y={y} width={34} height={26} rx={2} fill="#e9e2d0" stroke="#5d554c" strokeWidth={2.5} />
      <Path d={`M ${x + 5} ${y + 18} l 8 -9 l 6 6 l 5 -7 l 5 10 z`} fill="#7a9c8e" />
      <Circle cx={x + 25} cy={y + 8} r={2.5} fill="#e8c86a" />
    </G>
  );
}

function Chandelier({ x }: { x: number }) {
  return (
    <G>
      <Line x1={x} y1={0} x2={x} y2={22} stroke="#4a4038" strokeWidth={2.5} />
      <Path d={`M ${x - 22} 22 h 44 l -8 14 h -28 z`} fill="#e8c86a" opacity={0.9} />
      <Ellipse cx={x} cy={44} rx={26} ry={9} fill="#f4e9c8" opacity={0.25} />
    </G>
  );
}

function PendantLight({ x, len = 30 }: { x: number; len?: number }) {
  return (
    <G>
      <Line x1={x} y1={0} x2={x} y2={len} stroke="#4a4038" strokeWidth={2} />
      <Path d={`M ${x - 10} ${len} h 20 l -5 9 h -10 z`} fill="#d9995b" />
      <Circle cx={x} cy={len + 12} r={3.5} fill="#f4e9c8" />
      <Ellipse cx={x} cy={len + 26} rx={16} ry={5} fill="#f4e9c8" opacity={0.18} />
    </G>
  );
}

/* ─────────────────────────── the rooms ─────────────────────────── */

function Room({ business, storeTier, crowd }: { business: BusinessId; storeTier: number; crowd: number }) {
  switch (business) {
    case 'restaurant': return <Restaurant tier={storeTier} crowd={crowd} />;
    case 'coffee': return <Coffee tier={storeTier} crowd={crowd} />;
    case 'bakery': return <Bakery tier={storeTier} crowd={crowd} />;
    case 'convenience': return <Convenience tier={storeTier} crowd={crowd} />;
    case 'barber': return <Barber tier={storeTier} crowd={crowd} />;
  }
}

function Table({ x, y, cloth = '#b23a48' }: { x: number; y: number; cloth?: string }) {
  return (
    <G>
      <Path d={`M ${x - 30} ${y} h 60 l 6 10 h -72 z`} fill={cloth} />
      <Rect x={x - 36} y={y + 10} width={72} height={5} fill="#00000022" />
      <Rect x={x - 24} y={y + 15} width={6} height={26} fill="#5d4a3a" />
      <Rect x={x + 18} y={y + 15} width={6} height={26} fill="#5d4a3a" />
      {/* place settings */}
      <Ellipse cx={x - 12} cy={y + 4} rx={7} ry={3} fill="#f2ead6" />
      <Ellipse cx={x + 12} cy={y + 4} rx={7} ry={3} fill="#f2ead6" />
      <Rect x={x - 2} y={y - 8} width={4} height={9} rx={2} fill="#e9e2d0" />
    </G>
  );
}

function Restaurant({ tier, crowd }: { tier: number; crowd: number }) {
  return (
    <G>
      <Rect x={0} y={0} width={420} height={172} fill="#8a5a50" />
      <Rect x={0} y={0} width={420} height={62} fill="#7a4b42" />
      <Line x1={0} y1={62} x2={420} y2={62} stroke="#00000030" strokeWidth={3} />
      <WoodFloor />
      <SideWindow warm={crowd} />
      {/* kitchen pass window */}
      <Rect x={296} y={52} width={96} height={54} rx={5} fill="#4a3a32" />
      <Rect x={302} y={58} width={84} height={34} rx={3} fill="#f4d9a0" opacity={0.85} />
      <Rect x={296} y={96} width={96} height={8} fill="#5d4a3a" />
      {/* plated dish waiting at the pass */}
      <Ellipse cx={330} cy={94} rx={11} ry={4} fill="#f2ead6" />
      <Circle cx={330} cy={90} r={5} fill="#c46a4a" />
      {/* steam */}
      <Path d="M 326 82 q 2 -5 -1 -9 M 333 82 q 3 -5 0 -10" stroke="#ffffff88" strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* specials board */}
      <MenuBoard x={112} y={52} />
      {/* dining tables */}
      <Table x={150} y={140} />
      <Table x={260} y={148} cloth="#9c4a3f" />
      {tier >= 2 && <Table x={366} y={140} cloth="#b23a48" />}
      <PendantLight x={150} len={26} />
      <PendantLight x={260} len={34} />
      {tier >= 2 && <Plant x={396} scale={1} />}
      {tier >= 2 && <WallArt x={222} y={30} />}
      {tier >= 3 && <Chandelier x={210} />}
    </G>
  );
}

function Coffee({ tier, crowd }: { tier: number; crowd: number }) {
  return (
    <G>
      <Rect x={0} y={0} width={420} height={172} fill="#6e5643" />
      <Rect x={0} y={0} width={420} height={58} fill="#5d4838" />
      <Line x1={0} y1={58} x2={420} y2={58} stroke="#00000030" strokeWidth={3} />
      <WoodFloor color="#7a5f42" />
      <SideWindow warm={crowd} />
      {/* the bar */}
      <Rect x={230} y={112} width={180} height={14} fill="#4a3a2e" />
      <Rect x={238} y={126} width={164} height={60} fill="#8a6a4a" />
      <Rect x={238} y={126} width={164} height={8} fill="#00000022" />
      {/* espresso machine */}
      <Rect x={254} y={82} width={56} height={32} rx={5} fill="#b23a48" />
      <Rect x={260} y={76} width={44} height={9} rx={3} fill="#8f2e39" />
      <Rect x={264} y={108} width={8} height={9} fill="#3a3430" />
      <Rect x={288} y={108} width={8} height={9} fill="#3a3430" />
      <Circle cx={300} cy={94} r={5} fill="#e8c86a" />
      {/* cups on a shelf */}
      <Rect x={330} y={70} width={72} height={5} fill="#4a3a2e" />
      {[0, 1, 2, 3].map((i) => (
        <Path key={i} d={`M ${336 + i * 18} 58 h 10 v 10 a 5 5 0 0 1 -10 0 z`} fill={['#e9e2d0', '#d9995b', '#7a9c8e', '#e8c86a'][i]} />
      ))}
      {/* pastry jar */}
      <Rect x={366} y={96} width={26} height={18} rx={3} fill="#c8dbe8" opacity={0.75} />
      <Circle cx={374} cy={106} r={5} fill="#d9995b" />
      <Circle cx={384} cy={107} r={4.5} fill="#b07d4f" />
      {/* chalkboard menu */}
      <MenuBoard x={118} y={44} h={58} dark="#2e3a34" />
      {/* stools */}
      {[258, 300, 342].map((x) => (
        <G key={x}>
          <Ellipse cx={x} cy={196} rx={13} ry={5} fill="#5d4a3a" />
          <Rect x={x - 3} y={196} width={6} height={26} fill="#4a3a2e" />
        </G>
      ))}
      {tier >= 2 && <Plant x={210} scale={0.9} />}
      {tier >= 2 && <WallArt x={40} y={20} />}
      {tier >= 3 && (
        <G>
          {/* string lights */}
          <Path d="M 100 12 q 60 22 160 8 q 90 -12 150 6" stroke="#4a4038" strokeWidth={2} fill="none" />
          {[120, 170, 220, 270, 320, 370].map((x, i) => (
            <Circle key={x} cx={x} cy={[24, 29, 26, 22, 25, 29][i]} r={3.5} fill="#f4d9a0" />
          ))}
        </G>
      )}
    </G>
  );
}

function Bakery({ tier, crowd }: { tier: number; crowd: number }) {
  return (
    <G>
      <Rect x={0} y={0} width={420} height={172} fill="#c9b294" />
      <Rect x={0} y={0} width={420} height={56} fill="#b39a7a" />
      <Line x1={0} y1={56} x2={420} y2={56} stroke="#00000022" strokeWidth={3} />
      <WoodFloor color="#9a7a52" />
      <SideWindow warm={crowd} />
      {/* oven with glow */}
      <Rect x={318} y={62} width={84} height={106} rx={6} fill="#5d554c" />
      <Rect x={328} y={76} width={64} height={38} rx={4} fill="#3a3430" />
      <Rect x={334} y={84} width={52} height={24} rx={3} fill="#e8873a" opacity={0.85} />
      <Rect x={334} y={84} width={52} height={24} rx={3} fill="#f4d9a0" opacity={0.35} />
      <Circle cx={338} cy={126} r={4} fill="#e8c86a" />
      <Circle cx={352} cy={126} r={4} fill="#c9b898" />
      <Rect x={328} y={138} width={64} height={22} rx={3} fill="#4a4038" />
      {/* display case full of goods */}
      <Rect x={96} y={110} width={168} height={16} fill="#8a6a4a" />
      <Rect x={104} y={126} width={152} height={62} fill="#c8dbe8" opacity={0.5} />
      <Rect x={104} y={126} width={152} height={62} fill="none" stroke="#8a6a4a" strokeWidth={4} />
      <Line x1={104} y1={156} x2={256} y2={156} stroke="#8a6a4a" strokeWidth={3} />
      {/* top shelf: breads */}
      {[0, 1, 2, 3].map((i) => (
        <Ellipse key={i} cx={124 + i * 36} cy={146} rx={13} ry={7} fill={['#d9995b', '#b07d4f', '#d9995b', '#c98a4b'][i]} />
      ))}
      {/* bottom shelf: pastries */}
      {[0, 1, 2, 3, 4].map((i) => (
        <Circle key={i} cx={120 + i * 30} cy={172} r={6.5} fill={['#e8a94a', '#d9995b', '#e05b4b', '#e8c86a', '#b07d4f'][i]} />
      ))}
      {/* hanging bread shelf */}
      <Rect x={112} y={58} width={120} height={5} fill="#8a6a4a" />
      {[0, 1, 2].map((i) => (
        <Path key={i} d={`M ${126 + i * 38} 46 q 9 -8 18 0 q -9 8 -18 0 z`} fill="#c98a4b" />
      ))}
      <MenuBoard x={252} y={30} w={76} h={44} dark="#4a4038" />
      {/* flour sacks */}
      <Path d="M 30 172 q 0 -26 16 -26 q 16 0 16 26 z" fill="#e9e2d0" />
      <Path d="M 36 148 l 4 -8 l 12 0 l 4 8" fill="none" stroke="#c9b898" strokeWidth={3} />
      {tier >= 2 && <Plant x={286} scale={0.85} />}
      {tier >= 2 && <WallArt x={40} y={16} />}
      {tier >= 3 && <Chandelier x={180} />}
    </G>
  );
}

function Convenience({ tier, crowd }: { tier: number; crowd: number }) {
  const productColors = ['#e05b4b', '#3d9be9', '#e8c86a', '#7a9c8e', '#c2588a', '#d9995b'];
  return (
    <G>
      <Rect x={0} y={0} width={420} height={172} fill="#5a6a78" />
      <Rect x={0} y={0} width={420} height={50} fill="#4c5a66" />
      <Line x1={0} y1={50} x2={420} y2={50} stroke="#00000030" strokeWidth={3} />
      <Rect x={0} y={172} width={420} height={59} fill="#8c9aa5" />
      {[0, 1, 2].map((r) => (
        <Line key={r} x1={0} y1={188 + r * 14} x2={420} y2={188 + r * 14} stroke="#00000015" strokeWidth={1.5} />
      ))}
      <SideWindow warm={crowd} />
      {/* fridge wall with glowing doors */}
      <Rect x={300} y={54} width={110} height={116} rx={5} fill="#3a4450" />
      {[0, 1].map((i) => (
        <G key={i}>
          <Rect x={308 + i * 52} y={62} width={44} height={100} rx={3} fill="#8ecbe8" opacity={0.9} />
          <Rect x={308 + i * 52} y={62} width={44} height={100} rx={3} fill="none" stroke="#2c343e" strokeWidth={3} />
          {[0, 1, 2].map((r) => (
            <G key={r}>
              <Line x1={310 + i * 52} y1={90 + r * 26} x2={350 + i * 52} y2={90 + r * 26} stroke="#2c343e" strokeWidth={2} />
              {[0, 1, 2].map((c) => (
                <Rect key={c} x={313 + i * 52 + c * 13} y={78 + r * 26} width={9} height={11} rx={2} fill={productColors[(r + c + i) % 6]} />
              ))}
            </G>
          ))}
        </G>
      ))}
      {/* gondola shelves */}
      {[70, 180].map((x, aisle) => (
        <G key={x}>
          <Rect x={x} y={92} width={92} height={80} fill="#6e7d8a" />
          <Rect x={x - 4} y={88} width={100} height={7} rx={3} fill="#4c5a66" />
          {[0, 1, 2].map((r) => (
            <G key={r}>
              <Rect x={x} y={112 + r * 20} width={92} height={4} fill="#4c5a66" />
              {[0, 1, 2, 3, 4, 5].map((c) => (
                <Rect key={c} x={x + 5 + c * 15} y={98 + r * 20} width={11} height={13} rx={2} fill={productColors[(r * 2 + c + aisle) % 6]} />
              ))}
            </G>
          ))}
        </G>
      ))}
      {/* register counter */}
      <Rect x={10} y={130} width={44} height={42} fill="#4c5a66" />
      <Rect x={16} y={112} width={22} height={18} rx={2} fill="#3a3430" />
      <Rect x={19} y={116} width={16} height={7} rx={1} fill="#7ee8a2" opacity={0.8} />
      {/* hanging aisle signs */}
      {[100, 210].map((x, i) => (
        <G key={x}>
          <Line x1={x + 16} y1={0} x2={x + 16} y2={26} stroke="#3a4450" strokeWidth={2} />
          <Rect x={x - 8} y={26} width={48} height={16} rx={3} fill={['#e8c86a', '#3d9be9'][i]} />
        </G>
      ))}
      {tier >= 2 && <WallArt x={230} y={14} />}
      {tier >= 3 && (
        <G>
          {/* neon OPEN 24/7 */}
          <Rect x={30} y={12} width={92} height={26} rx={6} fill="none" stroke="#7ee8a2" strokeWidth={3} />
          <Line x1={42} y1={25} x2={62} y2={25} stroke="#7ee8a2" strokeWidth={3.5} strokeLinecap="round" />
          <Line x1={70} y1={25} x2={82} y2={25} stroke="#e05b4b" strokeWidth={3.5} strokeLinecap="round" />
          <Line x1={90} y1={25} x2={110} y2={25} stroke="#7ee8a2" strokeWidth={3.5} strokeLinecap="round" />
        </G>
      )}
    </G>
  );
}

function Barber({ tier, crowd }: { tier: number; crowd: number }) {
  return (
    <G>
      <Rect x={0} y={0} width={420} height={172} fill="#4a5568" />
      <Rect x={0} y={0} width={420} height={54} fill="#3f4859" />
      <Line x1={0} y1={54} x2={420} y2={54} stroke="#00000030" strokeWidth={3} />
      <CheckerFloor />
      <SideWindow warm={crowd} />
      {/* mirror stations */}
      {[170, 300].map((x) => (
        <G key={x}>
          <Rect x={x - 34} y={58} width={68} height={86} rx={6} fill="#c8dbe8" opacity={0.85} />
          <Rect x={x - 34} y={58} width={68} height={86} rx={6} fill="none" stroke="#e8c86a" strokeWidth={4} />
          {/* mirror lights */}
          {[0, 1, 2].map((i) => (
            <Circle key={i} cx={x - 22 + i * 22} cy={52} r={3.5} fill="#f4d9a0" />
          ))}
          {/* counter with bottles */}
          <Rect x={x - 40} y={144} width={80} height={8} rx={3} fill="#5d4a3a" />
          <Rect x={x - 28} y={130} width={7} height={14} rx={2} fill="#7a5fc7" />
          <Rect x={x - 16} y={126} width={7} height={18} rx={2} fill="#3d9be9" />
          <Rect x={x - 4} y={132} width={7} height={12} rx={2} fill="#e8c86a" />
          {/* barber chair */}
          <Rect x={x + 8} y={158} width={34} height={10} rx={4} fill="#b23a48" />
          <Rect x={x + 12} y={130} width={26} height={30} rx={5} fill="#8f2e39" />
          <Rect x={x + 20} y={168} width={8} height={16} fill="#3a3430" />
          <Ellipse cx={x + 24} cy={188} rx={16} ry={5} fill="#3a3430" />
        </G>
      ))}
      {/* indoor pole */}
      <Rect x={392} y={62} width={13} height={54} rx={6} fill="#e9e2d0" />
      <Path d="M 392 72 l 13 6 M 392 88 l 13 6 M 392 104 l 13 6" stroke="#e05b4b" strokeWidth={4} />
      <Circle cx={398} cy={58} r={5} fill="#e8c86a" />
      {/* waiting bench */}
      <Rect x={20} y={150} width={64} height={9} rx={4} fill="#5d4a3a" />
      <Rect x={24} y={159} width={7} height={22} fill="#4a3a2e" />
      <Rect x={72} y={159} width={7} height={22} fill="#4a3a2e" />
      <MenuBoard x={30} y={64} w={70} h={44} dark="#343c4a" />
      {tier >= 2 && <Plant x={120} scale={0.85} />}
      {tier >= 3 && (
        <G>
          {/* neon scissors sign */}
          <Circle cx={250} cy={26} r={16} fill="none" stroke="#c2588a" strokeWidth={3} />
          <Path d="M 243 33 l 14 -14 M 243 19 l 14 14" stroke="#c2588a" strokeWidth={3} strokeLinecap="round" />
        </G>
      )}
    </G>
  );
}

/* ─────────────────────── the back of house ─────────────────────── */

const BACK_GEAR: Record<BusinessId, { gear: string; accent: string }> = {
  restaurant: { gear: 'walkin', accent: '#e05b4b' },
  convenience: { gear: 'freezer', accent: '#3d9be9' },
  coffee: { gear: 'roaster', accent: '#b07d4f' },
  bakery: { gear: 'oven', accent: '#d9995b' },
  barber: { gear: 'cabinet', accent: '#7a5fc7' },
};

function BackRoom({ business }: { business: BusinessId }) {
  const { gear, accent } = BACK_GEAR[business];
  return (
    <G>
      {/* concrete + tile walls */}
      <Rect x={0} y={0} width={420} height={172} fill="#6e7268" />
      <Rect x={0} y={0} width={420} height={64} fill="#61655c" />
      <Line x1={0} y1={64} x2={420} y2={64} stroke="#00000030" strokeWidth={3} />
      <Rect x={0} y={100} width={420} height={5} fill="#ffffff12" />
      <Rect x={0} y={172} width={420} height={59} fill="#7a7d74" />
      {[0, 1, 2].map((r) => (
        <Line key={r} x1={0} y1={188 + r * 14} x2={420} y2={188 + r * 14} stroke="#00000018" strokeWidth={1.5} />
      ))}
      {/* swinging door to the front, with porthole */}
      <Rect x={16} y={58} width={54} height={114} rx={4} fill="#8a8478" />
      <Circle cx={43} cy={92} r={11} fill="#c8dbe8" opacity={0.85} />
      <Circle cx={43} cy={92} r={11} fill="none" stroke="#5d574c" strokeWidth={3} />
      <Rect x={12} y={54} width={62} height={122} rx={5} fill="none" stroke="#5d574c" strokeWidth={4} />
      {/* steel shelving with stock */}
      <Rect x={96} y={62} width={110} height={110} fill="#575b52" />
      {[0, 1, 2].map((r) => (
        <G key={r}>
          <Rect x={92} y={88 + r * 30} width={118} height={5} fill="#4a4e45" />
          {[0, 1, 2].map((c) => (
            <Rect key={c} x={102 + c * 35} y={68 + r * 30} width={28} height={19} rx={2}
              fill={['#b3833c', '#8a8478', '#9c6a4a'][(r + c) % 3]} />
          ))}
        </G>
      ))}
      {/* prep table with cutting board and tools */}
      <Rect x={228} y={122} width={120} height={9} rx={2} fill="#c9cdd4" />
      <Rect x={236} y={131} width={9} height={52} fill="#8a8d94" />
      <Rect x={330} y={131} width={9} height={52} fill="#8a8d94" />
      <Rect x={248} y={114} width={40} height={7} rx={2} fill="#b3833c" />
      <Rect x={300} y={112} width={4} height={10} rx={1} fill="#5d574c" />
      <Rect x={308} y={112} width={4} height={10} rx={1} fill="#5d574c" />
      {/* the business's big gear */}
      {gear === 'walkin' && (
        <G>
          <Rect x={356} y={54} width={58} height={118} rx={4} fill="#9aa3ad" />
          <Rect x={356} y={54} width={58} height={118} rx={4} fill="none" stroke="#6e7680" strokeWidth={4} />
          <Rect x={362} y={100} width={10} height={26} rx={4} fill="#5d646e" />
          <Path d="M 366 60 h 40 M 366 68 h 40" stroke="#6e7680" strokeWidth={2.5} />
        </G>
      )}
      {gear === 'oven' && (
        <G>
          <Rect x={356} y={62} width={56} height={110} rx={5} fill="#5d554c" />
          <Rect x={363} y={74} width={42} height={30} rx={3} fill="#e8873a" opacity={0.9} />
          <Rect x={363} y={112} width={42} height={30} rx={3} fill="#e8873a" opacity={0.55} />
          <Circle cx={370} cy={156} r={4} fill="#e8c86a" />
        </G>
      )}
      {gear === 'roaster' && (
        <G>
          <Rect x={358} y={96} width={52} height={76} rx={5} fill={accent} />
          <Circle cx={384} cy={84} r={20} fill="#8a6a4a" />
          <Circle cx={384} cy={84} r={12} fill="#5d4838" />
          <Rect x={378} y={118} width={12} height={18} rx={3} fill="#3a3430" />
        </G>
      )}
      {gear === 'freezer' && (
        <G>
          <Rect x={352} y={80} width={62} height={92} rx={5} fill="#c9cdd4" />
          <Line x1={352} y1={112} x2={414} y2={112} stroke="#8a8d94" strokeWidth={3} />
          <Rect x={358} y={90} width={12} height={5} rx={2} fill="#8a8d94" />
          <Path d="M 380 130 l 8 0 m -4 -4 l 0 8 m -3 -7 l 6 6 m 0 -6 l -6 6" stroke="#7ab8d9" strokeWidth={2} />
        </G>
      )}
      {gear === 'cabinet' && (
        <G>
          <Rect x={356} y={70} width={56} height={102} rx={4} fill={accent} opacity={0.85} />
          {[0, 1, 2].map((r) => (
            <G key={r}>
              <Rect x={362} y={80 + r * 30} width={44} height={4} fill="#00000030" />
              {[0, 1, 2].map((c) => (
                <Rect key={c} x={364 + c * 15} y={66 + r * 30} width={10} height={16} rx={3}
                  fill={['#3d9be9', '#e8c86a', '#e9e2d0'][(r + c) % 3]} />
              ))}
            </G>
          ))}
        </G>
      )}
      {/* mop + bucket */}
      <Line x1={218} y1={96} x2={210} y2={172} stroke="#8a6a4a" strokeWidth={3.5} />
      <Path d="M 204 172 q 6 12 14 0 z" fill="#c9c4b2" />
      <Path d="M 186 158 h 22 l -3 16 h -16 z" fill="#5d7d8a" />
      {/* clipboard on the wall */}
      <Rect x={244} y={70} width={22} height={30} rx={2} fill="#caa46a" />
      <Rect x={247} y={75} width={16} height={20} rx={1} fill="#f2ead6" />
    </G>
  );
}

/* ─────────────────────────── the back office ─────────────────────────── */

function Office() {
  return (
    <G>
      <Rect x={0} y={0} width={420} height={172} fill="#5d6270" />
      <Rect x={0} y={0} width={420} height={58} fill="#525766" />
      <Line x1={0} y1={58} x2={420} y2={58} stroke="#00000030" strokeWidth={3} />
      <WoodFloor color="#6e5a45" />
      {/* night window */}
      <Rect x={26} y={36} width={72} height={78} rx={4} fill="#2c3654" />
      <Circle cx={78} cy={54} r={9} fill="#f4e9c8" opacity={0.9} />
      <Rect x={22} y={32} width={80} height={86} rx={5} fill="none" stroke="#463f38" strokeWidth={4} />
      <Line x1={62} y1={36} x2={62} y2={114} stroke="#463f38" strokeWidth={3} />
      {/* wall chart — the business, graphed */}
      <Rect x={272} y={30} width={110} height={72} rx={4} fill="#e9e2d0" stroke="#463f38" strokeWidth={3} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Rect key={i} x={284 + i * 18} y={88 - [22, 34, 28, 44, 54][i]} width={12} height={[22, 34, 28, 44, 54][i]} fill={['#7a9c8e', '#7a9c8e', '#c46a4a', '#7a9c8e', '#5d8a6f'][i]} />
      ))}
      <Line x1={280} y1={90} x2={376} y2={90} stroke="#463f38" strokeWidth={2} />
      {/* the desk */}
      <Rect x={120} y={124} width={190} height={12} rx={3} fill="#6e5239" />
      <Rect x={130} y={136} width={12} height={52} fill="#5d4530" />
      <Rect x={288} y={136} width={12} height={52} fill="#5d4530" />
      {/* open ledger */}
      <Path d="M 160 118 l 34 -6 l 0 12 l -34 6 z" fill="#f2ead6" />
      <Path d="M 194 112 l 34 6 l 0 12 l -34 -6 z" fill="#e9e2d0" />
      {[0, 1].map((i) => (
        <Line key={i} x1={166} y1={119 - i * 0 + i * 4} x2={188} y2={115 + i * 4} stroke="#8a8474" strokeWidth={1.5} />
      ))}
      {/* desk lamp */}
      <Rect x={264} y={118} width={20} height={4} rx={2} fill="#3a3430" />
      <Line x1={274} y1={118} x2={268} y2={100} stroke="#3a3430" strokeWidth={3} />
      <Path d="M 258 102 l 16 -6 l 4 10 l -16 6 z" fill="#4c8a5f" />
      <Ellipse cx={252} cy={122} rx={16} ry={5} fill="#f4d9a0" opacity={0.35} />
      {/* coffee mug + calculator */}
      <Rect x={238} y={112} width={11} height={10} rx={2} fill="#b23a48" />
      <Path d="M 249 114 a 4 4 0 0 1 0 7" stroke="#b23a48" strokeWidth={2} fill="none" />
      <Rect x={144} y={116} width={13} height={8} rx={1} fill="#3a3430" />
      {/* filing cabinet */}
      <Rect x={356} y={120} width={44} height={52} rx={3} fill="#6e7d8a" />
      <Rect x={362} y={128} width={32} height={4} rx={2} fill="#4c5a66" />
      <Rect x={362} y={146} width={32} height={4} rx={2} fill="#4c5a66" />
      <Plant x={40} scale={0.9} />
    </G>
  );
}
