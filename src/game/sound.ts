import { AudioPlayer, createAudioPlayer } from 'expo-audio';

/**
 * Tiny fire-and-forget SFX manager. Sounds are synthesized WAVs bundled
 * with the app; everything is wrapped so audio can never crash the game.
 */

type SfxName = 'tap' | 'cash' | 'good' | 'bad';

const SOURCES: Record<SfxName, number> = {
  tap: require('../../assets/sfx/tap.wav'),
  cash: require('../../assets/sfx/cash.wav'),
  good: require('../../assets/sfx/good.wav'),
  bad: require('../../assets/sfx/bad.wav'),
};

const players: Partial<Record<SfxName, AudioPlayer>> = {};
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

export function isSoundEnabled() {
  return enabled;
}

export function playSfx(name: SfxName) {
  if (!enabled) return;
  try {
    let p = players[name];
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      players[name] = p;
    }
    p.seekTo(0);
    p.play();
  } catch {
    // no audio device / autoplay blocked — silently continue
  }
}
