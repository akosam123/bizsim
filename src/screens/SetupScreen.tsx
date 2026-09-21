import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import CutoutActor from '../components/CutoutActor';
import { Palette, ThemeMode, useTheme, useThemedStyles } from '../components/theme';
import { Button, Card, ChipRow, money } from '../components/ui';
import { IconGear, IconSoundOff, IconSoundOn } from '../components/icons';
import { HERO_ART, locationArt, ownerCut, sceneArt } from '../game/art';
import { AvatarSpec, OWNER_PRESETS } from '../game/cast';
import { BUSINESSES, LOCATIONS, STARTING_CASH, businessOf, locationOf } from '../game/config';
import { BusinessId, GameState, LocationId } from '../game/types';

interface Props {
  onStart: (business: BusinessId, location: LocationId, ownerName: string, avatar: AvatarSpec) => void;
  savedGame?: GameState | null;
  onContinue?: () => void;
  theme: ThemeMode;
  onSetTheme: (t: ThemeMode) => void;
  soundOn: boolean;
  onToggleSound: () => void;
  aiKey: string;
  onSetAiKey: (k: string) => void;
  /** null when playing signed-out, which is allowed */
  profile?: { display_name: string; email: string | null; current_streak: number; longest_streak: number } | null;
  /** takes the player to the sign-in screen */
  onSignIn?: () => void;
  /** absent when online play isn't configured, which hides the board entirely */
  onShowLeaderboard?: () => void;
}

/**
 * Setup as a short wizard played INSIDE the art: every step floats on a
 * full-bleed rendered scene (the hero shot, then your actual storefront once
 * you pick a business), with dots + Back/Next to move through it.
 */

type Step = 'title' | 'owner' | 'business' | 'location' | 'opening';
const STEPS: Step[] = ['title', 'owner', 'business', 'location', 'opening'];

export default function SetupScreen({
  onStart, savedGame, onContinue, theme, onSetTheme,
  soundOn, onToggleSound, aiKey, onSetAiKey, profile, onShowLeaderboard, onSignIn,
}: Props) {
  const C = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [step, setStep] = useState(0);
  const [business, setBusiness] = useState<BusinessId | null>(null);
  const [location, setLocation] = useState<LocationId | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [preset, setPreset] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const { width, height } = useWindowDimensions();
  // phones get a bottom sheet; desktop gets a floating card, centered with
  // breathing room so it never kisses the bottom edge of the window
  const isWide = width >= 900;

  const current = STEPS[step];
  const canNext =
    current === 'business' ? !!business :
    current === 'location' ? !!location : true;

  // The wizard's backdrop: hero art until a business is picked, then the
  // actual rendered storefront the player is about to own.
  const exterior = business ? sceneArt(business, 'street') : null;
  const backdrop = exterior ?? HERO_ART;

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const start = () => business && location &&
    onStart(business, location, ownerName.trim() || OWNER_PRESETS[preset].name, { skin: preset, hair: 0, hairColor: 0 });

  return (
    <View style={styles.screen}>
      <Image source={backdrop} style={styles.fill} resizeMode="cover" />
      <View style={styles.scrim} />

      {/* opening-day step: your owner standing in front of the shop */}
      {current === 'opening' && (
        <View style={[styles.openingActor, { paddingBottom: height * 0.34 }]} pointerEvents="none">
          <CutoutActor art={ownerCut(preset)} height={Math.min(height * 0.34, 300)} facing="right" />
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.sheetWrap, isWide && styles.sheetWrapWide]}
      >
        <View style={[styles.sheet, isWide && styles.sheetWide]}>
          {/* settings live here so they're reachable before a run starts */}
          <Pressable
            onPress={() => { setKeyDraft(aiKey); setShowSettings(true); }}
            style={styles.gearBtn}
            hitSlop={8}
          >
            <IconGear size={17} color={C.icon} />
          </Pressable>

          {/* progress dots */}
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]} />
            ))}
          </View>

          {/* Who this run belongs to, on EVERY step. It used to appear only on
              the title card, so from the owner step onward there was nothing
              tying the game to a person and it read as though no account
              existed at all. */}
          <View style={styles.acctBar}>
            {profile ? (
              <>
                <View style={styles.acctDot} />
                <Text style={styles.acctName}>{profile.display_name}</Text>
                {profile.email ? <Text style={styles.acctMail}>{profile.email}</Text> : null}
                <View style={{ flex: 1 }} />
                {profile.current_streak > 0 && (
                  <Text style={styles.acctStreak}>{profile.current_streak} day streak</Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.acctWarn}>Not signed in — this run won't be saved or ranked</Text>
                <View style={{ flex: 1 }} />
                {onSignIn && <Text style={styles.acctLink} onPress={onSignIn}>Sign in</Text>}
              </>
            )}
          </View>
          <ScrollView style={{ maxHeight: height * 0.52 }} contentContainerStyle={{ paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
            {current === 'title' && (
              <View>
                <Text style={styles.h1}>BizSim</Text>
                <Text style={styles.tagline}>{money(STARTING_CASH)}. 24 months. Build something.</Text>
                {savedGame && onContinue && (
                  <Pressable onPress={onContinue} style={styles.continueCard}>
                    <Text style={styles.continueTitle}>▶ Continue your run</Text>
                    <Text style={styles.continueBody}>
                      {businessOf(savedGame.business).emoji} {businessOf(savedGame.business).name} in {locationOf(savedGame.location).name} · month {savedGame.month + 1}/{savedGame.maxMonths} · {money(savedGame.cash)}
                    </Text>
                  </Pressable>
                )}
                {onShowLeaderboard && (
                  <Pressable onPress={onShowLeaderboard} style={styles.boardBtn}>
                    <Text style={styles.boardBtnText}>World leaderboard</Text>
                  </Pressable>
                )}
              </View>
            )}

            {current === 'owner' && (
              <View>
                <Text style={styles.stepTitle}>Who's the boss?</Text>
                <View style={styles.ownerGrid}>
                  {OWNER_PRESETS.map((p, i) => {
                    const active = preset === i;
                    return (
                      <Pressable key={i} onPress={() => setPreset(i)} style={[styles.ownerCard, active && styles.ownerCardActive]}>
                        <View style={styles.ownerGlow} />
                        <View style={styles.ownerFigure}>
                          <CutoutActor art={ownerCut(i)} height={118} facing="right" />
                        </View>
                        <Text style={[styles.ownerName, active && { color: C.accent }]}>{p.name}</Text>
                        {active && <View style={styles.ownerCheck}><Text style={styles.ownerCheckText}>✓</Text></View>}
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.nameInput}
                  placeholder={`Your name (or go by ${OWNER_PRESETS[preset].name})`}
                  placeholderTextColor={C.dim}
                  value={ownerName}
                  onChangeText={setOwnerName}
                  maxLength={20}
                />
              </View>
            )}

            {current === 'business' && (
              <View>
                <Text style={styles.stepTitle}>Pick your business</Text>
                {BUSINESSES.map((b) => {
                  const active = business === b.id;
                  return (
                    <Pressable key={b.id} onPress={() => setBusiness(b.id)}>
                      <View style={[styles.pickCard, active && { borderColor: b.accent, backgroundColor: C.cardAlt }]}>
                        {/* the actual storefront you'd be buying */}
                        <View style={[styles.thumbFrame, active && { borderColor: b.accent }]}>
                          {sceneArt(b.id, 'street') != null ? (
                            <Image source={sceneArt(b.id, 'street')!} style={styles.thumb} resizeMode="cover" />
                          ) : null}
                          <View style={[styles.thumbTint, { backgroundColor: b.accent }]} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{b.name}</Text>
                          <Text style={styles.cardBody}>{b.tagline}</Text>
                          <View style={styles.chipRow}>
                            <Text style={styles.chip}>${b.baseTicket} avg ticket</Text>
                            <Text style={styles.chip}>{Math.round(b.cogsRate * 100)}% goods</Text>
                            <Text style={styles.chip}>{money(b.wagePerStaff)}/staff</Text>
                          </View>
                        </View>
                        {active && <View style={[styles.pickTick, { backgroundColor: b.accent }]}><Text style={styles.pickTickText}>✓</Text></View>}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {current === 'location' && (
              <View>
                <Text style={styles.stepTitle}>Pick your location</Text>
                {LOCATIONS.map((l) => {
                  const active = location === l.id;
                  return (
                    <Pressable key={l.id} onPress={() => setLocation(l.id)}>
                      <View style={[styles.pickCard, active && { borderColor: C.accent, backgroundColor: C.cardAlt }]}>
                        <View style={[styles.thumbFrame, active && { borderColor: C.accent }]}>
                          {locationArt(l.id) != null ? (
                            <Image source={locationArt(l.id)!} style={styles.thumb} resizeMode="cover" />
                          ) : null}
                          <View style={styles.locLabelWrap}>
                            <Text style={styles.locLabel}>
                              {l.id === 'low' ? 'QUIET' : l.id === 'average' ? 'STEADY' : 'BUSY'}
                            </Text>
                          </View>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{l.name}</Text>
                          <Text style={styles.cardBody}>{l.blurb}</Text>
                          <View style={styles.chipRow}>
                            <Text style={styles.chip}>~{l.footTrafficPerDay} passersby/day</Text>
                            <Text style={styles.chip}>{money(l.rent)}/mo market rent</Text>
                          </View>
                        </View>
                        {active && <View style={[styles.pickTick, { backgroundColor: C.accent }]}><Text style={styles.pickTickText}>✓</Text></View>}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {current === 'opening' && business && location && (
              <View>
                <Text style={styles.stepTitle}>Opening day</Text>
                <Text style={styles.openingLine}>
                  {ownerName.trim() || OWNER_PRESETS[preset].name} · {businessOf(business).emoji} {businessOf(business).name} · {locationOf(location).name}
                </Text>
                <Text style={styles.openingSub}>
                  {money(STARTING_CASH)} in the bank. The keys are yours.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* nav */}
          <View style={styles.nav}>
            {step > 0 ? (
              <Button label="← Back" kind="ghost" onPress={back} style={{ flex: 1 }} />
            ) : <View style={{ flex: 1 }} />}
            {current === 'opening' ? (
              <Button label="Open for business →" onPress={start} disabled={!business || !location} style={{ flex: 2 }} />
            ) : (
              <Button
                label={current === 'title' ? 'New game →' : 'Next →'}
                onPress={next}
                disabled={!canNext}
                style={{ flex: 2 }}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
        <Pressable style={styles.modalWrap} onPress={() => setShowSettings(false)}>
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 400 }}>
            <Card style={{ padding: 20 }}>
              <Text style={styles.settingsTitle}>Settings</Text>

              <Text style={styles.settingsLabel}>Your profile</Text>
              <View style={styles.profileRow}>
                <View style={styles.profileFigure}>
                  <CutoutActor art={ownerCut(preset)} height={72} facing="right" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>{ownerName.trim() || OWNER_PRESETS[preset].name}</Text>
                  <Text style={styles.profileSub}>
                    {business ? businessOf(business).name : 'No business picked yet'}
                    {location ? ` · ${locationOf(location).name}` : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.settingsDivider} />
              <Text style={styles.settingsLabel}>Sound</Text>
              <Pressable onPress={onToggleSound} style={styles.soundRow}>
                {soundOn ? <IconSoundOn size={18} color={C.icon} /> : <IconSoundOff size={18} color={C.icon} />}
                <Text style={styles.soundText}>{soundOn ? 'Sound is on' : 'Sound is off'}</Text>
                <View style={[styles.toggle, soundOn && styles.toggleOn]}>
                  <View style={[styles.knob, soundOn && styles.knobOn]} />
                </View>
              </Pressable>

              <View style={styles.settingsDivider} />
              <Text style={styles.settingsLabel}>Appearance</Text>
              <ChipRow
                options={[
                  { id: 'dark' as ThemeMode, name: '🌙 Dark', hint: 'moody' },
                  { id: 'light' as ThemeMode, name: '☀️ Light', hint: 'daylight' },
                ]}
                value={theme}
                onChange={onSetTheme}
              />

              <View style={styles.settingsDivider} />
              <Text style={styles.settingsLabel}>AI scenario director</Text>
              <Text style={styles.settingsBody}>
                Add an Anthropic API key and one scene each month is written live by Claude.
                Stored only on this device.
              </Text>
              <TextInput
                style={styles.nameInput}
                placeholder="sk-ant-…"
                placeholderTextColor={C.dim}
                value={keyDraft}
                onChangeText={setKeyDraft}
                autoCapitalize="none"
                secureTextEntry
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <Button label="Save" onPress={() => { onSetAiKey(keyDraft.trim()); setShowSettings(false); }} style={{ flex: 1 }} />
                <Button kind="ghost" label="Close" onPress={() => setShowSettings(false)} style={{ flex: 1 }} />
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: C.mode === 'light' ? '#f4f0e8' : '#0c0e16',
    opacity: C.mode === 'light' ? 0.18 : 0.42,
  },
  openingActor: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'flex-end',
  },
  nav: { flexDirection: 'row', gap: 10, marginTop: 12 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheetWrapWide: { justifyContent: 'center', paddingVertical: 40 },
  sheet: {
    backgroundColor: C.mode === 'light' ? '#ffffffee' : '#12141df2',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderWidth: 1, borderColor: C.border, borderBottomWidth: 0,
    padding: 16, paddingBottom: 22,
    maxWidth: 560, width: '100%', alignSelf: 'center',
  },
  sheetWide: {
    borderRadius: 22, borderBottomWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 12 },
  },
  gearBtn: {
    position: 'absolute', top: 10, right: 12, zIndex: 5,
    backgroundColor: C.cardAlt, borderRadius: 999, padding: 8,
    borderWidth: 1, borderColor: C.border,
  },
  modalWrap: { flex: 1, backgroundColor: C.scrim, justifyContent: 'center', alignItems: 'center', padding: 24 },
  settingsTitle: { color: C.text, fontSize: 19, fontWeight: '800', marginBottom: 14 },
  settingsLabel: { color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  settingsBody: { color: C.dim, fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
  settingsDivider: { height: 1, backgroundColor: C.border, marginVertical: 15 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileFigure: {
    width: 58, height: 76, alignItems: 'center', justifyContent: 'flex-end',
    backgroundColor: C.cardAlt, borderRadius: 12, overflow: 'hidden',
  },
  profileName: { color: C.text, fontSize: 15, fontWeight: '800' },
  profileSub: { color: C.dim, fontSize: 12, marginTop: 2 },
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  soundText: { color: C.text, fontSize: 13.5, flex: 1 },
  toggle: {
    width: 42, height: 24, borderRadius: 12, backgroundColor: C.track,
    borderWidth: 1, borderColor: C.border, justifyContent: 'center', padding: 2,
  },
  toggleOn: { backgroundColor: C.accent, borderColor: C.accent },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.dim },
  knobOn: { backgroundColor: '#ffffff', alignSelf: 'flex-end' },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.border },
  dotActive: { backgroundColor: C.accent, width: 18 },
  dotDone: { backgroundColor: '#3c7a55' },
  h1: {
    color: C.text, fontSize: 38, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center',
  },
  tagline: { color: C.dim, fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 4, marginBottom: 8 },
  acctBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.border,
  },
  acctDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent },
  acctName: { color: C.text, fontSize: 12, fontWeight: '800' },
  acctMail: { color: C.dim, fontSize: 12 },
  acctStreak: { color: C.warn, fontSize: 12, fontWeight: '700' },
  acctWarn: { color: C.dim, fontSize: 12 },
  acctLink: { color: C.accent, fontSize: 12, fontWeight: '800' },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  streakName: { color: C.text, fontSize: 13, fontWeight: '700' },
  streakDot: { color: C.dim, fontSize: 13 },
  streakDays: { color: C.warn, fontSize: 13, fontWeight: '700' },
  boardBtn: {
    marginTop: 10, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.cardAlt, alignItems: 'center',
  },
  boardBtnText: { color: C.text, fontSize: 13, fontWeight: '700' },
  continueCard: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 2, borderColor: C.accent,
    padding: 14, marginTop: 10,
  },
  continueTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  continueBody: { color: C.dim, fontSize: 13, marginTop: 3 },
  stepTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  ownerGrid: { flexDirection: 'row', gap: 8 },
  ownerCard: {
    flex: 1, borderRadius: 14, overflow: 'hidden', paddingTop: 10, paddingBottom: 6,
    alignItems: 'center', backgroundColor: C.mode === 'light' ? '#edeaf8' : '#191430',
    borderWidth: 2, borderColor: 'transparent',
  },
  ownerCardActive: { borderColor: C.accent, backgroundColor: C.mode === 'light' ? '#e3def5' : '#1e1a3c' },
  ownerGlow: {
    position: 'absolute', top: 14, alignSelf: 'center',
    width: 74, height: 74, borderRadius: 999, backgroundColor: '#6d4fd1', opacity: 0.3,
  },
  ownerFigure: { height: 122, justifyContent: 'flex-end' },
  ownerName: { color: C.text, fontSize: 12.5, fontWeight: '700', marginTop: 4 },
  ownerCheck: {
    position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  ownerCheckText: { color: '#0e1a12', fontSize: 10, fontWeight: '800' },
  nameInput: {
    backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    color: C.text, fontSize: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 12,
  },
  pickCard: {
    flexDirection: 'row', gap: 13, alignItems: 'center',
    backgroundColor: C.mode === 'light' ? '#ffffffee' : '#1c2030ee',
    borderRadius: 14, padding: 11, marginBottom: 10,
    borderWidth: 2, borderColor: C.mode === 'light' ? C.border : 'transparent', overflow: 'hidden',
  },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  thumbFrame: {
    width: 104, aspectRatio: 4 / 3, borderRadius: 11, overflow: 'hidden',
    borderWidth: 2, borderColor: C.border, backgroundColor: C.cardAlt,
  },
  thumb: { width: '100%', height: '100%' },
  thumbTint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.14 },
  pickTick: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  pickTickText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  locLabelWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#12141dcc', paddingVertical: 3, alignItems: 'center',
  },
  locLabel: { color: '#ffffff', fontSize: 8.5, fontWeight: '800', letterSpacing: 1.2 },
  cardTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  cardBody: { color: C.dim, fontSize: 12.5, marginTop: 2 },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 7, flexWrap: 'wrap' },
  chip: {
    color: C.dim, fontSize: 10.5, fontWeight: '600',
    backgroundColor: C.cardAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    overflow: 'hidden',
  },
  openingLine: { color: C.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  openingSub: { color: C.dim, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 4 },
});
