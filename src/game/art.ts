import { CharacterId } from './cast';
import { CITY_ART } from './cityArt';

/**
 * The rendered cast: CGI-style character art generated to one consistent
 * style spec (dark-slate studio, purple rim light, stylized-realistic
 * animation-movie look). Conversations and recaps show these full renders;
 * the explorable world keeps the small vector minis for walking around —
 * the classic overworld-sprite / dialogue-portrait split.
 *
 * To restyle or add art: regenerate a PNG (864×1080, same style spec),
 * drop it in assets/art/cast/<id>.png, done.
 */
const CAST_ART: Partial<Record<CharacterId, number>> = {
  manager: require('../../assets/art/cast/manager.png'),
  accountant: require('../../assets/art/cast/accountant.png'),
  supplier: require('../../assets/art/cast/supplier.png'),
  regular: require('../../assets/art/cast/regular.png'),
  banker: require('../../assets/art/cast/banker.png'),
  contractor: require('../../assets/art/cast/contractor.png'),
  inspector: require('../../assets/art/cast/inspector.png'),
  rival: require('../../assets/art/cast/rival.png'),
  influencer: require('../../assets/art/cast/influencer.png'),
  neighbor: require('../../assets/art/cast/neighbor.png'),
  landlord: require('../../assets/art/cast/landlord.png'),
};

export function castArt(id: CharacterId): number | null {
  return CAST_ART[id as keyof typeof CAST_ART] ?? null;
}

/** Cinematic title scene for the setup screen. */
export const HERO_ART = require('../../assets/art/hero.png');

/** Playable owner renders — pick who you are at setup. */
export const OWNER_ART: number[] = [
  require('../../assets/art/owners/owner1.png'),
  require('../../assets/art/owners/owner2.png'),
  require('../../assets/art/owners/owner3.png'),
  require('../../assets/art/owners/owner4.png'),
  require('../../assets/art/owners/owner5.png'),
];

export function ownerArt(preset: number): number {
  return OWNER_ART[Math.max(0, preset) % OWNER_ART.length];
}

/** Background-removed cutouts — the same renders, freed from the studio,
 * so characters can stand and move inside the scenes. Dimensions are baked
 * in (react-native-web has no resolveAssetSource). */
export interface Cut { src: number; aspect: number }

const cut = (src: number, w: number, h: number): Cut => ({ src, aspect: w / h });

const CAST_CUT: Partial<Record<CharacterId, Cut>> = {
  manager: cut(require('../../assets/art/full-cut/manager.png'), 417, 1007),
  accountant: cut(require('../../assets/art/full-cut/accountant.png'), 292, 1007),
  supplier: cut(require('../../assets/art/full-cut/supplier.png'), 306, 707),
  regular: cut(require('../../assets/art/full-cut/regular.png'), 263, 994),
  banker: cut(require('../../assets/art/full-cut/banker.png'), 312, 1021),
  contractor: cut(require('../../assets/art/full-cut/contractor.png'), 304, 932),
  inspector: cut(require('../../assets/art/full-cut/inspector.png'), 290, 973),
  rival: cut(require('../../assets/art/full-cut/rival.png'), 346, 983),
  influencer: cut(require('../../assets/art/full-cut/influencer.png'), 382, 919),
  neighbor: cut(require('../../assets/art/full-cut/neighbor.png'), 415, 956),
  landlord: cut(require('../../assets/art/full-cut/landlord.png'), 344, 990),
};

const OWNER_CUT: Cut[] = [
  cut(require('../../assets/art/full-cut/owner1.png'), 341, 883),
  cut(require('../../assets/art/full-cut/owner2.png'), 330, 1027),
  cut(require('../../assets/art/full-cut/owner3.png'), 309, 990),
  cut(require('../../assets/art/full-cut/owner4.png'), 290, 959),
  cut(require('../../assets/art/full-cut/owner5.png'), 347, 996),
];

export function castCut(id: CharacterId): Cut | null {
  return CAST_CUT[id as keyof typeof CAST_CUT] ?? null;
}

export function ownerCut(preset: number): Cut {
  return OWNER_CUT[Math.max(0, preset) % OWNER_CUT.length];
}

/** The same owners drawn from the town's elevated camera angle — used only
 * on the world plane, where a straight-on studio render reads as a standee.
 * Dialogue and interiors keep the eye-level renders above. */
const OWNER_TOP: Cut[] = [
  cut(require('../../assets/art/world/char-owner1.png'), 274, 953),
  cut(require('../../assets/art/world/char-owner2.png'), 327, 944),
  cut(require('../../assets/art/world/char-owner3.png'), 314, 987),
  cut(require('../../assets/art/world/char-owner4.png'), 309, 937),
];

export function ownerTop(preset: number): Cut {
  const i = Math.max(0, preset);
  // presets added before their overhead render exists fall back to the
  // eye-level cut — wrong angle, but the right person
  return OWNER_TOP[i] ?? ownerCut(i);
}

/** Does this preset have a real walk cycle? */
export function ownerHasWalk(preset: number): boolean {
  return Math.max(0, preset) < 4;
}

/** The cast, also drawn at the town's camera angle, for the world plane. */
const CAST_TOP: Partial<Record<CharacterId, Cut>> = {
  manager: cut(require('../../assets/art/world/cast/manager.png'), 435, 868),
  accountant: cut(require('../../assets/art/world/cast/accountant.png'), 255, 970),
  supplier: cut(require('../../assets/art/world/cast/supplier.png'), 401, 925),
  regular: cut(require('../../assets/art/world/cast/regular.png'), 325, 925),
  banker: cut(require('../../assets/art/world/cast/banker.png'), 277, 967),
  contractor: cut(require('../../assets/art/world/cast/contractor.png'), 307, 983),
  inspector: cut(require('../../assets/art/world/cast/inspector.png'), 344, 1006),
  rival: cut(require('../../assets/art/world/cast/rival.png'), 282, 960),
  influencer: cut(require('../../assets/art/world/cast/influencer.png'), 451, 1013),
  neighbor: cut(require('../../assets/art/world/cast/neighbor.png'), 433, 1020),
  landlord: cut(require('../../assets/art/world/cast/landlord.png'), 285, 990),
};

export function castTop(id: CharacterId): Cut | null {
  return CAST_TOP[id as keyof typeof CAST_TOP] ?? null;
}

export const CAST_TOP_IDS: CharacterId[] = Object.keys(CAST_TOP) as CharacterId[];

/** Rendered environment backdrops per business and venue. */
const SCENES: Record<string, number> = {
  'restaurant-inside': require('../../assets/art/scenes/restaurant-floor.png'),
  'convenience-inside': require('../../assets/art/scenes/convenience-floor.png'),
  'coffee-inside': require('../../assets/art/scenes/coffee-floor.png'),
  'bakery-inside': require('../../assets/art/scenes/bakery-floor.png'),
  'barber-inside': require('../../assets/art/scenes/barber-floor.png'),
  'restaurant-street': require('../../assets/art/scenes/restaurant-exterior.png'),
  'convenience-street': require('../../assets/art/scenes/convenience-exterior.png'),
  'coffee-street': require('../../assets/art/scenes/coffee-exterior.png'),
  'bakery-street': require('../../assets/art/scenes/bakery-exterior.png'),
  'barber-street': require('../../assets/art/scenes/barber-exterior.png'),
  'back': require('../../assets/art/scenes/backroom.png'),
  'office': require('../../assets/art/scenes/office.png'),
  // the city beyond your block
  'city-market': require('../../assets/art/scenes/city-market.png'),
  'city-mainstreet': require('../../assets/art/scenes/city-mainstreet.png'),
  'bank': require('../../assets/art/scenes/bank-interior.png'),
};

export function sceneArt(business: string, venue: string): number | null {
  if (venue === 'back' || venue === 'office' || venue === 'bank') return SCENES[venue] ?? null;
  return SCENES[`${business}-${venue}`] ?? null;
}

/** A photo of each location, so you pick a place rather than a word. */
const LOCATION_SCENES: Record<string, number> = {
  low: SCENES['city-market'],            // a quiet square you could own
  average: SCENES['barber-street'],      // calm brick street, steady footfall
  high: SCENES['city-mainstreet'],       // the busy downtown block
};

export function locationArt(id: string): number | null {
  return LOCATION_SCENES[id] ?? null;
}

/** Raw scene modules for the game-engine world (Phaser loads them by URI). */
export function sceneModule(key: string): number | null {
  return SCENES[key] ?? null;
}

/** FarmVille-style world assets: the ground plane and standalone isometric
 * buildings/props that stand ON it (transparent cutouts, depth-sorted). */
export const WORLD_ART: Record<string, number> = {
  'world-shop': require('../../assets/art/world/shop.png'),
  'world-bank': require('../../assets/art/world/bank.png'),
  'world-rival': require('../../assets/art/world/rival.png'),
  'world-stall': require('../../assets/art/world/stall.png'),
  'world-fountain': require('../../assets/art/world/fountain.png'),
  // one building per business type — the player's own type marks their shop
  'world-biz-restaurant': require('../../assets/art/world/shop.png'),
  'world-biz-coffee': require('../../assets/art/world/biz-coffee.png'),
  'world-biz-bakery': require('../../assets/art/world/biz-bakery.png'),
  'world-biz-convenience': require('../../assets/art/world/biz-convenience.png'),
  'world-biz-barber': require('../../assets/art/world/biz-barber.png'),
  'world-ground': require('../../assets/art/world/city-ground.jpg'),
  ...CITY_ART,
  'world-vacant': require('../../assets/art/world/vacant.png'),
  // townsfolk drawn at the world's own camera angle
  'world-folk1': require('../../assets/art/world/folk1.png'),
  'world-folk2': require('../../assets/art/world/folk2.png'),
  'world-folk3': require('../../assets/art/world/folk3.png'),
  'world-folk4': require('../../assets/art/world/folk4.png'),
  // city fill: the blocks around your business
  'world-apartment': require('../../assets/art/world/apartment.png'),
  'world-office-tower': require('../../assets/art/world/office-tower.png'),
  'world-townhouse': require('../../assets/art/world/townhouse.png'),
  'world-tree': require('../../assets/art/world/tree.png'),
  'world-bush': require('../../assets/art/world/bush.png'),
  // zoned city sets — each set generated in ONE image so every building in
  // it shares the same isometric angle and scale ("built together")
  'city-commercial1': require('../../assets/art/world/city/commercial1.png'),
  'city-commercial2': require('../../assets/art/world/city/commercial2.png'),
  'city-commercial3': require('../../assets/art/world/city/commercial3.png'),
  'city-commercial4': require('../../assets/art/world/city/commercial4.png'),
  'city-residential1': require('../../assets/art/world/city/residential1.png'),
  'city-residential2': require('../../assets/art/world/city/residential2.png'),
  'city-residential3': require('../../assets/art/world/city/residential3.png'),
  'city-residential4': require('../../assets/art/world/city/residential4.png'),
  'city-suburban1': require('../../assets/art/world/city/suburban1.png'),
  'city-suburban2': require('../../assets/art/world/city/suburban2.png'),
  'city-suburban3': require('../../assets/art/world/city/suburban3.png'),
  'city-suburban4': require('../../assets/art/world/city/suburban4.png'),
  'city-tower1': require('../../assets/art/world/city/tower1.png'),
  'city-tower2': require('../../assets/art/world/city/tower2.png'),
  'city-tower3': require('../../assets/art/world/city/tower3.png'),
  'city-tower4': require('../../assets/art/world/city/tower4.png'),
  'city-bench': require('../../assets/art/world/city/bench.png'),
  'city-pond': require('../../assets/art/world/city/pond.png'),
  'city-lamp': require('../../assets/art/world/city/lamp.png'),
  'car1': require('../../assets/art/world/city/car1.png'),
  'car2': require('../../assets/art/world/city/car2.png'),
  'car3': require('../../assets/art/world/city/car3.png'),
  'car4': require('../../assets/art/world/city/car4.png'),
  'car5': require('../../assets/art/world/city/car5.png'),
};

/** Real 4-frame walk cycles (300×420 per frame) — the character posed in
 * each step, not a static render pulled apart. Keys map to a texture the
 * engine loads as a spritesheet and plays. */
export const WALK_SHEETS: Record<string, number> = {
  'walk-owner1': require('../../assets/art/world/walk/owner1.png'),
  'walk-owner2': require('../../assets/art/world/walk/owner2.png'),
  'walk-owner3': require('../../assets/art/world/walk/owner3.png'),
  'walk-owner4': require('../../assets/art/world/walk/owner4.png'),
  'walk-folk1': require('../../assets/art/world/walk/folk1.png'),
  'walk-folk2': require('../../assets/art/world/walk/folk2.png'),
  'walk-folk4': require('../../assets/art/world/walk/folk4.png'),
};


