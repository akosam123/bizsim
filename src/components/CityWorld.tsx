import React from 'react';
import { CharacterLook } from '../game/cast';
import { Cut } from '../game/art';
import { BusinessId, LocationId, Venue, WorldRoom } from '../game/types';
import WorldStage, { WorldNpc } from './WorldStage';

/**
 * Native fallback for the game world. The web build gets the full Phaser
 * city (CityWorld.web.tsx); on iOS/Android we keep the room-by-room world,
 * where the bank and the lease are hotspots that open their panels directly.
 */

interface Props {
  business: BusinessId;
  location: LocationId;
  storeTier: number;
  crowd: number;
  reputation: number;
  width: number;
  room: WorldRoom;
  onChangeRoom: (r: WorldRoom) => void;
  playerLook: CharacterLook;
  playerArt?: Cut | null;
  /** web-only: the overhead-angle render used on the world plane */
  playerTopArt?: Cut | null;
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

export default function CityWorld(props: Props) {
  const room: Venue = props.room === 'bank' ? 'street' : props.room;
  return (
    <WorldStage
      {...props}
      room={room}
      onChangeRoom={(r) => props.onChangeRoom(r)}
    />
  );
}
