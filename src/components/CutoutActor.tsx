import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { Cut } from '../game/art';
import { Mood } from '../game/cast';

/**
 * A rendered character standing in the world: the CGI cutout on a soft
 * ground shadow. Sways gently on its feet, leans into its stride while
 * walking (paper-puppet style), and gives a subtle talking pulse.
 * Flip `facing` to turn around.
 *
 * A single render can't change its face, so mood plays as body language +
 * an emote burst: good news pops a 😊 with a happy double-hop, bad news
 * floats a 😟/😠 while the figure sags.
 */

interface Props {
  art: Cut;
  height: number;
  facing?: 'left' | 'right';
  walking?: boolean;
  talking?: boolean;
  mood?: Mood;
}

const MOOD_EMOTE: Record<Mood, string | null> = {
  neutral: null, happy: '😊', worried: '😟', stern: '😠',
};

export default function CutoutActor({ art, height, facing = 'right', walking, talking, mood = 'neutral' }: Props) {
  const sway = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const react = useRef(new Animated.Value(0)).current;   // one-shot hop/sag on mood change
  const burst = useRef(new Animated.Value(0)).current;   // emote rise + fade
  const [emote, setEmote] = useState<string | null>(null);
  const prevMood = useRef<Mood>(mood);
  const width = height * art.aspect;

  // idle sway / walking rock
  useEffect(() => {
    sway.setValue(0);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(sway, { toValue: 1, duration: walking ? 220 : 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(sway, { toValue: 0, duration: walking ? 220 : 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walking]);

  // talking pulse
  useEffect(() => {
    if (!talking) { pulse.stopAnimation(); pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talking]);

  // mood change → emote burst + body reaction
  useEffect(() => {
    if (mood === prevMood.current) return;
    prevMood.current = mood;
    const face = MOOD_EMOTE[mood];
    if (!face) { setEmote(null); return; }
    setEmote(face);

    burst.setValue(0);
    Animated.timing(burst, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true })
      .start(({ finished }) => { if (finished) setEmote(null); });

    react.setValue(0);
    if (mood === 'happy') {
      // double hop
      Animated.sequence([
        Animated.timing(react, { toValue: -1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(react, { toValue: 0, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(react, { toValue: -0.7, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(react, { toValue: 0, duration: 130, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start();
    } else {
      // sag, hold a beat, recover
      Animated.sequence([
        Animated.timing(react, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(react, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);

  const rock = sway.interpolate({ inputRange: [0, 1], outputRange: walking ? ['-3deg', '3deg'] : ['-0.8deg', '0.8deg'] });
  const hop = sway.interpolate({ inputRange: [0, 1], outputRange: [0, walking ? -5 : -2] });
  const talkScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
  const reactY = react.interpolate({ inputRange: [-1, 0, 1], outputRange: [-height * 0.03, 0, height * 0.035] });
  const reactLean = react.interpolate({ inputRange: [-1, 0, 1], outputRange: ['0deg', '0deg', '4deg'] });

  const emoteY = burst.interpolate({ inputRange: [0, 1], outputRange: [0, -34] });
  const emoteOpacity = burst.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 1, 1, 0] });
  const emoteScale = burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1.15, 1] });

  return (
    <View style={{ width, height: height + 8, alignItems: 'center' }}>
      {/* ground shadow */}
      <View style={[styles.shadow, { width: width * 0.66, bottom: 0 }]} />
      <Animated.View style={{
        transform: [
          { scaleX: facing === 'left' ? -1 : 1 },
          { translateY: Animated.add(hop, reactY) as any },
          { rotate: rock },
          { rotate: reactLean },
          { scale: talkScale },
        ],
      }}>
        <Image source={art.src} style={{ width, height }} resizeMode="contain" />
      </Animated.View>
      {emote && (
        <Animated.View style={[styles.emote, {
          opacity: emoteOpacity,
          transform: [{ translateY: emoteY }, { scale: emoteScale }],
        }]} pointerEvents="none">
          <Text style={styles.emoteText}>{emote}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute', height: 10, borderRadius: 999,
    backgroundColor: '#000000', opacity: 0.28,
  },
  emote: {
    position: 'absolute', top: -8, alignSelf: 'center',
    backgroundColor: '#ffffffee', borderRadius: 999,
    paddingHorizontal: 5, paddingVertical: 3,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  emoteText: { fontSize: 18 },
});
