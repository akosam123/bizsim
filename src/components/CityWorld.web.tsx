import { Asset } from 'expo-asset';
import Phaser from 'phaser';
import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CharacterId } from '../game/cast';
import { Cut, castCut, castTop, ownerHasWalk, sceneModule, WALK_SHEETS, WORLD_ART } from '../game/art';
import CITY_LAYOUT from '../game/cityLayout.json';
import { playSfx } from '../game/sound';
import { BusinessId, Venue, WorldRoom } from '../game/types';
import { WorldNpc } from './WorldStage';
import { IconBoxes, IconDesk, IconShop, IconStreet } from './icons';
import { useTheme, useThemedStyles, Palette } from './theme';

/**
 * The game world, powered by a real engine (Phaser 3).
 *
 * OUTSIDE is a FarmVille-style town: a cobblestone ground PLANE you walk
 * around on in every direction, with isometric buildings standing on it —
 * your shop, the bank, the rival's place, the market stalls, a fountain.
 * Everything depth-sorts by its feet (walk behind the fountain, in front
 * of a stall) and characters scale with distance for perspective.
 * Interiors are side-view rooms. React stays on top for HUD & dialogue.
 *
 * (Native builds fall back to the room-by-room world — CityWorld.tsx.)
 */

interface Props {
  business: BusinessId;
  location: string;
  storeTier: number;
  crowd: number;
  reputation: number;
  width: number;
  room: WorldRoom;
  onChangeRoom: (r: WorldRoom) => void;
  playerLook: unknown;
  playerArt?: Cut | null;
  /** the same owner drawn at the world camera angle (plane only) */
  playerTopArt?: Cut | null;
  /** which owner preset — picks their walk cycle */
  playerPreset?: number;
  npcs: WorldNpc[];
  npcRoomsWithWork: Venue[];
  onTalk: (id: string) => void;
  onBooks: () => void;
  onMenu: () => void;
  onAction: (id: string) => void;
  activities: { id: string; label: string; hint: string; done: boolean; disabled: boolean }[];
  onActivity: (id: string) => void;
}

const VIEW_W = 1280;
const VIEW_H = 720;
// Township proportions: a person is a fraction of a building's height.
// Buildings stand 380-440 units; people are ~150. Getting this ratio wrong
// (characters as tall as houses) is what made the world read as wrong.
// Sized against Kenney's building tiles, which stand 127px on the isometric
// grid. A person is roughly half a single storey; making them 150 (the old
// painted-ground scale) left people taller than the houses.
const SPRITE_H = 62;
const WALK_SPEED = 120;

// the town plane: FOUR quarters — home square (NW), business district (NE),
// the park (SW), and the south end (SE), each around its own plaza
const TOWN_W = 5120;
const TOWN_H = 2880;
const TOWN_MIN_Y = 60;       // the whole plate is street level now
const TOWN_MAX_Y = TOWN_H - 40;

// side-view interiors
const GROUND = 700;

interface DoorDef { id: string; label: string; px: number; py: number; tx: number; ty: number }
interface ActivitySpot { id: string; x: number; y: number; ty: number }
interface Placed { key: string; x: number; y: number; h: number; doorId?: string }
interface FixedNpc { talkId: string; char: CharacterId; name: string; x: number; y: number }

interface MapDef {
  kind: 'plane' | 'side';
  width: number;
  height: number;
  bgs: { key: string; x: number }[];          // side maps
  buildings: Placed[];                         // plane maps
  doors: DoorDef[];
  captions: { x: number; y: number; text: string }[];
  fixedNpcs: FixedNpc[];
  slots: { x: number; y: number }[];
  spots: ActivitySpot[];
  /** background life inside a room: diners at tables, staff on the move */
  life?: LifeSpec[];
}

/** A room full of people is what makes it read as a business rather than a
 * showroom. `seated` shows a diner from the table edge up; `stand` is a
 * member of staff holding their post; `work` bobs over a station.
 *
 * Nobody slides across the floor. Sprites are standing renders, so any
 * lateral tween reads as a mannequin on rails rather than a person walking. */
interface LifeSpec {
  x: number;
  y: number;
  h: number;
  mode: 'seated' | 'stand' | 'work';
  /** seated only: the y of the table edge the diner sits behind. The sprite
   * is cropped so its visible bottom lands exactly here, so the tablecloth
   * continues the figure instead of a cut-off body floating over the floor. */
  sitY?: number;
  flip?: boolean;
}

const sideDoor = (id: string, label: string, x: number): DoorDef =>
  ({ id, label, px: x, py: 96, tx: x, ty: GROUND });

const BIZ_NAMES: Record<string, string> = {
  restaurant: 'The restaurant', coffee: 'The coffee shop', bakery: 'The bakery',
  convenience: 'The corner store', barber: 'The barbershop',
};

// ── city plan ──────────────────────────────────────────────────────────
// The street grid is baked into the ground art at these exact coordinates,
// so traffic drives on real lanes and buildings line up on real blocks.
const ROADS_H = [620, 1360, 2100, 2840];
const ROADS_V = [380, 1240, 2100, 2960, 3820, 4680];
const LANE = 38;   // offset from the road centreline to a driving lane

/** Zoning. Districts are contiguous, and every building inside a district
 * comes from one generated set, so a block reads as built together. */
const ZONES = {
  commercial: { x0: 0, x1: 2100, y0: 0, y1: 1360 },
  financial: { x0: 2960, x1: TOWN_W, y0: 0, y1: 1360 },
  residential: { x0: 0, x1: 2100, y0: 1360, y1: TOWN_H },
  suburbs: { x0: 2960, x1: TOWN_W, y0: 1360, y1: TOWN_H },
  park: { x0: 2100, x1: 2960, y0: 620, y1: TOWN_H },
};

/** Buildings sit on the blocks between roads, aligned to the grid and all
 * facing the same way — no scattered angles. */
/** The city, straight out of scripts/build_city.py. Ground tiles, plots and
 * buildings all come from one grid there, which is why nothing can sit in a
 * road: the plot list a building is chosen from never contains a road cell. */
const CITY_FILL: Placed[] = (CITY_LAYOUT.buildings as any[]).map((b) => ({
  key: b.key, x: b.x, y: b.y, h: b.h,
}));

/** Street furniture: trees and lamps on pavement cells. */
const CITY_PROPS: Placed[] = (CITY_LAYOUT.props as any[]).map((p) => ({
  key: p.key, x: p.x, y: p.y, h: p.h,
}));

type Landmark = { x: number; y: number };
const LM_SHARED = CITY_LAYOUT.landmarks as Record<string, Landmark>;
const LM_BY_LOCATION = CITY_LAYOUT.landmarksByLocation as Record<string, Record<string, Landmark>>;

/** Your shop stands in the district you chose at setup, so picking "Suburb"
 * actually puts you out in the suburbs. The cells for every location are
 * reserved in the generator; the ones you aren't using read as vacant lots. */
function landmarksFor(location: string): Record<string, Landmark> {
  return { ...LM_SHARED, ...(LM_BY_LOCATION[location] ?? LM_BY_LOCATION.high) };
}
/** Kenney building tiles render at their native size; scaling them breaks the
 * shared isometric grid they were drawn on. */
/** Native pixel height of a generated sprite. Kenney tiles come in two
 * footprints (132x127 and 99x85); forcing one height on both stretches the
 * small ones, so every placement uses its own sprite's size. */
const KB_SPRITES = CITY_LAYOUT.sprites as Record<string, { w: number; h: number }>;
const kbH = (key: string) => KB_SPRITES[key]?.h ?? 127;

/** Traffic: cars loop along the baked road lanes, right-hand drive. */
/** A lane is a start point plus a constant per-step delta, because isometric
 * streets run along the two grid axes rather than the screen axes. */
interface Lane { x: number; y: number; dx: number; dy: number; steps: number; head: string }
interface CarSpec { lane: Lane; key: string; t: number; speed: number }
const LANES: Lane[] = CITY_LAYOUT.lanes as Lane[];
/** Clockwise tilt applied to every car, in degrees. Raise to tip the nose
 *  further down into the street, lower to stand them back up. */
const CAR_TILT = Phaser.Math.DegToRad(0);
const CAR_COLOURS = ['blue', 'red', 'silver', 'black'];

/** One car per lane, staggered along it. The sprite is picked by heading:
 * the vehicle pack ships 16 rotations and the layout names which one each
 * lane needs, so a car always points the way it is travelling. */
const CAR_SPECS: CarSpec[] = LANES.map((lane, i) => ({
  lane,
  // Colour is mixed from the lane's own geometry, not its index. Indexing tied
  // every colour to one heading (all silver cars on the same road), so a fault
  // in one heading looked like "the silver cars are broken" -- and the mapping
  // shifted whenever a short lane was dropped, moving the blame to a different
  // colour on every rebuild.
  key: `kc_${CAR_COLOURS[Math.abs(lane.x * 7 + lane.y * 13 + i) % CAR_COLOURS.length]}_${lane.head}`,
  t: (i * 7.3) % lane.steps,
  speed: 1.6 + (i % 5) * 0.35,       // steps per second
}));

/** Every trade fills its room differently: a restaurant seats guests at
 * tables, a barbershop has people waiting their turn, a shop has browsers.
 * Positions are tuned to each interior's furniture. */
const FLOOR_LIFE: Record<BusinessId, LifeSpec[]> = {
  // Diners sit at the four tables, cropped at each table's own edge so the
  // tablecloth continues the body. Nobody stands around in the aisle: the
  // scenario NPCs already occupy the floor, and more standing figures turn
  // the room into a line-up.
  restaurant: [
    { x: 320, y: 0, h: 240, mode: 'seated', sitY: 388 },                 // left middle table
    { x: 950, y: 0, h: 236, mode: 'seated', sitY: 384, flip: true },     // right middle table
    { x: 150, y: 0, h: 300, mode: 'seated', sitY: 452 },                 // left front table
    { x: 1130, y: 0, h: 296, mode: 'seated', sitY: 450, flip: true },    // right front table
  ],
  // The counter runs across the room with stools in front, so a customer at
  // the bar is simply a person standing at it. No crop needed.
  coffee: [
    { x: 300, y: 690, h: 300, mode: 'stand' },
    { x: 640, y: 700, h: 310, mode: 'stand', flip: true },
    { x: 980, y: 686, h: 298, mode: 'stand' },
  ],
  bakery: [
    { x: 330, y: 692, h: 302, mode: 'stand' },
    { x: 900, y: 698, h: 308, mode: 'stand', flip: true },
  ],
  convenience: [
    { x: 380, y: 690, h: 300, mode: 'stand' },
    { x: 930, y: 700, h: 310, mode: 'stand', flip: true },
    { x: 690, y: 640, h: 305, mode: 'work' },
  ],
  // A barber at a chair, and someone waiting on the bench by the window.
  barber: [
    { x: 640, y: 700, h: 350, mode: 'work' },
    { x: 1120, y: 640, h: 290, mode: 'stand', flip: true },
  ],
};

function mapsFor(business: BusinessId, location: string): Record<string, MapDef> {
  const LM = landmarksFor(location);
  // the four business types you DON'T run are spread across town —
  // two in the northeast district, two in the south end
  const others = (['restaurant', 'coffee', 'bakery', 'convenience', 'barber'] as BusinessId[])
    .filter((b) => b !== business);
  const districtPlots: { x: number; y: number; h: number }[] = [
    { x: LM['biz-a'].x, y: LM['biz-a'].y, h: kbH('lm012') },
    { x: LM['biz-b'].x, y: LM['biz-b'].y, h: kbH('lm020') },
    { x: LM['biz-c'].x, y: LM['biz-c'].y, h: kbH('lm026') },
    { x: LM['biz-d'].x, y: LM['biz-d'].y, h: kbH('lm009') },
  ];
  const KB = ['lm012', 'lm020', 'lm026', 'lm009'];
  const districtBuildings: Placed[] = others.map((b, i) => ({
    key: KB[i % KB.length], ...districtPlots[i], doorId: `biz-${b}`,
  }));
  const districtDoors: DoorDef[] = others.map((b, i) => ({
    id: `biz-${b}`, label: BIZ_NAMES[b],
    px: districtPlots[i].x, py: districtPlots[i].y - districtPlots[i].h - 30,
    tx: districtPlots[i].x, ty: districtPlots[i].y + 70,
  }));

  return {
    street: {
      kind: 'plane',
      width: TOWN_W,
      height: TOWN_H,
      bgs: [],
      buildings: [
        // Landmarks stand on cells the generator keeps clear, so they sit on
        // real plots facing a real street rather than at hand-typed guesses.
        { key: 'lm004', x: LM.enter.x, y: LM.enter.y, h: kbH('lm004'), doorId: 'enter' },
        { key: 'lm029', x: LM.bankdoor.x, y: LM.bankdoor.y, h: kbH('lm029'), doorId: 'bankdoor' },
        { key: 'lm034', x: LM.rival.x, y: LM.rival.y, h: kbH('lm034') },
        { key: 'lm002', x: LM.expand.x, y: LM.expand.y, h: kbH('lm002'), doorId: 'expand' },
        { key: 'lm002', x: LM.expand2.x, y: LM.expand2.y, h: kbH('lm002'), doorId: 'expand2' },
        ...districtBuildings,
        // the rest of the city
        ...CITY_FILL,
        ...CITY_PROPS,
      ],
      doors: [
        { id: 'enter', label: 'Your shop', px: LM.enter.x, py: LM.enter.y - kbH('lm004') - 30, tx: LM.enter.x, ty: LM.enter.y + 70 },
        { id: 'bankdoor', label: 'The bank', px: LM.bankdoor.x, py: LM.bankdoor.y - kbH('lm029') - 30, tx: LM.bankdoor.x, ty: LM.bankdoor.y + 70 },
        { id: 'expand', label: 'For lease', px: LM.expand.x, py: LM.expand.y - kbH('lm002') - 30, tx: LM.expand.x, ty: LM.expand.y + 70 },
        { id: 'expand2', label: 'For lease', px: LM.expand2.x, py: LM.expand2.y - kbH('lm002') - 30, tx: LM.expand2.x, ty: LM.expand2.y + 70 },
        ...districtDoors,
      ],
      captions: [
        { x: 1300, y: 620, text: 'COMMERCIAL DISTRICT' },
        { x: 3900, y: 620, text: 'FINANCIAL DISTRICT' },
        { x: 1300, y: 2300, text: 'RESIDENTIAL DISTRICT' },
        { x: 3900, y: 2300, text: 'SUBURBS' },
        { x: 2560, y: 1500, text: 'CITY PARK' },
      ],
      fixedNpcs: [
        { talkId: 'city-marcus', char: 'neighbor', name: 'Marcus', x: LM.enter.x - 170, y: LM.enter.y + 120 },
        { talkId: 'city-victor', char: 'rival', name: 'Victor', x: LM.rival.x + 40, y: LM.rival.y + 96 },
      ],
      slots: [
        { x: LM.enter.x + 150, y: LM.enter.y + 130 },
        { x: LM.enter.x - 40, y: LM.enter.y + 210 },
        { x: LM.enter.x + 260, y: LM.enter.y + 40 },
      ],
      spots: [
        { id: 'network', x: LM['biz-c'].x, y: LM['biz-c'].y - 150, ty: LM['biz-c'].y + 80 },
        { id: 'scout', x: LM.rival.x, y: LM.rival.y - 150, ty: LM.rival.y + 80 },
      ],
    },
    inside: {
      kind: 'side', width: VIEW_W, height: VIEW_H, buildings: [],
      bgs: [{ key: 'bg-inside', x: 0 }],
      doors: [sideDoor('street', 'Street', 90), sideDoor('menu', 'Menu board', 410), sideDoor('back', 'Back room', 1190)],
      captions: [], fixedNpcs: [],
      // staggered: three sprites on one baseline read as a police line-up
      slots: [{ x: 430, y: GROUND - 22 }, { x: 720, y: GROUND + 6 }, { x: 1010, y: GROUND - 34 }],
      spots: [{ id: 'serve', x: 165, y: 410, ty: GROUND }],
      life: FLOOR_LIFE[business],
    },
    back: {
      kind: 'side', width: VIEW_W, height: VIEW_H, buildings: [],
      bgs: [{ key: 'bg-back', x: 0 }],
      doors: [sideDoor('inside', 'Shop floor', 120), sideDoor('team', 'Your team', 660), sideDoor('office', 'Office', 1190)],
      captions: [], fixedNpcs: [],
      // out back: cooks over the pass in a kitchen, stock work elsewhere
      life: business === 'barber' || business === 'convenience'
        ? [{ x: 500, y: 585, h: 305, mode: 'work' }]
        : [
          { x: 420, y: 560, h: 300, mode: 'work' },
          { x: 560, y: 575, h: 305, mode: 'work', flip: true },
          { x: 880, y: 590, h: 315, mode: 'work' },
        ],
      slots: [{ x: 460, y: GROUND }, { x: 740, y: GROUND }, { x: 1000, y: GROUND }],
      spots: [
        { id: 'clean', x: 300, y: 340, ty: GROUND },
        { id: 'help', x: 920, y: 360, ty: GROUND },
      ],
    },
    office: {
      kind: 'side', width: VIEW_W, height: VIEW_H, buildings: [],
      bgs: [{ key: 'bg-office', x: 0 }],
      doors: [sideDoor('back', 'Back room', 100), sideDoor('ads', 'Run ads', 440), sideDoor('books', 'The books', 800)],
      captions: [], fixedNpcs: [],
      slots: [{ x: 460, y: GROUND }, { x: 740, y: GROUND }, { x: 1000, y: GROUND }],
      spots: [{ id: 'books', x: 620, y: 350, ty: GROUND }],
    },
    bank: {
      kind: 'side', width: VIEW_W, height: VIEW_H, buildings: [],
      bgs: [{ key: 'bg-bank', x: 0 }],
      doors: [sideDoor('exitbank', 'Back outside', 110)],
      captions: [{ x: 640, y: 34, text: 'FIRST STREET BANK' }],
      fixedNpcs: [{ talkId: 'city-grady', char: 'banker', name: 'Mr. Grady', x: 880, y: GROUND }],
      slots: [{ x: 520, y: GROUND }, { x: 760, y: GROUND }, { x: 980, y: GROUND }],
      spots: [],
    },
  };
}

interface Bridge {
  onDoor: (id: string) => void;
  onTalk: (id: string) => void;
  onActivity: (id: string) => void;
}

interface NpcSpec { id: string; texKey: string; aspect: number; name: string; x: number; y: number; bang: boolean; walkKey?: string }
interface ActivityState { id: string; label: string; done: boolean; disabled: boolean }

/** perspective: things lower on the plane are closer, so bigger */
function depthScale(map: MapDef, y: number): number {
  // SPRITE_H is sized for the city, where a person is small against a
  // building. Indoors the same person should fill the room.
  // 6.9 * SPRITE_H(62) keeps interiors at the ~430px figure they were tuned
  // for; the factor is tied to SPRITE_H, so shrinking people for the city
  // would otherwise shrink them indoors too.
  if (map.kind === 'side') return 6.9;
  const t = (Phaser.Math.Clamp(y, TOWN_MIN_Y, TOWN_MAX_Y) - TOWN_MIN_Y) / (TOWN_MAX_Y - TOWN_MIN_Y);
  return 0.6 + t * 0.4;
}

const WALK_FW = 300;   // walk-sheet frame size
const WALK_FH = 420;

/** A townsperson sprite. When a real 4-frame walk cycle exists for this
 * character it plays that (the character actually posed in each step of
 * the stride — bent knees and all); otherwise it falls back to the single
 * standing render with a gentle bob. Township-style. */
class Puppet {
  container: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Sprite;
  rigH: number;
  aspect: number;
  facing = 1;
  private animated: boolean;
  private walkT: number;
  private lastFrame = 0;
  private breathSeed = Math.random() * 1000;

  constructor(scene: Phaser.Scene, texKey: string, walkKey?: string) {
    this.animated = !!walkKey && scene.textures.exists(walkKey);
    const key = this.animated ? walkKey! : texKey;
    const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
    this.rigH = this.animated ? WALK_FH : src.height;
    this.aspect = this.animated ? WALK_FW / WALK_FH : src.width / src.height;
    this.sprite = scene.add.sprite(0, -this.rigH, key).setOrigin(0.5, 0);
    if (this.animated) this.sprite.setFrame(0);
    this.container = scene.add.container(0, 0, [this.sprite]);
    this.walkT = Math.random() * 4; // nobody strides in sync
  }

  destroy() { this.container.destroy(); }

  /** advance the cycle and place the sprite; returns the bob so callers can
   * ground shadows. dirX/dirY = travel direction (foreshortens head-on). */
  pose(tNow: number, dtMs: number, moving: boolean, dirX: number, x: number, y: number, s: number, onFootfall?: () => void, dirY = 0): number {
    const h = SPRITE_H * s;
    const base = h / this.rigH;
    let bob = 0;
    let hF = 1;
    if (moving) {
      if (dirX !== 0) this.facing = dirX < 0 ? -1 : 1;
      const across = Math.min(1, Math.abs(dirX) / (Math.abs(dirX) + Math.abs(dirY) || 1));
      this.walkT += (dtMs / 1000) * 7.5;   // ~7.5 frames/sec
      if (this.animated) {
        const f = Math.floor(this.walkT) % 4;
        if (f !== this.lastFrame) {
          this.sprite.setFrame(f);
          // frames 0 and 2 are the contact poses — that's a footfall
          if (f === 0 || f === 2) onFootfall?.();
          this.lastFrame = f;
        }
        bob = Math.abs(Math.sin(this.walkT * Math.PI)) * 2 * s;
      } else {
        // no cycle for this character: a simple stride bob reads better
        // than pretending a static render has moving legs
        const air = Math.abs(Math.sin(this.walkT * Math.PI));
        bob = air * (6 + 4 * (1 - across)) * s;
        hF = 1 - 0.02 * (1 - air);
        const f = Math.floor(this.walkT) % 2;
        if (f !== this.lastFrame) { onFootfall?.(); this.lastFrame = f; }
      }
    } else {
      if (this.animated) { this.sprite.setFrame(0); this.lastFrame = 0; }
      hF = 1 + Math.sin((tNow + this.breathSeed) / 700) * 0.008;  // breathing
    }
    this.container.setScale(this.facing * base, base * hF);
    this.container.setPosition(x, y - bob);
    return bob;
  }
}

/** a townsperson: a puppet plus where they live, where they're headed,
 * and whether they're story (tappable) or just street life */
interface NpcActor {
  spec: NpcSpec;
  puppet: Puppet;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text | null;
  marker: Phaser.GameObjects.Text | null;
  x: number; y: number;
  homeX: number; homeY: number;
  radius: number;
  tx: number; ty: number;
  state: 'idle' | 'walk';
  nextAt: number;
  speed: number;
  ambient: boolean;
  /** ambient pedestrians walk a pavement loop rather than drifting freely,
   * which is what kept sending them across the carriageway */
  route?: { x: number; y: number }[];
  routeIdx: number;
}

class WorldScene extends Phaser.Scene {
  private playerPuppet: Puppet | null = null;
  private player!: Phaser.GameObjects.Container;   // = playerPuppet.container
  private playerTexKey = '';
  private playerAspect = 0.38;
  private lastDirY = 0;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private px = 0; private py = 0;              // the player's feet on the map
  private target: { x: number; y: number } | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private mapObjects: Phaser.GameObjects.GameObject[] = [];
  private doorPills: { def: DoorDef; obj: Phaser.GameObjects.Container }[] = [];
  private npcActors: NpcActor[] = [];
  private npcSpecs: NpcSpec[] = [];
  private cars: { spec: CarSpec; img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse }[] = [];
  private markerObjs: Phaser.GameObjects.GameObject[] = [];
  private markerSpots: { spot: ActivitySpot; state: ActivityState }[] = [];
  private currentMap: MapDef | null = null;
  private pendingWalkAction: (() => void) | null = null;
  private zoomLevel = 1;
  private pinchDist: number | null = null;
  private dragStart: { x: number; y: number; sx: number; sy: number } | null = null;
  private dragged = false;
  private following = true;

  constructor() { super('world'); }

  /** zoom is a camera concern only — taps and world logic stay in world coords */
  private zoomRange(): [number, number] {
    if (this.currentMap?.kind !== 'plane') return [1, 1];
    // fully zoomed out = the whole town on screen at once
    return [VIEW_H / this.currentMap.height, 1.6];
  }

  setZoomLevel(z: number) {
    const [lo, hi] = this.zoomRange();
    this.zoomLevel = Phaser.Math.Clamp(z, lo, hi);
    this.cameras.main.setZoom(this.zoomLevel);
  }

  zoomBy(factor: number) { this.setZoomLevel(this.zoomLevel * factor); }

  /** buttons zoom around you — panning away then zooming shouldn't lose you */
  zoomByFollowing(factor: number) {
    this.refollow();
    this.setZoomLevel(this.zoomLevel * factor);
  }

  preload() {
    const manifest = this.registry.get('manifest') as Record<string, string>;
    for (const [key, uri] of Object.entries(manifest)) {
      if (key.startsWith('walk-')) {
        this.load.spritesheet(key, uri, { frameWidth: WALK_FW, frameHeight: WALK_FH });
      } else {
        this.load.image(key, uri);
      }
    }
  }

  create() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.addPointer(1); // second touch point for pinch-zoom

    // scroll wheel / trackpad zoom
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.zoomBy(dy > 0 ? 0.92 : 1.087);
    });

    this.playerShadow = this.add.ellipse(0, 0, 120, 14, 0x000000, 0.32);
    this.buildPlayerRig('char-player');

    // drag pans the camera; a clean tap (no drag) interacts. The camera
    // re-follows the player as soon as they move again.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.input.pointer1?.isDown && this.input.pointer2?.isDown) { this.dragStart = null; return; }
      const cam = this.cameras.main;
      this.dragStart = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY };
      this.dragged = false;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !this.dragStart) return;
      if (this.input.pointer1?.isDown && this.input.pointer2?.isDown) return; // pinching
      const dx = p.x - this.dragStart.x;
      const dy = p.y - this.dragStart.y;
      if (!this.dragged && Math.hypot(dx, dy) < 12) return;
      this.dragged = true;
      const cam = this.cameras.main;
      if (this.following) { cam.stopFollow(); this.following = false; }
      cam.setScroll(this.dragStart.sx - dx / this.zoomLevel, this.dragStart.sy - dy / this.zoomLevel);
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const wasDrag = this.dragged;
      this.dragStart = null;
      this.dragged = false;
      if (wasDrag) return;
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      this.routeTap(wp.x, wp.y);
    });

    (this.registry.get('onReady') as (s: WorldScene) => void)(this);
  }

  /** one router for every tap: door signs, then work markers, then buildings,
   * then people, then the ground (proximity-based — sturdier than hit tests) */
  private routeTap(wx: number, wy: number) {
    {
      const door = this.doorPills.find(({ def, obj }) => Math.abs(wx - def.px) < 120 && Math.abs(wy - obj.y) < 90);
      if (door) {
        playSfx('tap');
        this.pendingWalkAction = () => this.bridge().onDoor(door.def.id);
        this.walkTo(door.def.tx, door.def.ty);
        return;
      }

      const marker = this.markerSpots.find(({ spot }) => Math.abs(wx - spot.x) < 105 && Math.abs(wy - spot.y) < 130);
      if (marker) {
        if (marker.state.done || marker.state.disabled) return;
        playSfx('tap');
        const id = marker.state.id;
        this.pendingWalkAction = () => this.bridge().onActivity(id);
        this.walkTo(marker.spot.x, marker.spot.ty);
        return;
      }

      // tapping a building with a door is the same as tapping its sign
      const map = this.currentMap;
      if (map?.kind === 'plane') {
        const b = map.buildings.find((bd) => {
          if (!bd.doorId) return false;
          const src = this.textures.get(bd.key).getSourceImage() as HTMLImageElement;
          const halfW = (bd.h * (src.width / src.height)) / 2;
          return Math.abs(wx - bd.x) < halfW && wy > bd.y - bd.h && wy < bd.y + 20;
        });
        if (b) {
          playSfx('tap');
          const door = this.doorPills.find(({ def }) => def.id === b.doorId);
          this.pendingWalkAction = () => this.bridge().onDoor(b.doorId!);
          this.walkTo(door?.def.tx ?? b.x, door?.def.ty ?? b.y + 60);
          return;
        }
      }

      // people move — hit-test their LIVE position, not their spawn point
      const actor = this.npcActors.find((a) => {
        if (a.ambient) return false;
        const s = depthScale(this.currentMap!, a.y);
        const halfW = (SPRITE_H * s * a.puppet.aspect) / 2 + 50;
        return Math.abs(wx - a.x) < halfW && wy > a.y - SPRITE_H * s - 70 && wy < a.y + 40;
      });
      if (actor) {
        playSfx('tap');
        const id = actor.spec.id;
        this.pendingWalkAction = () => this.bridge().onTalk(id);
        const s = depthScale(this.currentMap!, actor.y);
        this.walkTo(actor.x - SPRITE_H * s * this.playerAspect * 1.1, actor.y);
        return;
      }

      this.pendingWalkAction = null;
      this.walkTo(wx, wy);
    }
  }

  private bridge(): Bridge { return (this.registry.get('bridge') as { current: Bridge }).current; }

  private buildPlayerRig(texKey: string, walkKey?: string) {
    if (!this.textures.exists(texKey)) return;
    this.playerPuppet?.destroy();
    this.playerPuppet = new Puppet(this, texKey, walkKey);
    this.player = this.playerPuppet.container;
    this.playerAspect = this.playerPuppet.aspect;
  }

  setPlayerTexture(texKey: string, _aspect: number) {
    this.playerTexKey = texKey;
    this.buildPlayerRig(texKey, this.registry.get('playerWalkKey') as string | undefined);
    if (this.currentMap) {
      this.renderPlayer(0, 0, false, 0);
      this.following = true;
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    }
  }

  setMap(map: MapDef, spawn: { x: number; y: number }) {
    this.currentMap = map;
    // outdoors: overhead-angle render + its real walk cycle.
    // interiors: the eye-level render, no cycle.
    const plane = map.kind === 'plane';
    const wantKey = plane && this.textures.exists('char-player-top')
      ? 'char-player-top' : 'char-player';
    const wantWalk = plane ? (this.registry.get('playerWalkKey') as string | undefined) : undefined;
    if (this.playerTexKey !== `${wantKey}|${wantWalk ?? ''}`) {
      this.playerTexKey = `${wantKey}|${wantWalk ?? ''}`;
      this.buildPlayerRig(wantKey, wantWalk);
    }
    this.mapObjects.forEach((o) => o.destroy());
    this.mapObjects = [];
    this.doorPills = [];
    this.clearNpcs();
    this.clearMarkers();
    this.clearCars();
    if (map.kind === 'plane') this.spawnCars();

    if (map.kind === 'plane') {
      // one pre-quilted seamless plane — no runtime tile seams
      const ground = this.add.image(0, 0, 'world-ground').setOrigin(0, 0)
        .setDisplaySize(map.width, map.height).setDepth(0);
      this.mapObjects.push(ground);
      for (const b of map.buildings) {
        if (!this.textures.exists(b.key)) continue;
        const src = this.textures.get(b.key).getSourceImage() as HTMLImageElement;
        const aspect = src.width / src.height;
        const img = this.add.image(b.x, b.y, b.key).setOrigin(0.5, 1)
          .setDisplaySize(b.h * aspect, b.h).setDepth(b.y);
        this.mapObjects.push(img);
      }
    } else {
      for (const bg of map.bgs) {
        const img = this.add.image(bg.x, 0, bg.key).setOrigin(0, 0).setDisplaySize(VIEW_W, VIEW_H).setDepth(0);
        this.mapObjects.push(img);
      }
      this.spawnLife(map);
    }

    for (const cap of map.captions) {
      const t = this.add.text(cap.x, cap.y, cap.text, {
        fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ffffff',
        backgroundColor: '#12141daa', padding: { x: 12, y: 5 } as any,
      }).setOrigin(0.5, 0).setDepth(2900).setAlpha(0.85);
      // No parallax on these: a district caption names the ground under it, so
      // drifting it against the map puts "COMMERCIAL DISTRICT" over the suburbs.
      this.mapObjects.push(t);
    }

    // Landmarks sit close together on one block, so their signs collide. Lift
    // each pill clear of any sign already placed near the same spot.
    const placedPills: { x: number; y: number; w: number }[] = [];
    for (const door of map.doors) {
      const label = this.add.text(0, 0, door.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '19px', color: '#e8ebf5', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);
      const w = label.width + 34;
      const bgRect = this.add.rectangle(0, 0, w, 42, 0x12141d, 0.82).setStrokeStyle(1.5, 0x8b93ad, 0.6);
      const arrow = this.add.text(0, 30, '▾', { fontSize: '16px', color: '#e8c86a' }).setOrigin(0.5, 0.5);
      let py = door.py;
      for (let guard = 0; guard < 8; guard++) {
        const clash = placedPills.some((q) => Math.abs(q.x - door.px) < (q.w + w) / 2 && Math.abs(q.y - py) < 46);
        if (!clash) break;
        py -= 48;
      }
      placedPills.push({ x: door.px, y: py, w });
      const pill = this.add.container(door.px, py, [bgRect, label, arrow]).setDepth(2900);
      this.tweens.add({ targets: arrow, y: 36, duration: 700, yoyo: true, repeat: -1, ease: 'sine.inout' });
      this.mapObjects.push(pill);
      this.doorPills.push({ def: door, obj: pill });
    }

    this.cameras.main.setBounds(0, 0, map.width, map.height);
    this.setZoomLevel(this.zoomLevel); // re-clamp for this map (side rooms lock to 1)
    this.px = spawn.x;
    this.py = spawn.y;
    this.target = null;
    this.renderPlayer(0, 0, false, 0);
    this.following = true;
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
  }

  private renderPlayer(t: number, dtMs: number, moving: boolean, dirX: number) {
    if (!this.currentMap || !this.playerPuppet) return;
    const map = this.currentMap;
    const s = depthScale(map, this.py);
    const bob = this.playerPuppet.pose(t, dtMs, moving, dirX, this.px, this.py, s, () => this.spawnDust(s), this.lastDirY);
    const depth = map.kind === 'plane' ? this.py : 20;
    this.player.setDepth(depth);

    const w = SPRITE_H * s * this.playerAspect;
    const lift = bob / Math.max(1, 9 * s);
    this.playerShadow.setPosition(this.px, this.py - 2);
    this.playerShadow.setScale((w / 120) * (1.05 - 0.28 * lift), s);
    this.playerShadow.setAlpha(0.3 - 0.13 * lift);
    this.playerShadow.setDepth(depth - 1);
  }

  private spawnDust(s: number) {
    const d = this.add.ellipse(
      this.px + (Math.random() * 26 - 13), this.py - 2,
      24 * s, 9 * s, 0xcfc8b4, 0.3,
    ).setDepth((this.currentMap?.kind === 'plane' ? this.py : 20) - 1);
    this.tweens.add({
      targets: d, alpha: 0, scaleX: 2, scaleY: 1.7, y: d.y - 7,
      duration: 380, ease: 'quad.out', onComplete: () => d.destroy(),
    });
  }

  /** Fill a room with background people. These are scenery — they never take
   * a tap, so they can't be confused with someone who needs you. */
  private spawnLife(map: MapDef) {
    // world-folk3 is a mother-AND-CHILD pair, not one person, so using it as a
    // single background figure renders a lone child at adult scale beside the
    // others. It is excluded here for the same reason it is excluded from the
    // walking pool outdoors.
    const pool = ['world-folk1', 'world-folk2', 'world-folk4']
      .filter((k) => this.textures.exists(k));
    if (!pool.length || !map.life) return;
    map.life.forEach((spec, i) => {
      const key = pool[i % pool.length];
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
      const aspect = src.width / src.height;
      const img = this.add.image(spec.x, spec.y, key).setOrigin(0.5, 1);
      img.setDisplaySize(spec.h * aspect, spec.h);
      img.setDepth(12);
      if (spec.flip) img.setFlipX(true);

      if (spec.mode === 'seated') {
        // A standing render can only read as seated if it stops exactly where
        // the furniture starts. Crop to head-and-torso, then place that cut
        // edge on the table line: the tablecloth carries on from the waist.
        const FRAC = 0.52;
        img.setCrop(0, 0, src.width, src.height * FRAC);
        // cropping keeps texture-space position, so the visible bottom ends up
        // (1 - FRAC) of the display height above the anchor
        img.y = (spec.sitY ?? spec.y) + (1 - FRAC) * spec.h;
        img.setDepth(6);
        // settled: a slow breath, nothing that moves them off their chair
        this.tweens.add({
          targets: img, y: img.y - 2, duration: 2400 + i * 190,
          yoyo: true, repeat: -1, ease: 'sine.inout',
        });
      } else if (spec.mode === 'work') {
        // heads-down over a station: a small working bob and lean
        this.tweens.add({
          targets: img, y: spec.y - 6, duration: 620 + i * 60,
          yoyo: true, repeat: -1, ease: 'sine.inout',
        });
        this.tweens.add({
          targets: img, rotation: (spec.flip ? -1 : 1) * 0.04, duration: 780 + i * 70,
          yoyo: true, repeat: -1, ease: 'sine.inout',
        });
      } else {
        // holding a post. Standing renders slid along a tween read as
        // mannequins on rails, so staff stay put and only breathe.
        this.tweens.add({
          targets: img, y: spec.y - 3, duration: 2100 + i * 160,
          yoyo: true, repeat: -1, ease: 'sine.inout',
        });
      }
      this.mapObjects.push(img);
    });
  }

  clearNpcs() {
    for (const a of this.npcActors) {
      a.puppet.destroy();
      a.shadow.destroy();
      a.label?.destroy();
      a.marker?.destroy();
    }
    this.npcActors = [];
  }

  clearMarkers() {
    this.markerObjs.forEach((o) => o.destroy());
    this.markerObjs = [];
    this.markerSpots = [];
  }

  clearCars() {
    this.cars.forEach((c) => { c.img.destroy(); c.shadow.destroy(); });
    this.cars = [];
  }

  /** Traffic on the baked street grid. Cars are pure top-down sprites, so a
   * single artwork rotates to drive in any direction. */
  private spawnCars() {
    for (const base of CAR_SPECS) {
      if (!this.textures.exists(base.key)) continue;
      const spec: CarSpec = { ...base };
      // the sprite already faces the right way; rotating it would break the
      // isometric projection it was drawn in
      const src = this.textures.get(spec.key).getSourceImage() as HTMLImageElement;
      // the vehicle pack is drawn for a smaller grid than the city tiles, so
      // scale up to roughly half a tile width. Rotation stays untouched: the
      // sprite is already drawn in the isometric projection.
      const w = 68;
      const img = this.add.image(0, 0, spec.key).setOrigin(0.5, 0.8)
        .setDisplaySize(w, w * (src.height / src.width))
        // The sprites sit a few degrees shallower than the road they drive on,
        // so they read as tilting up out of the street. A small clockwise tilt
        // settles them onto it. One number, tuned by eye: measuring this from
        // the silhouette does not work -- a boxy car's widest direction is its
        // diagonal, not its length, so every automated angle came out wrong.
        .setRotation(CAR_TILT);
      const shadow = this.add.ellipse(0, 0, 54, 22, 0x000000, 0.18);
      this.cars.push({ spec, img, shadow });
    }
  }

  private updateCars(dt: number) {
    const map = this.currentMap;
    if (!map || map.kind !== 'plane') return;
    for (const { spec, img, shadow } of this.cars) {
      const { lane } = spec;
      const back = lane.head === 'ne' || lane.head === 'nw';
      spec.t += spec.speed * dt * (back ? -1 : 1);
      if (spec.t > lane.steps) spec.t -= lane.steps;
      if (spec.t < 0) spec.t += lane.steps;
      const x = lane.x + lane.dx * spec.t;
      const y = lane.y + lane.dy * spec.t;
      img.setPosition(x, y);
      img.setDepth(y);
      shadow.setPosition(x, y + 4);
      shadow.setDepth(y - 1);
    }
  }

  setNpcs(npcs: NpcSpec[]) {
    this.clearNpcs();
    this.npcSpecs = npcs;
    if (!this.currentMap) return;
    const plane = this.currentMap.kind === 'plane';

    const spawnActor = (
      spec: NpcSpec, ambient: boolean, radius: number, speed: number,
      route?: { x: number; y: number }[],
    ) => {
      // outdoors, everyone wears their overhead-angle render, and anyone
      // with a real walk cycle plays it
      const topKey = `${spec.texKey}-top`;
      const texKey = plane && this.textures.exists(topKey) ? topKey : spec.texKey;
      if (!this.textures.exists(texKey)) return;
      const walkKey = plane && spec.walkKey && this.textures.exists(spec.walkKey) ? spec.walkKey : undefined;
      const puppet = new Puppet(this, texKey, walkKey);
      puppet.facing = -1; // arrive facing the room
      const shadow = this.add.ellipse(0, 0, 120, 14, 0x000000, 0.28);
      const label = !ambient && spec.name
        ? this.add.text(0, 0, spec.name, {
          fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
          backgroundColor: '#12141dcc', padding: { x: 7, y: 3 } as any,
        }).setOrigin(0.5, 1).setDepth(2800)
        : null;
      const marker = !ambient
        ? this.add.text(0, 0, spec.bang ? '❗' : '💬', { fontSize: '22px' }).setOrigin(0.5, 0.5).setDepth(2800)
        : null;
      this.npcActors.push({
        spec, puppet, shadow, label, marker,
        x: spec.x, y: spec.y, homeX: spec.x, homeY: spec.y,
        radius, tx: spec.x, ty: spec.y,
        state: 'idle', nextAt: this.time.now + 600 + Math.random() * 3000,
        speed, ambient, route, routeIdx: 0,
      });
    };

    for (const n of npcs) {
      // Only people with a real walk cycle are allowed to move. A static
      // render sliding around with a bob is what read as broken motion —
      // so the rest simply stand where they are.
      spawnActor(n, false, 0, 0);
    }

    if (plane) {
      // street life: ordinary townsfolk out for a walk, running errands,
      // heading somewhere. Families included.
      // ONLY sprites with a real walk cycle are given a route. A sprite with no
      // cycle still moves if you hand it one -- it just glides along the
      // pavement with its legs frozen, which is the single most obviously wrong
      // motion in the scene. world-folk3 (the family pair) has no sheet, so it
      // stands as scenery instead of skating.
      const folk = [
        { tex: 'world-folk1', walk: 'walk-folk1' },
        { tex: 'world-folk2', walk: 'walk-folk2' },
        { tex: 'world-folk4', walk: 'walk-folk4' },
      ].filter((f) => this.textures.exists(f.tex) && this.textures.exists(f.walk));
      const standers = ['world-folk3'].filter((t) => this.textures.exists(t));
      // Each pedestrian is handed a pavement loop out of the layout and walks
      // it. Every point on a loop is a footpath cell, so a pedestrian cannot
      // end up walking down the middle of the carriageway.
      const routes = CITY_LAYOUT.routes as { x: number; y: number }[][];
      if (folk.length && routes.length) {
        routes.forEach((route, i) => {
          for (let k = 0; k < 2; k++) {     // two people per block, opposite sides
            const f = folk[(i + k) % folk.length];
            const start = Math.floor((k * route.length) / 2);
            const p = route[start];
            spawnActor(
              { id: `folk-${i}-${k}`, texKey: f.tex, walkKey: f.walk, aspect: 0, name: '', x: p.x, y: p.y, bang: false },
              true, 1, 30 + Math.random() * 14, route,
            );
            const a = this.npcActors[this.npcActors.length - 1];
            if (a) a.routeIdx = start;
          }
          // one stationary bystander every few blocks, radius 0 so it never moves
          if (standers.length && i % 3 === 0) {
            const p = route[Math.floor(route.length * 0.4)];
            spawnActor(
              { id: `stand-${i}`, texKey: standers[0], aspect: 0, name: '', x: p.x, y: p.y, bang: false },
              true, 0, 0,
            );
          }
        });
      }
    }
  }

  /** Quest markers floating on the things you can pitch in on:
   * gold ⚡ = available, green ✓ = done this month, dimmed = too tired. */
  setActivities(states: ActivityState[]) {
    this.clearMarkers();
    if (!this.currentMap) return;
    for (const spot of this.currentMap.spots) {
      const state = states.find((a) => a.id === spot.id);
      if (!state) continue;
      const available = !state.done && !state.disabled;
      const ring = this.add.circle(0, 0, 26, 0x12141d, 0.88)
        .setStrokeStyle(2.5, state.done ? 0x5ac47f : 0xe8c86a, available ? 1 : 0.5);
      const glyph = this.add.text(0, 0, state.done ? '✓' : '⚡', {
        fontSize: '26px', color: state.done ? '#5ac47f' : '#e8c86a',
      }).setOrigin(0.5, 0.54);
      const label = this.add.text(0, 40, state.done ? `${state.label} ✓` : state.label, {
        fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
        backgroundColor: '#12141daa', padding: { x: 8, y: 3 } as any,
      }).setOrigin(0.5, 0);
      const marker = this.add.container(spot.x, spot.y, [ring, glyph, label]).setDepth(3000);
      marker.setAlpha(available ? 1 : 0.45);
      if (available) {
        this.tweens.add({ targets: marker, y: spot.y - 12, duration: 700, yoyo: true, repeat: -1, ease: 'sine.inout' });
        this.tweens.add({ targets: ring, scaleX: 1.14, scaleY: 1.14, duration: 700, yoyo: true, repeat: -1, ease: 'sine.inout' });
      }
      this.markerObjs.push(marker);
      this.markerSpots.push({ spot, state });
    }
  }

  private refollow() {
    if (this.following) return;
    this.following = true;
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
  }

  walkTo(x: number, y: number) {
    if (!this.currentMap) return;
    this.refollow();
    const map = this.currentMap;
    const half = (SPRITE_H * this.playerAspect) / 2;
    const tx = Phaser.Math.Clamp(x, half + 10, map.width - half - 10);
    const ty = map.kind === 'plane'
      ? Phaser.Math.Clamp(y, TOWN_MIN_Y, TOWN_MAX_Y)
      : GROUND;
    this.target = { x: tx, y: ty };
  }

  update(t: number, dtMs: number) {
    if (!this.player || !this.currentMap) return;
    const map = this.currentMap;
    const dt = dtMs / 1000;

    // pinch-zoom with two touches
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    if (p1?.isDown && p2?.isDown) {
      const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      if (this.pinchDist != null && this.pinchDist > 0) this.zoomBy(d / this.pinchDist);
      this.pinchDist = d;
      this.target = null;
    } else {
      this.pinchDist = null;
    }
    let vx = 0;
    let vy = 0;
    const kb = this.cursors;
    if (kb?.left?.isDown || this.wasd?.A?.isDown) vx = -1;
    else if (kb?.right?.isDown || this.wasd?.D?.isDown) vx = 1;
    if (map.kind === 'plane') {
      if (kb?.up?.isDown || this.wasd?.W?.isDown) vy = -1;
      else if (kb?.down?.isDown || this.wasd?.S?.isDown) vy = 1;
    }

    if (vx !== 0 || vy !== 0) {
      this.target = null;
      this.pendingWalkAction = null;
      this.refollow();
    } else if (this.target) {
      const dx = this.target.x - this.px;
      const dy = this.target.y - this.py;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) {
        this.target = null;
        const act = this.pendingWalkAction;
        this.pendingWalkAction = null;
        act?.();
      } else {
        vx = dx / dist;
        vy = dy / dist;
      }
    }

    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      const norm = Math.hypot(vx, vy) || 1;
      const speed = WALK_SPEED * depthScale(map, this.py); // closer = faster, keeps pace feeling even
      const half = (SPRITE_H * this.playerAspect) / 2;
      this.px = Phaser.Math.Clamp(this.px + (vx / norm) * speed * dt, half + 10, map.width - half - 10);
      this.py = map.kind === 'plane'
        ? Phaser.Math.Clamp(this.py + (vy / norm) * speed * 0.72 * dt, TOWN_MIN_Y, TOWN_MAX_Y)
        : GROUND;
      this.lastDirY = vy / (Math.hypot(vx, vy) || 1);
      this.renderPlayer(t, dtMs, true, vx !== 0 ? vx / (Math.hypot(vx, vy) || 1) : 0);
    } else {
      this.renderPlayer(t, dtMs, false, 0);
    }

    this.updateCars(dt);

    // the townsfolk go about their day
    for (const a of this.npcActors) {
      const plane = map.kind === 'plane';
      let aMoving = false;
      let aDirX = 0;
      let aDirY = 0;
      if (plane && a.radius > 0) {
        if (a.state === 'walk') {
          const dx = a.tx - a.x;
          const dy = a.ty - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 6) {
            a.state = 'idle';
            a.nextAt = t + (a.route ? 120 + Math.random() * 500 : 1400 + Math.random() * 4200);
          } else {
            const sp = a.speed * depthScale(map, a.y);
            a.x += (dx / dist) * sp * dt;
            a.y += (dy / dist) * sp * dt * 0.8;
            aMoving = true;
            aDirX = dx / dist;
            aDirY = dy / dist;
          }
        } else if (t >= a.nextAt) {
          if (a.route && a.route.length > 1) {
            // step to the next point on the footpath loop. Every point is a
            // pavement cell out of the layout, so a pedestrian physically
            // cannot end up walking down the middle of the road.
            a.routeIdx = (a.routeIdx + 1) % a.route.length;
            const p = a.route[a.routeIdx];
            a.tx = p.x;
            a.ty = p.y;
          } else {
            a.tx = Phaser.Math.Clamp(a.homeX + (Math.random() * 2 - 1) * a.radius, 70, map.width - 70);
            a.ty = Phaser.Math.Clamp(a.homeY + (Math.random() * 2 - 1) * a.radius * 0.6, TOWN_MIN_Y, TOWN_MAX_Y);
          }
          a.state = 'walk';
        }
      }
      const s = depthScale(map, a.y);
      const bob = a.puppet.pose(t, dtMs, aMoving, aDirX, a.x, a.y, s, undefined, aDirY);
      const h = SPRITE_H * s;
      const depth = plane ? a.y : 15;
      a.puppet.container.setDepth(depth);
      const lift = bob / Math.max(1, 9 * s);
      a.shadow.setPosition(a.x, a.y - 2);
      a.shadow.setScale(((h * a.puppet.aspect) / 120) * (1.05 - 0.28 * lift), s);
      a.shadow.setAlpha(0.28 - 0.11 * lift);
      a.shadow.setDepth(depth - 1);
      a.label?.setPosition(a.x, a.y - h - 6 - bob);
      a.marker?.setPosition(a.x, a.y - h - 34 - bob + Math.sin(t / 230) * 5);
    }

    // door pills glow when you're close
    for (const { def, obj } of this.doorPills) {
      const near = Math.abs(this.px - def.tx) < 190 && Math.abs(this.py - def.ty) < 190;
      obj.setAlpha(near ? 1 : 0.72);
      obj.setScale(near ? 1.08 : 1);
    }
  }
}

/** Where you appear when a room transition happens. */
function spawnFor(room: WorldRoom, from: WorldRoom | null, location: string): { x: number; y: number } {
  const LM = landmarksFor(location);
  // on the street you stand outside whichever door you just came out of
  if (room === 'street') {
    const at = from === 'bank' ? LM.bankdoor : LM.enter;
    return { x: at.x, y: at.y + 80 };
  }
  if (room === 'inside') return { x: from === 'back' ? 1100 : 220, y: GROUND };
  if (room === 'back') return { x: from === 'office' ? 1100 : 220, y: GROUND };
  if (room === 'office') return { x: 220, y: GROUND };
  if (room === 'bank') return { x: 260, y: GROUND };
  return { x: 220, y: GROUND };
}

export default function CityWorld(props: Props) {
  const { business, location, width, room, onChangeRoom, playerArt, playerTopArt, playerPreset = 0, npcs, npcRoomsWithWork, onTalk, onBooks, onMenu, onAction, activities, onActivity } = props;
  const playerWalkKey = ownerHasWalk(playerPreset)
    ? `walk-owner${Math.max(0, playerPreset) + 1}` : undefined;
  const C = useTheme();
  const styles = useThemedStyles(makeStyles);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<WorldScene | null>(null);
  const lastRoom = useRef<WorldRoom | null>(null);
  const maps = useMemo(() => mapsFor(business, location), [business, location]);

  const bridgeRef = useRef<Bridge>({ onDoor: () => {}, onTalk: () => {}, onActivity: () => {} });
  bridgeRef.current = {
    onTalk: (id) => onTalk(id),
    onActivity: (id) => onActivity(id),
    onDoor: (id) => {
      if (id === 'enter') onChangeRoom('inside');
      else if (id === 'bankdoor') onChangeRoom('bank');
      else if (id === 'exitbank') onChangeRoom('street');
      else if (id === 'street' || id === 'inside' || id === 'back' || id === 'office') onChangeRoom(id);
      else if (id === 'menu') onMenu();
      else if (id === 'books') onBooks();
      else if (id === 'expand2') onAction('expand');
      else onAction(id); // team / ads / expand / biz-* buildings
    },
  };

  // texture manifest: interiors + world plane assets + every character cutout
  const manifest = useMemo(() => {
    const m: Record<string, string> = {};
    const scene = (key: string, artKey: string) => {
      const mod = sceneModule(artKey);
      if (mod != null) m[key] = Asset.fromModule(mod).uri;
    };
    scene('bg-inside', `${business}-inside`);
    scene('bg-back', 'back');
    scene('bg-office', 'office');
    scene('bg-bank', 'bank');
    for (const [key, mod] of Object.entries(WORLD_ART)) m[key] = Asset.fromModule(mod).uri;
    for (const [key, mod] of Object.entries(WALK_SHEETS)) m[key] = Asset.fromModule(mod).uri;
    if (playerArt) m['char-player'] = Asset.fromModule(playerArt.src).uri;
    if (playerTopArt) m['char-player-top'] = Asset.fromModule(playerTopArt.src).uri;
    const chars: CharacterId[] = ['manager', 'accountant', 'supplier', 'regular', 'banker', 'contractor', 'inspector', 'rival', 'influencer', 'neighbor', 'landlord'];
    for (const c of chars) {
      const cut = castCut(c);
      if (cut) m[`char-${c}`] = Asset.fromModule(cut.src).uri;
      const top = castTop(c);
      if (top) m[`char-${c}-top`] = Asset.fromModule(top.src).uri;
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business, playerArt?.src, playerTopArt?.src]);

  // reverse lookup: a Cut's module src → its texture key + aspect
  const charBySrc = useMemo(() => {
    const map = new Map<number, { key: string; aspect: number }>();
    const chars: CharacterId[] = ['manager', 'accountant', 'supplier', 'regular', 'banker', 'contractor', 'inspector', 'rival', 'influencer', 'neighbor', 'landlord'];
    for (const c of chars) {
      const cut = castCut(c);
      if (cut) map.set(cut.src, { key: `char-${c}`, aspect: cut.aspect });
    }
    return map;
  }, []);

  // the scene syncs from live values, not from whichever render booted it
  const liveRef = useRef({ room, npcs, activities });
  liveRef.current = { room, npcs, activities };
  const lastSig = useRef('');

  const syncWorld = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    const { room: liveRoom, npcs: liveNpcs, activities: liveActs } = liveRef.current;
    const map = maps[liveRoom] ?? maps.street;
    const roomChanged = lastRoom.current !== liveRoom;
    if (roomChanged) {
      scene.setMap(map, spawnFor(liveRoom, lastRoom.current, location));
      lastRoom.current = liveRoom;
    }
    const specs: NpcSpec[] = [];
    liveNpcs.forEach((n, i) => {
      const tex = n.art ? charBySrc.get(n.art.src) : null;
      if (!tex) return;
      const slot = map.slots[i % map.slots.length];
      specs.push({ id: n.id, texKey: tex.key, aspect: tex.aspect, name: n.name ?? '', x: slot.x, y: slot.y, bang: true });
    });
    for (const f of map.fixedNpcs) {
      const cut = castCut(f.char);
      if (!cut) continue;
      // a person can't be in two places: if this character already has
      // scenario business in the room, their idle town-copy stands down
      if (specs.some((sp) => sp.texKey === `char-${f.char}`)) continue;
      specs.push({ id: f.talkId, texKey: `char-${f.char}`, aspect: cut.aspect, name: f.name, x: f.x, y: f.y, bang: false });
    }
    const acts: ActivityState[] = liveActs.map((a) => ({ id: a.id, label: a.label, done: a.done, disabled: a.disabled }));
    // ticker re-renders arrive constantly — only touch the world when it changed
    const sig = JSON.stringify([specs, acts]);
    if (roomChanged || sig !== lastSig.current) {
      lastSig.current = sig;
      scene.setNpcs(specs);
      scene.setActivities(acts);
    }
  };

  // boot the engine once
  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: VIEW_W,
      height: VIEW_H,
      backgroundColor: '#141b12',
      // dispatch the whole manifest in one batch: the loader only advances
      // its queue on a game tick, which a backgrounded tab may never give
      loader: { maxParallelDownloads: 200, timeout: 30000 },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: WorldScene,
      callbacks: {
        preBoot: (g) => {
          g.registry.set('manifest', manifest);
          g.registry.set('playerWalkKey', playerWalkKey);
          g.registry.set('bridge', bridgeRef);
          g.registry.set('onReady', (s: WorldScene) => {
            sceneRef.current = s;
            if (playerArt) s.setPlayerTexture('char-player', playerArt.aspect);
            lastRoom.current = null;
            syncWorld();
          });
        },
      },
    });
    gameRef.current = game;
    return () => {
      sceneRef.current = null;
      gameRef.current = null;
      game.destroy(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the world in sync with React state
  useEffect(() => {
    syncWorld();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, npcs, activities, maps]);

  const canvasH = Math.round(width * (VIEW_H / VIEW_W));

  return (
    <View>
      <View>
        {React.createElement('div', {
          ref: containerRef,
          style: { width: '100%', height: canvasH, borderRadius: 14, overflow: 'hidden', marginTop: 6 },
        })}
        {/* zoom controls float over the town (interiors lock to 1×) */}
        {(room === 'street') && (
          <View style={styles.zoomCol} pointerEvents="box-none">
            <Pressable style={styles.zoomBtn} onPress={() => { playSfx('tap'); sceneRef.current?.zoomByFollowing(1.25); }}>
              <Text style={styles.zoomText}>＋</Text>
            </Pressable>
            <Pressable style={styles.zoomBtn} onPress={() => { playSfx('tap'); sceneRef.current?.zoomByFollowing(0.8); }}>
              <Text style={styles.zoomText}>－</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* quick travel */}
      <View style={styles.tabs}>
        {(
          [
            { id: 'street' as WorldRoom, label: 'City' },
            { id: 'inside' as WorldRoom, label: 'Floor' },
            { id: 'back' as WorldRoom, label: 'Back' },
            { id: 'office' as WorldRoom, label: 'Office' },
          ]
        ).map((t) => {
          const active = room === t.id || (t.id === 'street' && room === 'bank');
          const hasWork = npcRoomsWithWork.includes(t.id as Venue);
          return (
            <Pressable key={t.id} onPress={() => { playSfx('tap'); onChangeRoom(t.id); }}
              style={[styles.tab, active && styles.tabActive]}>
              {tabIcon(t.id, active ? C.text : C.dim)}
              <Text style={[styles.tabLabel, active && { color: C.text }]}>{t.label}</Text>
              {hasWork && <View style={styles.tabDot} />}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.keysHint}>WASD / arrows to walk · tap to move · drag to look around · scroll or ＋/－ to zoom · signs open doors · ⚡ markers are work</Text>
    </View>
  );
}

function tabIcon(id: WorldRoom, color: string) {
  switch (id) {
    case 'street': return <IconStreet size={15} color={color} />;
    case 'inside': return <IconShop size={15} color={color} />;
    case 'back': return <IconBoxes size={15} color={color} />;
    default: return <IconDesk size={15} color={color} />;
  }
}

const makeStyles = (C: Palette) => StyleSheet.create({
  zoomCol: { position: 'absolute', top: 18, right: 12, gap: 8 },
  zoomBtn: {
    width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#12141dcc', borderWidth: 1, borderColor: '#8b93ad66',
  },
  zoomText: { color: '#e8ebf5', fontSize: 19, fontWeight: '800', lineHeight: 22 },
  tabs: { flexDirection: 'row', gap: 6, marginTop: 8 },
  tab: {
    flex: 1, alignItems: 'center', backgroundColor: C.card, borderRadius: 10,
    paddingVertical: 7, borderWidth: 1, borderColor: C.mode === 'light' ? C.border : 'transparent',
  },
  tabActive: { borderColor: C.accent, backgroundColor: C.cardAlt },
  tabLabel: { color: C.dim, fontSize: 9.5, fontWeight: '700', marginTop: 1 },
  tabDot: {
    position: 'absolute', top: 5, right: 8, width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.danger,
  },
  keysHint: { color: C.dim, fontSize: 10.5, textAlign: 'center', marginTop: 6 },
});
