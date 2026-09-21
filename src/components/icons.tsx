import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

/**
 * The game's icon set — crisp vector glyphs drawn to one style so the chrome
 * stops leaning on platform emoji. All icons share a 24×24 grid, rounded
 * geometry, and take {size, color}.
 */

interface IconProps { size?: number; color?: string }

const SLATE = '#aeb9dd';

/** bar chart — the books / financials */
export function IconChart({ size = 18, color = SLATE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3.5} y={13} width={4.6} height={7.5} rx={1.6} fill={color} opacity={0.55} />
      <Rect x={9.7} y={8} width={4.6} height={12.5} rx={1.6} fill={color} opacity={0.8} />
      <Rect x={15.9} y={3.5} width={4.6} height={17} rx={1.6} fill={color} />
    </Svg>
  );
}

/** menu board — what customers see */
export function IconMenu({ size = 18, color = SLATE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4.5} y={3} width={15} height={18} rx={2.6} stroke={color} strokeWidth={2} />
      <Path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** speaker with waves */
export function IconSoundOn({ size = 18, color = SLATE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9.5v5a1.5 1.5 0 0 0 1.5 1.5h2.6l4 3.4c.65.55 1.65.1 1.65-.76V5.86c0-.86-1-1.31-1.65-.76l-4 3.4H5.5A1.5 1.5 0 0 0 4 9.5Z" fill={color} />
      <Path d="M16.5 9c.9.7 1.5 1.8 1.5 3s-.6 2.3-1.5 3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M18.8 6.5c1.55 1.3 2.5 3.3 2.5 5.5s-.95 4.2-2.5 5.5" stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
    </Svg>
  );
}

/** speaker, muted */
export function IconSoundOff({ size = 18, color = SLATE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9.5v5a1.5 1.5 0 0 0 1.5 1.5h2.6l4 3.4c.65.55 1.65.1 1.65-.76V5.86c0-.86-1-1.31-1.65-.76l-4 3.4H5.5A1.5 1.5 0 0 0 4 9.5Z" fill={color} opacity={0.6} />
      <Path d="M16.6 9.6l4.8 4.8M21.4 9.6l-4.8 4.8" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** settings cog */
export function IconGear({ size = 18, color = SLATE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((r) => (
          <Rect key={r} x={10.75} y={2} width={2.5} height={5} rx={1.2} fill={color} transform={`rotate(${r} 12 12)`} />
        ))}
      </G>
      <Circle cx={12} cy={12} r={6.2} fill={color} />
      <Circle cx={12} cy={12} r={2.7} fill="#161927" />
    </Svg>
  );
}

/** star — reputation */
export function IconStar({ size = 14, color = '#e8c86a' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 16.9 6.3 20l1.2-6.3L2.8 9.3l6.4-.8L12 2.6Z" fill={color} />
    </Svg>
  );
}

/** four-point sparkle — buzz */
export function IconSpark({ size = 14, color = '#9fd0ff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2c.8 4.4 2.4 6.6 7.5 8-5.1 1.4-6.7 3.6-7.5 8-.8-4.4-2.4-6.6-7.5-8C9.6 8.6 11.2 6.4 12 2Z" fill={color} />
      <Path d="M18.8 15.2c.4 2 1.1 3 3.2 3.7-2.1.7-2.8 1.7-3.2 3.7-.4-2-1.1-3-3.2-3.7 2.1-.7 2.8-1.7 3.2-3.7Z" fill={color} opacity={0.75} />
    </Svg>
  );
}

/** two people — team morale */
export function IconTeam({ size = 14, color = '#5ac47f' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3.6} fill={color} />
      <Path d="M2.5 19.5c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6c0 .8-.65 1-1.45 1H3.95c-.8 0-1.45-.2-1.45-1Z" fill={color} />
      <Circle cx={16.8} cy={8.6} r={2.9} fill={color} opacity={0.55} />
      <Path d="M16.4 13.7c3 .3 5.1 2.3 5.1 5 0 .7-.55.9-1.2.9h-2.6c.2-.5.3-1 .3-1.6 0-1.7-.6-3.2-1.6-4.3Z" fill={color} opacity={0.55} />
    </Svg>
  );
}

/** heart — regulars */
export function IconHeart({ size = 14, color = '#e05b4b' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20.4S3.4 15.2 3.4 9.3C3.4 6.4 5.7 4.2 8.4 4.2c1.5 0 2.8.7 3.6 1.8.8-1.1 2.1-1.8 3.6-1.8 2.7 0 5 2.2 5 5.1 0 5.9-8.6 11.1-8.6 11.1Z" fill={color} />
    </Svg>
  );
}

/** street lamp — the street outside */
export function IconStreet({ size = 15, color = SLATE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 20.5h18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 20V7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M12 3.2l3.8 2.2v2.4H8.2V5.4L12 3.2Z" fill={color} />
      <Circle cx={12} cy={6.4} r={1.3} fill="#161927" />
    </Svg>
  );
}

/** shopfront awning — the floor */
export function IconShop({ size = 15, color = SLATE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3.5 4h17l1 4.4c0 1.3-1 2.3-2.4 2.3-1.3 0-2.4-1-2.4-2.3 0 1.3-1 2.3-2.4 2.3-1.3 0-2.3-1-2.3-2.3 0 1.3-1 2.3-2.3 2.3-1.4 0-2.4-1-2.4-2.3 0 1.3-1.1 2.3-2.4 2.3C3.5 10.7 2.5 9.7 2.5 8.4L3.5 4Z" fill={color} />
      <Path d="M4.5 12.5V20h15v-7.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Rect x={13} y={14.5} width={4} height={5.5} rx={0.8} fill={color} opacity={0.7} />
    </Svg>
  );
}

/** stacked boxes — the back room */
export function IconBoxes({ size = 15, color = SLATE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={7} y={3.5} width={8.5} height={8} rx={1.2} stroke={color} strokeWidth={2} />
      <Rect x={3.5} y={12.5} width={8} height={8} rx={1.2} stroke={color} strokeWidth={2} />
      <Rect x={13} y={12.5} width={7.5} height={8} rx={1.2} fill={color} opacity={0.7} />
      <Path d="M11.25 3.5v3" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** lightning bolt — action points */
export function IconBolt({ size = 14, color = '#e8c86a' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M13.4 2.2 5.2 13.3c-.4.55-.02 1.33.66 1.33h4.04l-1.9 6.6c-.2.72.7 1.2 1.2.63l8.6-11.2c.43-.55.04-1.36-.65-1.36h-4.1l1.55-6.4c.17-.72-.72-1.17-1.2-.66Z" fill={color} />
    </Svg>
  );
}

/** heartbeat line — the owner's own tank */
export function IconPulse({ size = 14, color = '#e05b4b' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2.5 12.5h4l2.2-6 3.6 11 2.7-8 1.5 3h5" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** wrench — premises & equipment condition */
export function IconWrench({ size = 14, color = SLATE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20.7 6.2a5.4 5.4 0 0 1-7.2 6.7l-6.6 6.6a2.1 2.1 0 0 1-3-3l6.6-6.6a5.4 5.4 0 0 1 6.7-7.2L14 6l.7 3.3L18 10l2.7-3.8Z" fill={color} />
    </Svg>
  );
}

/** broom — deep clean */
export function IconBroom({ size = 15, color = SLATE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14.5 3.5l6 6" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M12.2 8.8 15.2 11.8c-2 3.4-5.4 7-9.9 8.7-.9.34-1.76-.5-1.4-1.4 1.7-4.5 5-8.2 8.3-10.3Z" fill={color} />
    </Svg>
  );
}

/** serving tray — work the front yourself */
export function IconTray({ size = 15, color = SLATE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 15.5a9 9 0 0 1 18 0Z" fill={color} />
      <Path d="M2 18.5h20" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Circle cx={12} cy={5.2} r={1.6} fill={color} />
    </Svg>
  );
}

/** open door — go through */
export function IconDoor({ size = 15, color = SLATE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 20.5V4.8A1.8 1.8 0 0 1 6.8 3h8.4A1.8 1.8 0 0 1 17 4.8v15.7" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 20.5h18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M9 3.6l6 2v14.9l-6-2V3.6Z" fill={color} opacity={0.75} />
      <Circle cx={13.3} cy={12} r={1.1} fill="#161927" />
    </Svg>
  );
}

/** columned bank building */
export function IconBank({ size = 15, color = SLATE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2.5 21 8H3l9-5.5Z" fill={color} />
      <Path d="M5 10.5v6M9.7 10.5v6M14.3 10.5v6M19 10.5v6" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M3.5 19.5h17" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

/** banded cash stack — bonuses */
export function IconCash({ size = 15, color = SLATE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2.5} y={6.5} width={19} height={11} rx={2.2} stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={12} r={2.9} fill={color} />
      <Path d="M6 12h.01M18 12h.01" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

/** megaphone — run ads */
export function IconMegaphone({ size = 15, color = SLATE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3.5 10.2v3.6c0 .9.7 1.6 1.6 1.6h1.7l1.1 4a1.3 1.3 0 0 0 1.25 1h.85c.7 0 1.2-.65 1.05-1.33L10.3 15.6l8.2 3.3c.85.34 1.8-.29 1.8-1.2V6.3c0-.91-.95-1.54-1.8-1.2L8.3 9.2H5.1c-.9 0-1.6.7-1.6 1Z" fill={color} />
    </Svg>
  );
}

/** desk lamp over papers — the office */
export function IconDesk({ size = 15, color = SLATE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={13} height={16.5} rx={2.2} stroke={color} strokeWidth={2} />
      <Path d="M6.5 8.5h6M6.5 12h6M6.5 15.5h3.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M19.5 20.5v-9m0 0 2-3.6M19.5 11.5l-2-3.6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
