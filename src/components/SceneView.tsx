import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Mood } from '../game/cast';
import { playSfx } from '../game/sound';
import { DecisionCard } from '../game/types';
import { Palette, useThemedStyles } from './theme';

/**
 * A conversation: the speaker's rendered portrait on the left, their words
 * in a proper speech bubble (tail pointing at them), tap to advance,
 * choices fade in, and their spoken reaction plays after a pick.
 * Narration boxes elsewhere keep the dark slate style — bubbles are for speech.
 */

interface Response { line: string; mood: Mood }

export interface ActorState { mood: Mood; talking: boolean }

interface Props {
  card: DecisionCard;
  sceneKey: string | number;
  /** the speaker's rendered portrait (require() asset id), if one exists */
  portrait: number | null;
  speakerName: string;
  speakerRole: string;
  onPick: (index: number) => Response | null;
  onDone: () => void;
  onActor: (a: ActorState) => void;
}

type Phase = 'talking' | 'choosing' | 'reacting';

const MOOD_EMOJI: Record<Mood, string> = { neutral: '', happy: ' 🙂', worried: ' 😟', stern: ' 😠' };

export default function SceneView({ card, sceneKey, portrait, speakerName, speakerRole, onPick, onDone, onActor }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [beat, setBeat] = useState(0);
  const [phase, setPhase] = useState<Phase>('talking');
  const [typing, setTyping] = useState(true);
  const [response, setResponse] = useState<Response | null>(null);
  const [choicesFade] = useState(() => new Animated.Value(0));
  const breathe = useRef(new Animated.Value(0)).current;

  const mood: Mood = phase === 'reacting' && response ? response.mood : card.mood;

  // reset per scene
  useEffect(() => {
    setBeat(0); setPhase('talking'); setResponse(null); setTyping(true);
    choicesFade.setValue(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  // the portrait breathes while talking
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the world-stage actor mirrors the dialogue state
  useEffect(() => {
    onActor({ mood, talking: typing && phase !== 'choosing' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, typing, phase]);

  useEffect(() => {
    if (phase === 'choosing') {
      Animated.timing(choicesFade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const currentLine =
    phase === 'reacting' && response ? response.line : card.lines[Math.min(beat, card.lines.length - 1)];

  const advance = () => {
    if (typing) { setTyping(false); return; }
    playSfx('tap');
    if (phase === 'talking') {
      if (beat + 1 < card.lines.length) {
        setBeat(beat + 1);
        setTyping(true);
      } else {
        setPhase('choosing');
      }
    } else if (phase === 'reacting') {
      onDone();
    }
  };

  const pick = (i: number) => {
    const resp = onPick(i);
    if (resp && resp.line) {
      setResponse(resp);
      setPhase('reacting');
      setTyping(true);
      choicesFade.setValue(0);
    } else {
      onDone();
    }
  };

  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] });

  return (
    <View>
      <View style={styles.row}>
        {/* the speaker, rendered */}
        {portrait != null && (
          <View style={styles.portraitCol}>
            <Animated.View style={[styles.portraitFrame, { transform: [{ scale }] }]}>
              <Image source={portrait} style={styles.portrait} resizeMode="cover" />
            </Animated.View>
            <Text style={styles.name} numberOfLines={1}>{speakerName}{MOOD_EMOJI[mood]}</Text>
            <Text style={styles.role} numberOfLines={1}>{speakerRole}</Text>
          </View>
        )}
        {/* the speech bubble */}
        <Pressable style={{ flex: 1 }} onPress={phase !== 'choosing' ? advance : undefined}>
          <View style={styles.bubbleWrap}>
            <View style={styles.tail} />
            <View style={styles.bubble}>
              <Typewriter
                key={`${sceneKey}-${phase}-${beat}`}
                text={currentLine}
                active={typing}
                onDone={() => setTyping(false)}
              />
              {phase !== 'choosing' && !typing && (
                <Text style={styles.tapHint}>tap ▸</Text>
              )}
            </View>
          </View>
        </Pressable>
      </View>

      {phase === 'choosing' && (
        <Animated.View style={{ opacity: choicesFade }}>
          {card.options.map((opt, i) => (
            <Pressable key={i} onPress={() => pick(i)} style={({ pressed }) => [styles.option, pressed && { opacity: 0.7, transform: [{ scale: 0.985 }] }]}>
              <Text style={styles.optionLabel}>{opt.label}</Text>
              {opt.hint ? <Text style={styles.optionHint}>{opt.hint}</Text> : null}
            </Pressable>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

/** Types text character by character; `active: false` reveals it all at once. */
function Typewriter({ text, active, onDone }: { text: string; active: boolean; onDone: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const [shown, setShown] = useState(active ? 0 : text.length);

  useEffect(() => {
    if (!active) { setShown(text.length); return; }
    setShown(0);
    let n = 0;
    const id = setInterval(() => {
      n += 2;
      if (n >= text.length) {
        clearInterval(id);
        setShown(text.length);
        onDone(); // called from the interval callback, never from a state updater
      } else {
        setShown(n);
      }
    }, 24);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, active]);

  return (
    <Text style={styles.dialogue}>
      {text.slice(0, shown)}
      {shown < text.length ? <Text style={{ opacity: 0.4 }}>▌</Text> : null}
    </Text>
  );
}

const BUBBLE_BG = '#f6efdd';

const makeStyles = (C: Palette) => StyleSheet.create({
  row: { flexDirection: 'row', gap: 0, marginTop: 10, paddingHorizontal: 6, alignItems: 'flex-start' },
  portraitCol: { width: '34%', maxWidth: 170 },
  portraitFrame: {
    width: '100%', aspectRatio: 864 / 1080,
    borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#3a4054',
    backgroundColor: '#22242e',
  },
  portrait: { width: '100%', height: '100%' },
  name: { color: C.text, fontSize: 14, fontWeight: '800', marginTop: 6, textAlign: 'center' },
  role: { color: C.dim, fontSize: 10.5, textAlign: 'center' },
  bubbleWrap: { flexDirection: 'row', alignItems: 'flex-start' },
  tail: {
    width: 0, height: 0, marginTop: 26,
    borderTopWidth: 10, borderBottomWidth: 10, borderRightWidth: 14,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: BUBBLE_BG,
  },
  bubble: {
    flex: 1, backgroundColor: BUBBLE_BG, borderRadius: 16, padding: 14, minHeight: 92,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  dialogue: { color: '#2c2c34', fontSize: 15, lineHeight: 22.5, fontWeight: '500' },
  tapHint: { color: '#8a7a5e', fontSize: 11, textAlign: 'right', marginTop: 8 },
  option: {
    backgroundColor: C.mode === 'light' ? '#fffffffa' : '#242940fa',
    borderRadius: 12, padding: 14, marginTop: 8, marginHorizontal: 6,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: C.shadowOpacity, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  optionLabel: { color: C.text, fontSize: 14.5, fontWeight: '700' },
  optionHint: { color: C.dim, fontSize: 12, marginTop: 3 },
});
