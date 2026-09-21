import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { CharacterLook, Mood } from '../game/cast';
import { BusinessId, LocationId, Venue } from '../game/types';
import CharacterSprite from './CharacterSprite';
import CutoutActor from './CutoutActor';
import { Cut, sceneArt } from '../game/art';
import Interior from './Interior';
import SceneLight from './SceneLight';
import Storefront from './Storefront';
import Walkers from './Walkers';
import { COLORS } from './ui';

/**
 * The stage: your storefront is the set, and scenes play ON it.
 * Characters walk in along the sidewalk, stand in front of the shop,
 * breathe, and react — a hop when things go well, a slump-wiggle when
 * they don't. The dialogue box overlaps the bottom like a visual novel.
 */

interface Actor {
  key: string | number;   // changing it makes the actor walk in again
  look: CharacterLook;
  mood: Mood;
  name?: string;
  role?: string;
  talking?: boolean;
  art?: Cut | null;       // cutout render; vector mini when null
}

interface Props {
  business: BusinessId;
  location: LocationId;
  storeTier: number;
  crowd: number;
  reputation: number;
  width: number;
  venue?: Venue;
  actor?: Actor | null;
  /** the owner, standing in on the right side of the conversation */
  player?: CharacterLook | null;
  playerArt?: Cut | null;
  /** the owner reacts to outcomes too — smile on good news, frown on bad */
  playerMood?: Mood;
}

export default function Stage({ business, location, storeTier, crowd, reputation, width, venue = 'street', actor, player, playerArt, playerMood = 'neutral' }: Props) {
  const sceneH = Math.max(240, width) * 0.55;
  const spriteH = sceneH * 0.82;

  const backdrop = sceneArt(business, venue);
  return (
    <View style={[styles.stage, { height: sceneH }]}>
      {backdrop != null ? (
        <Image source={backdrop} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : venue === 'street' ? (
        <Storefront
          business={business}
          location={location}
          storeTier={storeTier}
          crowd={crowd}
          reputation={reputation}
          width={width}
          hideCustomers
        />
      ) : (
        <Interior
          business={business}
          storeTier={storeTier}
          width={width}
          crowd={crowd}
          room={venue}
        />
      )}
      {backdrop == null && venue === 'street' && <Walkers count={Math.round(crowd * 8)} sceneWidth={width} />}
      <SceneLight width={width} />
      {(playerArt || player) && (
        <View style={[styles.playerSide, { left: width * 0.68, bottom: 2 }]} pointerEvents="none">
          {playerArt ? (
            <CutoutActor art={playerArt} height={spriteH * 0.94} facing="left" mood={playerMood} />
          ) : (
            <CharacterSprite look={player!} mood={playerMood} facing="left" height={spriteH * 0.94} />
          )}
        </View>
      )}
      {actor && (
        <ActorView key={actor.key} actor={actor} width={width} spriteH={spriteH} />
      )}
      {actor?.name && (
        <View style={styles.nameChip}>
          <Text style={styles.nameText}>{actor.name}</Text>
          {actor.role ? <Text style={styles.roleText}> · {actor.role}</Text> : null}
        </View>
      )}
    </View>
  );
}

function ActorView({ actor, width, spriteH }: { actor: Actor; width: number; spriteH: number }) {
  const walk = useRef(new Animated.Value(0)).current;    // 0 = offstage left
  const bob = useRef(new Animated.Value(0)).current;     // walking / breathing bob
  const react = useRef(new Animated.Value(0)).current;   // hop / wiggle on mood change
  const mounted = useRef(false);

  // walk in from the left, bobbing, then settle into breathing
  useEffect(() => {
    walk.setValue(0);
    const stride = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 190, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 190, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    stride.start();
    Animated.timing(walk, { toValue: 1, duration: 850, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      stride.stop();
      // settle into slow breathing
      Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 0.35, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ).start();
    });
    return () => { walk.stopAnimation(); bob.stopAnimation(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // react physically when the mood changes mid-scene
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    react.setValue(0);
    if (actor.mood === 'happy') {
      // a little hop
      Animated.sequence([
        Animated.timing(react, { toValue: -14, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(react, { toValue: 0, friction: 4, tension: 90, useNativeDriver: true }),
      ]).start();
    } else if (actor.mood === 'worried' || actor.mood === 'stern') {
      // a deflating slump
      Animated.sequence([
        Animated.timing(react, { toValue: 6, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(react, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor.mood]);

  const translateX = walk.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.45, 0] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const tilt = walk.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-2deg', '2deg', '0deg'] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.actor,
        { left: width * 0.07, transform: [{ translateX }, { translateY: Animated.add(bobY, react) }, { rotate: tilt }] },
      ]}
    >
      {actor.art != null ? (
        <CutoutActor art={actor.art} height={spriteH} talking={actor.talking} mood={actor.mood} />
      ) : (
        <CharacterSprite look={actor.look} mood={actor.mood} talking={actor.talking} height={spriteH} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: { borderRadius: 14, overflow: 'hidden', marginTop: 6 },
  actor: { position: 'absolute', bottom: 2 },
  playerSide: { position: 'absolute' },
  nameChip: {
    position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'baseline',
    backgroundColor: '#12141dcc', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5,
  },
  nameText: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  roleText: { color: COLORS.dim, fontSize: 11 },
});
