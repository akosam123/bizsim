import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Palette, useThemedStyles } from '../components/theme';
import { Profile, sendCode, setDisplayName, verifyCode } from '../game/account';

interface Props {
  onDone: (profile: Profile | null) => void;
  /** Playing signed-out is allowed; you just don't appear on the board. */
  onSkip: () => void;
  refresh: () => Promise<Profile | null>;
}

type Step = 'email' | 'code' | 'name';

/**
 * Sign-in is a single email round-trip: enter an address, type the six-digit
 * code it receives, pick a name. There is no password to forget and the code
 * exchange IS the verification, so a leaderboard entry always corresponds to a
 * real, reachable address.
 */
export default function AccountScreen({ onDone, onSkip, refresh }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const emailLooksReal = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const submitEmail = async () => {
    if (!emailLooksReal || busy) return;
    setBusy(true); setError('');
    const res = await sendCode(email);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? 'Could not send the code.'); return; }
    setStep('code');
  };

  const submitCode = async () => {
    if (code.trim().length < 6 || busy) return;
    setBusy(true); setError('');
    const res = await verifyCode(email, code);
    if (!res.ok) { setBusy(false); setError(res.error ?? 'That code did not work.'); return; }
    const profile = await refresh();
    setBusy(false);
    // a fresh account gets a placeholder name from the signup trigger, so send
    // new players to pick a real one and return anyone else straight to the game
    if (profile && /-[0-9a-f]{4}$/.test(profile.display_name)) {
      setName(profile.display_name.replace(/-[0-9a-f]{4}$/, ''));
      setStep('name');
    } else {
      onDone(profile);
    }
  };

  const submitName = async () => {
    if (name.trim().length < 2 || busy) return;
    setBusy(true); setError('');
    const res = await setDisplayName(name);
    if (!res.ok) { setBusy(false); setError(res.error ?? 'Could not save that name.'); return; }
    const profile = await refresh();
    setBusy(false);
    onDone(profile);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        {step === 'email' && (
          <>
            <Text style={styles.title}>Who's playing?</Text>
            <Text style={styles.body}>
              Your email keeps your progress and puts you on the world board. We send a
              six-digit code, nothing else.
            </Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#8b93ad"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onSubmitEditing={submitEmail}
            />
            <Pressable
              style={[styles.primary, (!emailLooksReal || busy) && styles.disabled]}
              onPress={submitEmail}
            >
              {busy ? <ActivityIndicator color="#12141d" /> : <Text style={styles.primaryText}>Send my code →</Text>}
            </Pressable>
          </>
        )}

        {step === 'code' && (
          <>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.body}>We sent a six-digit code to {email.trim()}.</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor="#8b93ad"
              keyboardType="number-pad"
              onSubmitEditing={submitCode}
            />
            <Pressable
              style={[styles.primary, (code.length < 6 || busy) && styles.disabled]}
              onPress={submitCode}
            >
              {busy ? <ActivityIndicator color="#12141d" /> : <Text style={styles.primaryText}>Verify →</Text>}
            </Pressable>
            <Text style={styles.link} onPress={() => { setStep('email'); setCode(''); setError(''); }}>
              Use a different address
            </Text>
          </>
        )}

        {step === 'name' && (
          <>
            <Text style={styles.title}>Pick your name</Text>
            <Text style={styles.body}>This is how you'll show up on the leaderboard.</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(t) => setName(t.slice(0, 24))}
              placeholder="Your name"
              placeholderTextColor="#8b93ad"
              autoCapitalize="words"
              onSubmitEditing={submitName}
            />
            <Pressable
              style={[styles.primary, (name.trim().length < 2 || busy) && styles.disabled]}
              onPress={submitName}
            >
              {busy ? <ActivityIndicator color="#12141d" /> : <Text style={styles.primaryText}>Start playing →</Text>}
            </Pressable>
          </>
        )}

        {error !== '' && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.skip} onPress={onSkip}>Play without an account</Text>
      </View>
    </View>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.bg },
  card: {
    width: '100%', maxWidth: 420, backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, padding: 24,
  },
  title: { color: C.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  body: { color: C.dim, fontSize: 14, lineHeight: 20, marginBottom: 18 },
  input: {
    backgroundColor: C.cardAlt, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    color: C.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14,
  },
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  primary: {
    backgroundColor: C.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  primaryText: { color: '#12141d', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  link: { color: C.dim, fontSize: 13, textAlign: 'center', marginTop: 14 },
  error: { color: C.danger, fontSize: 13, marginTop: 14, textAlign: 'center' },
  skip: { color: C.dim, fontSize: 13, textAlign: 'center', marginTop: 20 },
});
