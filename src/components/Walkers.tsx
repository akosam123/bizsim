import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

/**
 * Little pedestrians strolling along the sidewalk, overlaid on the
 * storefront scene. Count scales with how busy the business is.
 */

const TONES = ['#3f5570', '#7a4b5e', '#4c6b4f', '#8a6a3d', '#54497a', '#356b6e', '#6e4632', '#5a5a5a'];

function Walker({ sceneWidth, index }: { sceneWidth: number; index: number }) {
  const x = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const leftToRight = index % 2 === 0;

  const config = useMemo(() => ({
    duration: 9000 + (index * 2381) % 8000,
    delay: (index * 1637) % 6000,
    lane: index % 3, // three sidewalk lanes for depth
  }), [index]);

  useEffect(() => {
    const walk = Animated.loop(
      Animated.sequence([
        Animated.delay(config.delay),
        Animated.timing(x, { toValue: 1, duration: config.duration, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    const bobbing = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    walk.start();
    bobbing.start();
    return () => { walk.stop(); bobbing.stop(); };
  }, [x, bob, config]);

  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: leftToRight ? [-16, sceneWidth + 16] : [sceneWidth + 16, -16],
  });
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] });
  const scale = 0.85 + config.lane * 0.12;
  const tone = TONES[index % TONES.length];

  return (
    <Animated.View
      style={[
        styles.walker,
        { bottom: 12 + config.lane * 7, transform: [{ translateX }, { translateY }, { scale }] },
      ]}
      pointerEvents="none"
    >
      <Svg width={12} height={20} viewBox="0 0 12 20">
        <Circle cx={6} cy={4} r={3.4} fill={tone} />
        <Rect x={2.6} y={7.4} width={6.8} height={11} rx={3} fill={tone} />
      </Svg>
    </Animated.View>
  );
}

export default function Walkers({ count, sceneWidth }: { count: number; sceneWidth: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <Walker key={i} index={i} sceneWidth={sceneWidth} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  walker: { position: 'absolute', left: 0 },
});
