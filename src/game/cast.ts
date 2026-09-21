/**
 * The cast. Interactive fiction needs faces: every scene in the game is
 * delivered by a recurring character with a portrait, a role, and a voice.
 */

export type Mood = 'neutral' | 'happy' | 'worried' | 'stern';

export type CharacterId =
  | 'manager'    // Sam — your right hand
  | 'landlord'   // Mrs. Okafor
  | 'banker'     // Mr. Grady
  | 'supplier'   // Tony
  | 'inspector'  // Inspector Vega
  | 'regular'    // Miss June — the neighborhood's voice
  | 'accountant' // Priya — reads you the books
  | 'contractor' // Dee
  | 'rival'      // Victor — owns the competition
  | 'influencer' // Zoe
  | 'neighbor'   // Marcus — runs the business next door
  | 'narrator';  // no portrait; italic slates

export type HairStyle = 'short' | 'curly' | 'bun' | 'long' | 'cap' | 'bald' | 'ponytail';

export interface CharacterLook {
  skin: string;
  hair: HairStyle;
  hairColor: string;
  clothes: string;
  accessory?: 'glasses' | 'clipboard' | 'hardhat' | 'tie' | 'apron' | 'phone' | 'scissorsPin' | 'brooch';
}

export interface Character {
  id: CharacterId;
  name: string;
  role: string;
  look: CharacterLook;
}

export const CAST: Record<Exclude<CharacterId, 'narrator'>, Character> = {
  manager: {
    id: 'manager', name: 'Sam', role: 'your right hand',
    look: { skin: '#c68863', hair: 'curly', hairColor: '#2b2320', clothes: '#4c6b4f', accessory: 'apron' },
  },
  landlord: {
    id: 'landlord', name: 'Mrs. Okafor', role: 'your landlord',
    look: { skin: '#8d5a3b', hair: 'bun', hairColor: '#3d3d3d', clothes: '#7a4b5e', accessory: 'brooch' },
  },
  banker: {
    id: 'banker', name: 'Mr. Grady', role: 'your banker',
    look: { skin: '#e8b48c', hair: 'short', hairColor: '#9a9a9a', clothes: '#33415c', accessory: 'tie' },
  },
  supplier: {
    id: 'supplier', name: 'Tony', role: 'supplier rep',
    look: { skin: '#d99a6c', hair: 'cap', hairColor: '#684b32', clothes: '#8a6a3d', accessory: 'clipboard' },
  },
  inspector: {
    id: 'inspector', name: 'Inspector Vega', role: 'health & safety',
    look: { skin: '#b5754a', hair: 'ponytail', hairColor: '#1f1a17', clothes: '#3f5570', accessory: 'clipboard' },
  },
  regular: {
    id: 'regular', name: 'Miss June', role: 'your most loyal regular',
    look: { skin: '#f0c8a0', hair: 'bun', hairColor: '#dcdcdc', clothes: '#54497a', accessory: 'glasses' },
  },
  accountant: {
    id: 'accountant', name: 'Priya', role: 'your accountant',
    look: { skin: '#a86a3f', hair: 'long', hairColor: '#241d1a', clothes: '#356b6e', accessory: 'glasses' },
  },
  contractor: {
    id: 'contractor', name: 'Dee', role: 'contractor',
    look: { skin: '#7c4a2d', hair: 'short', hairColor: '#141210', clothes: '#b3833c', accessory: 'hardhat' },
  },
  rival: {
    id: 'rival', name: 'Victor', role: 'the competition',
    look: { skin: '#e3a875', hair: 'short', hairColor: '#20242c', clothes: '#5a2f33', accessory: 'tie' },
  },
  influencer: {
    id: 'influencer', name: 'Zoe', role: 'local influencer',
    look: { skin: '#caa06e', hair: 'long', hairColor: '#7a3b8f', clothes: '#c2588a', accessory: 'phone' },
  },
  neighbor: {
    id: 'neighbor', name: 'Marcus', role: 'runs the gym next door',
    look: { skin: '#6e4632', hair: 'bald', hairColor: '#1a1a1a', clothes: '#356b6e' },
  },
};

export function characterOf(id: CharacterId): Character | null {
  if (id === 'narrator') return null;
  return CAST[id];
}

/** The player picks a rendered owner at setup; `skin` holds the preset index
 * (hair/hairColor kept for save-shape stability). Each preset maps to a
 * matching mini look for the explorable world. */
export interface AvatarSpec {
  skin: number;      // owner preset index
  hair: number;
  hairColor: number;
}

export const OWNER_PRESETS: { name: string; look: CharacterLook }[] = [
  { name: 'Riley', look: { skin: '#f0c8a0', hair: 'ponytail', hairColor: '#b8583a', clothes: '#4a6b9f', accessory: 'apron' } },
  { name: 'Andre', look: { skin: '#d99a6c', hair: 'short', hairColor: '#241d1a', clothes: '#33415c', accessory: 'apron' } },
  { name: 'Imani', look: { skin: '#8d5a3b', hair: 'curly', hairColor: '#141210', clothes: '#b3833c', accessory: 'apron' } },
  { name: 'Ken', look: { skin: '#e8b48c', hair: 'short', hairColor: '#141210', clothes: '#4c6b4f', accessory: 'apron' } },
  { name: 'Malik', look: { skin: '#6e4632', hair: 'short', hairColor: '#141210', clothes: '#c2703d', accessory: 'apron' } },
];

export function avatarLook(a: AvatarSpec): CharacterLook {
  return OWNER_PRESETS[Math.max(0, a.skin) % OWNER_PRESETS.length].look;
}
