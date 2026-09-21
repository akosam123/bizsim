import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';
import { CharacterLook, Mood } from '../game/cast';
import { playSfx } from '../game/sound';
import { BusinessId, LocationId, Venue } from '../game/types';
import CharacterSprite from './CharacterSprite';
import CutoutActor from './CutoutActor';
import { IconBank, IconBolt, IconBoxes, IconBroom, IconChart, IconDesk, IconDoor, IconMegaphone, IconMenu, IconShop, IconStreet, IconTeam, IconTray } from './icons';
import { Cut, castCut, ownerCut, sceneArt } from '../game/art';
import Interior from './Interior';
import SceneLight from './SceneLight';
import Storefront from './Storefront';
import Walkers from './Walkers';
import { Palette, useTheme, useThemedStyles } from './theme';

/**
 * The explorable world. Tap the floor and your owner walks there — legs
 * striding, facing the way they're headed. Rooms connect through doors
 * (and quick-travel tabs): street, shop floor, back of house, office.
 * People who need a decision wait in the right room under a bouncing "!".
 * Walk up, tap them, talk. Desks and menu boards are live hotspots.
 */

export interface WorldNpc {
  id: string;            // card index as string, or 'close' for month-end
  look: CharacterLook;
  mood: Mood;
  name: string;
  /** cutout render asset; falls back to the vector mini when null */
  art?: Cut | null;
}

interface Hotspot {
  id: string;
  xf: number;            // fraction of stage width
  label: string;
}

interface Props {
  business: BusinessId;
  location: LocationId;
  storeTier: number;
  crowd: number;
  reputation: number;
  width: number;
  room: Venue;
  onChangeRoom: (r: Venue) => void;
  playerLook: CharacterLook;
  playerArt?: Cut | null;
  npcs: WorldNpc[];                 // the ones waiting in THIS room
  npcRoomsWithWork: Venue[];        // rooms that have someone waiting (for tab badges)
  onTalk: (id: string) => void;
  onBooks: () => void;
  onMenu: () => void;
  /** player-initiated actions: 'bank' | 'team' | 'ads' | 'expand' */
  onAction: (id: string) => void;
  /** hands-on activities available in THIS room (earn AP) */
  activities: { id: string; label: string; hint: string; done: boolean; disabled: boolean }[];
  onActivity: (id: string) => void;
}

const ROOM_TABS: { id: Venue; label: string }[] = [
  { id: 'street', label: 'Street' },
  { id: 'inside', label: 'Floor' },
  { id: 'back', label: 'Back' },
  { id: 'office', label: 'Office' },
];

function tabIcon(id: Venue, color: string) {
  switch (id) {
    case 'street': return <IconStreet size={15} color={color} />;
    case 'inside': return <IconShop size={15} color={color} />;
    case 'back': return <IconBoxes size={15} color={color} />;
    case 'office': return <IconDesk size={15} color={color} />;
  }
}

function hotspotIcon(id: string) {
  switch (id) {
    case 'menu': return <IconMenu size={15} />;
    case 'books': return <IconChart size={15} />;
    case 'bank': return <IconBank size={15} />;
    case 'team': return <IconTeam size={15} color="#aeb9dd" />;
    case 'ads': return <IconMegaphone size={15} />;
    case 'expand': return <IconShop size={15} />;
    default: return <IconDoor size={15} />;
  }
}

function activityIcon(id: string, color: string) {
  switch (id) {
    case 'serve': return <IconTray size={14} color={color} />;
    case 'clean': return <IconBroom size={14} color={color} />;
    case 'help': return <IconTeam size={14} color={color} />;
    default: return <IconDesk size={14} color={color} />;
  }
}

const NPC_SLOTS = [0.36, 0.58, 0.78]; // spaced a sprite-width apart, all fully on-stage

function hotspotsFor(room: Venue): Hotspot[] {
  switch (room) {
    case 'street': return [
      { id: 'expand', xf: 0.14, label: 'For lease' },
      { id: 'enter', xf: 0.55, label: 'Go inside' },
      { id: 'bank', xf: 0.92, label: 'Bank' },
    ];
    case 'inside': return [
      { id: 'street', xf: 0.06, label: 'Street' },
      { id: 'menu', xf: 0.32, label: 'Menu board' },
      { id: 'back', xf: 0.94, label: 'Back room' },
    ];
    case 'back': return [
      { id: 'inside', xf: 0.1, label: 'Shop floor' },
      { id: 'team', xf: 0.52, label: 'Your team' },
      { id: 'office', xf: 0.94, label: 'Office' },
    ];
    case 'office': return [
      { id: 'back', xf: 0.08, label: 'Back room' },
      { id: 'ads', xf: 0.32, label: 'Run ads' },
      { id: 'books', xf: 0.62, label: 'The books' },
    ];
  }
}

export default function WorldStage(props: Props) {
  const { width, room, onChangeRoom, playerLook, playerArt, npcs, npcRoomsWithWork, onTalk, onBooks, onMenu, onAction, onActivity } = props;
  const C = useTheme();
  const styles = useThemedStyles(makeStyles);
  const sceneH = Math.max(240, width) * 0.55;
  const spriteH = sceneH * 0.74;
  const spriteW = spriteH * 0.5;
  const floorY = 2;

  const playerX = useRef(new Animated.Value(width * 0.16)).current;
  const playerXVal = useRef(width * 0.16);
  const [walking, setWalking] = useState(false);
  const [facing, setFacing] = useState<'left' | 'right'>('right');
  const walkAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const sub = playerX.addListener(({ value }) => { playerXVal.current = value; });
    return () => playerX.removeListener(sub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // entering a room: appear near the door you came through
  useEffect(() => {
    walkAnim.current?.stop();
    setWalking(false);
    playerX.setValue(width * 0.16);
    setFacing('right');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  const walkTo = (targetX: number, then?: () => void) => {
    const clamped = Math.max(6, Math.min(width - spriteW - 6, targetX));
    const dist = Math.abs(clamped - playerXVal.current);
    if (dist < 8) { then?.(); return; }
    setFacing(clamped > playerXVal.current ? 'right' : 'left');
    setWalking(true);
    walkAnim.current?.stop();
    walkAnim.current = Animated.timing(playerX, {
      toValue: clamped,
      duration: Math.max(240, dist * 4.2),
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    walkAnim.current.start(({ finished }) => {
      setWalking(false);
      if (finished) then?.();
    });
  };

  const handleFloorTap = (e: any) => {
    const x = e.nativeEvent?.locationX ?? e.nativeEvent?.offsetX;
    if (typeof x !== 'number') return;
    walkTo(x - spriteW / 2);
  };

  const activateHotspot = (h: Hotspot) => {
    playSfx('tap');
    const hx = h.xf * width - spriteW / 2;
    walkTo(hx, () => {
      if (h.id === 'menu') onMenu();
      else if (h.id === 'books') onBooks();
      else if (h.id === 'bank' || h.id === 'team' || h.id === 'ads' || h.id === 'expand') onAction(h.id);
      else if (h.id === 'enter') onChangeRoom('inside');
      else onChangeRoom(h.id as Venue);
    });
  };

  const startActivity = (id: string) => {
    playSfx('tap');
    // walk to the middle of the room, then get to work
    walkTo(width * 0.45 - spriteW / 2, () => onActivity(id));
  };

  const talkTo = (npc: WorldNpc, slotX: number) => {
    playSfx('tap');
    walkTo(slotX - spriteW * 0.9, () => onTalk(npc.id));
  };

  const backdrop = sceneArt(props.business, room);
  return (
    <View>
      <View style={[styles.stage, { height: sceneH }]}>
        {backdrop != null ? (
          <Image source={backdrop} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : room === 'street' ? (
          <Storefront
            business={props.business} location={props.location} storeTier={props.storeTier}
            crowd={props.crowd} reputation={props.reputation} width={width} hideCustomers
          />
        ) : (
          <Interior
            business={props.business} storeTier={props.storeTier} width={width}
            crowd={props.crowd} room={room === 'inside' ? 'inside' : room}
          />
        )}
        {backdrop == null && room === 'street' && <Walkers count={Math.round(props.crowd * 8)} sceneWidth={width} />}
        {backdrop == null && room === 'street' && <DriftingCloud width={width} />}
        <SceneLight width={width} />

        {/* tap-to-walk surface */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleFloorTap} />

        {/* hotspots */}
        {hotspotsFor(room).map((h) => (
          <HotspotMarker key={h.id} hotspot={h} width={width} onPress={() => activateHotspot(h)} />
        ))}

        {/* the people waiting on you */}
        {npcs.map((npc, i) => {
          const slotX = NPC_SLOTS[i % NPC_SLOTS.length] * width;
          return (
            <NpcView key={npc.id} npc={npc} x={slotX} spriteH={spriteH} floorY={floorY}
              onPress={() => talkTo(npc, slotX)} />
          );
        })}

        {/* you, the owner */}
        <Animated.View pointerEvents="none"
          style={[styles.player, { bottom: floorY, transform: [{ translateX: playerX }] }]}>
          <WalkBob walking={walking}>
            {playerArt != null ? (
              <CutoutActor art={playerArt} height={spriteH} facing={facing} walking={walking} />
            ) : (
              <CharacterSprite look={playerLook} mood="neutral" walking={walking} facing={facing} height={spriteH} />
            )}
          </WalkBob>
        </Animated.View>
      </View>

      {/* pitch in: hands-on work in this room earns AP */}
      {props.activities.length > 0 && (
        <View style={styles.activityRow}>
          {props.activities.map((a) => {
            const inactive = a.done || a.disabled;
            return (
              <Pressable
                key={a.id}
                onPress={() => !inactive && startActivity(a.id)}
                style={[styles.activityBtn, inactive && { opacity: 0.45 }]}
              >
                {activityIcon(a.id, a.done ? C.accent : C.icon)}
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityLabel} numberOfLines={1}>{a.done ? `${a.label} ✓` : a.label}</Text>
                  <Text style={styles.activityHint} numberOfLines={1}>{a.done ? 'Done this month' : a.hint}</Text>
                </View>
                {!a.done && <IconBolt size={12} color={C.apText} />}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* room tabs */}
      <View style={styles.tabs}>
        {ROOM_TABS.map((t) => {
          const active = room === t.id;
          const hasWork = npcRoomsWithWork.includes(t.id);
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
    </View>
  );
}

/** subtle vertical bob while the player walks */
function WalkBob({ walking, children }: { walking: boolean; children: React.ReactNode }) {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!walking) { bob.stopAnimation(); bob.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 160, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 160, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walking]);
  return (
    <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }}>
      {children}
    </Animated.View>
  );
}

function NpcView({ npc, x, spriteH, floorY, onPress }: {
  npc: WorldNpc; x: number; spriteH: number; floorY: number; onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const bounce = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const b = Animated.loop(Animated.sequence([
      Animated.timing(bounce, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    const br = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    b.start(); br.start();
    return () => { b.stop(); br.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View style={[styles.npc, {
      left: x, bottom: floorY,
      transform: [{ translateY: breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }],
    }]}>
      <Pressable onPress={onPress} hitSlop={8}>
        <Animated.View style={[styles.bang, {
          transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }],
        }]}>
          <Text style={styles.bangText}>❗</Text>
        </Animated.View>
        {npc.art != null ? (
          <CutoutActor art={npc.art} height={spriteH} facing="left" mood={npc.mood} />
        ) : (
          <CharacterSprite look={npc.look} mood={npc.mood} facing="left" height={spriteH} />
        )}
        <Text style={styles.npcName}>{npc.name}</Text>
      </Pressable>
    </Animated.View>
  );
}

function HotspotMarker({ hotspot, width, onPress }: { hotspot: Hotspot; width: number; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View style={[styles.hotspot, {
      left: hotspot.xf * width - 20,
      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }),
      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
    }]}>
      <Pressable onPress={onPress} hitSlop={6} style={styles.hotspotInner}>
        {hotspotIcon(hotspot.id)}
        <Text style={styles.hotspotLabel}>{hotspot.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function DriftingCloud({ width }: { width: number }) {
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(drift, {
      toValue: 1, duration: 34000, easing: Easing.linear, useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', top: 8,
      transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-90, width + 90] }) }],
    }}>
      <Svg width={80} height={26} viewBox="0 0 80 26">
        <Ellipse cx={30} cy={16} rx={28} ry={9} fill="#ffffff" opacity={0.5} />
        <Ellipse cx={52} cy={11} rx={18} ry={7} fill="#ffffff" opacity={0.5} />
      </Svg>
    </Animated.View>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  // overlays ON the art keep fixed dark scrims — art needs them in any theme
  stage: { borderRadius: 14, overflow: 'hidden', marginTop: 6 },
  player: { position: 'absolute', left: 0 },
  npc: { position: 'absolute', alignItems: 'center' },
  bang: { alignSelf: 'center', marginBottom: -2 },
  bangText: { fontSize: 17 },
  npcName: {
    alignSelf: 'center', color: '#fff', fontSize: 10, fontWeight: '700',
    backgroundColor: '#12141dbb', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
    overflow: 'hidden', marginTop: -4,
  },
  hotspot: { position: 'absolute', top: 8 },
  hotspotInner: {
    alignItems: 'center', backgroundColor: '#12141dcc', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  hotspotLabel: { color: '#cdd3e3', fontSize: 8.5, fontWeight: '700', marginTop: 1 },
  // chrome below the stage follows the theme
  activityRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  activityBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.card, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 9,
    borderWidth: 1, borderColor: C.border,
  },
  activityLabel: { color: C.text, fontSize: 11, fontWeight: '700' },
  activityHint: { color: C.dim, fontSize: 9, marginTop: 1 },
  tabs: { flexDirection: 'row', gap: 6, marginTop: 8 },
  tab: {
    flex: 1, alignItems: 'center', backgroundColor: C.card, borderRadius: 10,
    paddingVertical: 7, borderWidth: 1, borderColor: C.mode === 'light' ? C.border : 'transparent',
  },
  tabActive: { borderColor: C.accent, backgroundColor: C.cardAlt },
  tabIcon: { fontSize: 14 },
  tabLabel: { color: C.dim, fontSize: 9.5, fontWeight: '700', marginTop: 1 },
  tabDot: {
    position: 'absolute', top: 5, right: 8, width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.danger,
  },
});
