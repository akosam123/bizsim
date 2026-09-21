import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import LineChart from '../components/LineChart';
import MenuPanel from '../components/MenuPanel';
import Portrait from '../components/Portrait';
import SceneView, { ActorState } from '../components/SceneView';
import Stage from '../components/Stage';
import { useTicker } from '../components/Ticker';
import CityWorld from '../components/CityWorld';
import { WorldNpc } from '../components/WorldStage';
import { Button, Card, ChipRow, Stat, money } from '../components/ui';
import { Palette, ThemeMode, useTheme, useThemedStyles } from '../components/theme';
import {
  IconBank, IconBolt, IconChart, IconGear, IconHeart, IconMegaphone, IconMenu,
  IconPulse, IconShop, IconSoundOff, IconSoundOn, IconSpark, IconStar, IconTeam, IconWrench,
} from '../components/icons';
import { generateAiCard } from '../game/ai';
import { castArt, castCut, ownerArt, ownerCut, ownerTop, sceneArt } from '../game/art';
import { recordDay } from '../game/account';
import { CAST, Mood, avatarLook, characterOf } from '../game/cast';
import { ACTIVE_MS_PER_MONTH } from '../game/clock';
import {
  ADS_AP, BUSINESSES, LOAN_AP, LOAN_CAP, LOAN_STEP, MANAGER_HIRE_COST,
  MARKETING_TIERS, MAX_PRODUCT_LINES, NEW_BUSINESS_COST, PRICE_LEVELS,
  SEGMENTS, STAFF_BONUS_PER_HEAD, TIER_CAPACITY_MULT, VENTURE_AP, VENTURE_COST,
  businessOf, priceLevelOf,
} from '../game/config';
import { STANCE_DESC } from '../game/competitors';
import { applyOption, drawCards, eventResponseLine } from '../game/decisions';
import { MonthOutcome, borrow, endMonth, launchProductLine, payStaffBonus, repay } from '../game/engine';
import {
  activitiesFor, canDoActivity, canOpenVenture, canTakeBreak, doActivity,
  hireOutsideManager, managerOf, openVenture, promoteToManager, takeBreak,
} from '../game/ops';
import { chairRent, emptyChairs, releaseChair, takeChair } from '../game/barber';
import { phaseDisplay } from '../game/macro';
import { monthName, monthOpen, monthRecap, yearOf } from '../game/narration';
import { playSfx } from '../game/sound';
import { GameState, Venue, WorldRoom } from '../game/types';

interface Props {
  state: GameState;
  setState: (s: GameState) => void;
  /** the online run this session is recording into; null when playing offline */
  runId?: string | null;
  onGameOver: (s: GameState) => void;
  soundOn: boolean;
  onToggleSound: () => void;
  aiKey: string;
  onSetAiKey: (key: string) => void;
  theme: ThemeMode;
  onSetTheme: (t: ThemeMode) => void;
  onRestart: () => void;
}

const TICK_MS = 15000;

export default function GameScreen({ state, setState, onGameOver, soundOn, onToggleSound, aiKey, onSetAiKey, theme, onSetTheme, onRestart, runId }: Props) {
  const C = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width, height } = useWindowDimensions();
  // web-game layout: on a wide screen the scene fills most of the viewport
  // (sized so scene + HUD fit the page), and reading surfaces (dialogue,
  // slates, recaps) OVERLAY the scene bottom instead of stacking below it
  const isWide = width >= 900;
  // the engine canvas is 16:9 (0.5625) and sits under ~310px of chrome
  // (HUD, vitals, hint, tabs) — size it so the whole game fits the viewport
  const contentWidth = isWide
    ? Math.min(width - 48, 1180, Math.round((height - 310) / 0.5625))
    : Math.min(width - 24, 460);
  const readerBox = isWide ? { maxWidth: 660, width: '100%' as const, alignSelf: 'center' as const } : null;
  const overlay = isWide ? styles.dialogueOverlay : null;
  const [outcome, setOutcome] = useState<MonthOutcome | null>(null);
  const [recapText, setRecapText] = useState('');
  const [showFinancials, setShowFinancials] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showAction, setShowAction] = useState<null | 'bank' | 'team' | 'ads' | 'expand'>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (line: string) => {
    setToast(line);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };
  const [showSettings, setShowSettings] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [confirmRestart, setConfirmRestart] = useState(false);
  const aiRequestedFor = useRef(-1);
  const [introDone, setIntroDone] = useState(false);
  const [room, setRoom] = useState<WorldRoom>('inside');
  const [activeCardIdx, setActiveCardIdx] = useState<number | null>(null);
  const [actorState, setActorState] = useState<ActorState>({ mood: 'neutral', talking: false });
  const stateRef = useRef(state);
  stateRef.current = state;

  const biz = businessOf(state.business);
  const last = state.history[state.history.length - 1];
  const tickerCash = useTicker(state.cash);
  const phase = phaseDisplay(state.macro.phase);
  const playerLook = avatarLook(state.avatar);

  const crowd = useMemo(() => {
    if (!last) return 0.25;
    const capacity = biz.baseCapacityPerDay * TIER_CAPACITY_MULT[state.storeTier - 1] * 30;
    return Math.min(1, last.customers / capacity);
  }, [last, state.storeTier, biz]);

  // open a new month: draw the scenes and set the stage
  useEffect(() => {
    if (!outcome && !state.gameOver && state.currentCards.length === 0) {
      const cards = drawCards(state);
      const intro = monthOpen(state);
      setIntroDone(false);
      setRoom('inside');
      setActiveCardIdx(null);
      setState({ ...state, currentCards: cards, completedCards: [], monthIntro: intro, monthStory: [intro] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.month, state.currentCards.length, outcome]);

  const closeMonth = (s: GameState) => {
    const result = endMonth(s);
    setRecapText(monthRecap(result.record, result.state));
    setOutcome(result);
    setActiveCardIdx(null);
    setState(result.state);
    playSfx(result.record.profit >= 0 ? 'cash' : 'bad');
    // Post the month's trading. A month IS the game's day: one real day away
    // advances the world by one month, so this is the natural grain to record.
    // Fire and forget -- a failed upload must never interrupt play.
    if (runId) {
      const rec = result.record;
      recordDay(runId, {
        gameDay: rec.month,
        gameMonth: rec.month,
        revenue: rec.revenue,
        costs: rec.revenue - rec.profit,
        profit: rec.profit,
        cash: rec.cash,
      }).catch(() => {});
    }
  };

  // the AI director writes one scene per month, grounded in the live books
  useEffect(() => {
    if (!aiKey || state.gameOver || outcome) return;
    if (state.currentCards.length === 0) return;
    if (aiRequestedFor.current === state.month) return;
    if (state.currentCards.some((c) => c.aiGenerated)) return;
    aiRequestedFor.current = state.month;
    const forMonth = state.month;
    generateAiCard(state, aiKey).then((card) => {
      if (!card) return;
      const s = stateRef.current;
      const slot = s.currentCards.length - 1;
      if (s.month !== forMonth || s.gameOver) return;
      if (s.completedCards.includes(slot)) return;           // already played that slot
      if (activeCardRef.current === slot) return;            // mid-conversation in it
      const cards = [...s.currentCards];
      cards[slot] = card;
      setState({ ...s, currentCards: cards });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiKey, state.month, state.currentCards.length, outcome]);

  const activeCardRef = useRef<number | null>(null);
  activeCardRef.current = activeCardIdx;

  // 20 active minutes also closes the month, even if people are still waiting
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      if (s.gameOver || outcome) return;
      const activeMs = s.activeMs + TICK_MS;
      if (activeMs >= ACTIVE_MS_PER_MONTH) {
        closeMonth({ ...s, activeMs });
      } else {
        setState({ ...s, activeMs });
      }
    }, TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  // ── the world: who is waiting where ──
  const pending = state.currentCards
    .map((card, idx) => ({ card, idx }))
    .filter(({ idx }) => !state.completedCards.includes(idx));
  const monthDone = state.currentCards.length > 0 && pending.length === 0;

  const roomOfCard = (v?: Venue): Venue => v ?? 'inside';
  const seenSpeakers = new Set<string>();
  const npcsHere: WorldNpc[] = pending
    .filter(({ card }) => roomOfCard(card.venue) === room)
    .filter(({ card }) => {
      // safety net: one body per character on screen at a time
      if (seenSpeakers.has(card.speaker)) return false;
      seenSpeakers.add(card.speaker);
      return true;
    })
    .slice(0, 3)
    .map(({ card, idx }) => {
      const who = characterOf(card.speaker);
      return {
        id: String(idx), look: who!.look, mood: card.mood,
        name: card.aiGenerated ? `${who!.name} ✨` : who!.name,
        art: castCut(card.speaker),
      };
    });
  if (monthDone && room === 'office' && !outcome) {
    npcsHere.push({ id: 'close', look: CAST.accountant.look, mood: 'neutral', name: CAST.accountant.name, art: castCut('accountant') });
  }
  const npcRoomsWithWork: Venue[] = monthDone
    ? ['office']
    : [...new Set(pending.map(({ card }) => roomOfCard(card.venue)))];

  const activeCard = activeCardIdx != null ? state.currentCards[activeCardIdx] : null;

  const onTalk = (id: string) => {
    if (id === 'close') {
      closeMonth(stateRef.current);
      return;
    }
    // the city's residents — flavor and services, not scenario cards
    if (id === 'city-grady') { setShowAction('bank'); return; }
    if (id === 'city-victor') {
      const rivals = stateRef.current.competitors;
      showToast(rivals.length
        ? `😏 Victor: "Still open? ${rivals[0].name} and I were just talking about your block."`
        : '😏 Victor: "Quiet month. Enjoy it — I\'m planning something."');
      return;
    }
    if (id === 'city-marcus') {
      showToast('Marcus: "Gym\'s packed this month. Your regulars ask about you, you know."');
      return;
    }
    setActiveCardIdx(Number(id));
  };

  const onPick = (i: number) => {
    if (!activeCard) return null;
    const opt = activeCard.options[i];
    playSfx(opt?.cost || opt?.action ? 'cash' : 'tap');
    const next = applyOption(state, activeCard, i);
    setState(next);
    if (activeCard.fromEvent) return eventResponseLine(activeCard.id, i);
    return opt?.result ? { line: opt.result, mood: (opt.resultMood ?? 'neutral') as Mood } : null;
  };

  const onSceneDone = () => {
    const s = stateRef.current;
    if (activeCardIdx != null) {
      setState({ ...s, completedCards: [...s.completedCards, activeCardIdx] });
    }
    setActiveCardIdx(null);
  };

  const continueFromRecap = () => {
    playSfx('tap');
    const s = outcome!.state;
    setOutcome(null);
    setRoom('inside');
    if (s.gameOver) onGameOver(s);
  };

  const monthProgress = Math.min(1, Math.max(
    state.currentCards.length ? state.completedCards.length / state.currentCards.length : 0,
    state.activeMs / ACTIVE_MS_PER_MONTH,
  ));

  const speaker = activeCard ? characterOf(activeCard.speaker) : null;
  const dialogueVenue: Venue = activeCard ? roomOfCard(activeCard.venue) : room === 'bank' ? 'street' : room;
  const stageActor = outcome
    ? {
      key: `recap-${outcome.record.month}`,
      look: CAST.accountant.look,
      mood: (outcome.record.profit >= 4000 ? 'happy' : outcome.record.profit >= 0 ? 'neutral' : outcome.record.cash < 0 ? 'stern' : 'worried') as Mood,
      name: CAST.accountant.name,
      role: `closing the books on ${monthName(outcome.record.month)}`,
      talking: false,
    }
    : activeCard && speaker
      ? {
        key: `${state.month}-${activeCardIdx}-${activeCard.id}`,
        look: speaker.look,
        mood: actorState.mood,
        name: speaker.name,
        role: speaker.role,
        talking: actorState.talking,
      }
      : null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { maxWidth: isWide ? contentWidth + 24 : 480 }]}>
        {/* ── compact HUD ── */}
        <View style={styles.hud}>
          <View style={styles.avatarChip}>
            <Image source={ownerArt(state.avatar.skin)} style={styles.avatarImg} resizeMode="cover" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hudMonth} numberOfLines={1}>{monthName(state.month + 1)} Y{yearOf(state.month + 1)}</Text>
            <Text style={styles.hudPhase} numberOfLines={1}>{phase.emoji} {phase.label} · {state.interestRate.toFixed(1)}%</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.hudCash, { color: state.cash < 0 ? C.danger : state.cash < 5000 ? C.warn : C.accent }]}>
              {money(tickerCash)}
            </Text>
            {state.loan > 0 && <Text style={styles.hudLoan}>debt {money(state.loan)}</Text>}
          </View>
          <View style={styles.apChip}>
            <IconBolt size={13} color={C.apText} />
            <Text style={styles.apText}>{state.ap}</Text>
          </View>
          <Pressable onPress={() => { playSfx('tap'); setShowFinancials(true); }} style={styles.hudBtn} hitSlop={6}>
            <IconChart size={18} color={C.icon} />
          </Pressable>
          <Pressable onPress={() => { playSfx('tap'); setShowMenu(true); }} style={styles.hudBtn} hitSlop={6}>
            <IconMenu size={18} color={C.icon} />
          </Pressable>
          <Pressable onPress={onToggleSound} style={styles.hudBtn} hitSlop={6}>
            {soundOn ? <IconSoundOn size={18} color={C.icon} /> : <IconSoundOff size={18} color={C.icon} />}
          </Pressable>
          <Pressable onPress={() => { playSfx('tap'); setKeyDraft(aiKey); setShowSettings(true); }} style={styles.hudBtn} hitSlop={6}>
            <IconGear size={18} color={C.icon} />
          </Pressable>
        </View>

        {/* month progress */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(monthProgress * 100)}%` }]} />
        </View>
        <View style={styles.vitalsRow}>
          <MiniStat icon={<IconStar size={14} color={C.warn} />} label="Rep" value={state.reputation} />
          <MiniStat icon={<IconSpark size={14} color={C.blue} />} label="Buzz" value={100 - state.fatigue} />
          <MiniStat icon={<IconTeam size={14} color={C.accent} />} label="Team" value={state.morale} />
          <MiniStat icon={<IconHeart size={14} color={C.danger} />} label="Regulars" value={Math.round(state.loyalty)} raw />
          <MiniStat icon={<IconPulse size={14} color={C.danger} />} label="You" value={state.energy} />
          <MiniStat icon={<IconWrench size={14} color={C.icon} />} label="Shop" value={state.condition} />
        </View>

        {/* ── the world ── */}
        {state.awayRecap ? (
          <View style={readerBox}>
            <NarratorSlate text={state.awayRecap} cta="Back to work" onPress={() => setState({ ...state, awayRecap: null })} />
          </View>
        ) : outcome ? (
          <View>
            <Stage
              business={state.business} location={state.location} storeTier={state.storeTier}
              crowd={crowd} reputation={state.reputation} width={contentWidth}
              venue="office"
              actor={stageActor ? { ...stageActor, art: castCut('accountant') } : null}
              playerArt={ownerCut(state.avatar.skin)}
              playerMood={outcome.record.profit >= 4000 ? 'happy' : outcome.record.profit < 0 ? 'worried' : 'neutral'}
            />
            <View style={overlay} pointerEvents="box-none">
            <View style={readerBox}>
            <View style={styles.recapRow}>
              <View style={styles.recapPortraitFrame}>
                <Image source={castArt('accountant')!} style={styles.recapPortrait} resizeMode="cover" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recapName}>{CAST.accountant.name}</Text>
                <Text style={styles.recapRole}>closing the books on {monthName(outcome.record.month)}</Text>
              </View>
            </View>
            <Card style={styles.recapCard}>
              <Text style={styles.prose}>{recapText}</Text>
              {outcome.eventHeadline && (
                <Text style={[styles.headline, { color: outcome.eventGood ? C.accent : C.danger }]}>
                  {outcome.eventHeadline}
                </Text>
              )}
              {outcome.headlines.map((h, i) => (
                <Text key={i} style={styles.headline}>{h}</Text>
              ))}
              <View style={styles.recapNumbers}>
                <Stat label="Revenue" value={money(outcome.record.revenue)} />
                <Stat label="Profit" value={money(outcome.record.profit)} tone={outcome.record.profit >= 0 ? 'good' : 'bad'} />
                <Stat label="Customers" value={outcome.record.customers.toLocaleString()} />
              </View>
              <Pressable onPress={() => setShowFinancials(true)} style={styles.finHintRow}>
                <IconChart size={14} color={C.blue} />
                <Text style={styles.finHint}>See the full books</Text>
              </Pressable>
              <Button
                label={outcome.state.gameOver ? 'See how it all ended' : `Begin ${monthName(outcome.record.month + 1)} ▶`}
                onPress={continueFromRecap}
                style={{ marginTop: 14 }}
              />
            </Card>
            </View>
            </View>
          </View>
        ) : !introDone && state.monthIntro ? (
          <View>
            <Stage
              business={state.business} location={state.location} storeTier={state.storeTier}
              crowd={crowd} reputation={state.reputation} width={contentWidth} venue="street"
            />
            <View style={overlay} pointerEvents="box-none">
              <View style={readerBox}>
                <NarratorSlate text={state.monthIntro} cta="tap ▸" onPress={() => { playSfx('tap'); setIntroDone(true); }} subtle overlap />
              </View>
            </View>
          </View>
        ) : activeCard ? (
          <View>
            <Stage
              business={state.business} location={state.location} storeTier={state.storeTier}
              crowd={crowd} reputation={state.reputation} width={contentWidth}
              venue={dialogueVenue}
              actor={stageActor ? { ...stageActor, art: speaker ? castCut(speaker.id) : null } : null}
              playerArt={ownerCut(state.avatar.skin)}
              playerMood={actorState.mood === 'stern' ? 'worried' : actorState.mood}
            />
            <View style={overlay} pointerEvents="box-none">
            <View style={readerBox}>
              <SceneView
                card={activeCard}
                sceneKey={`${state.month}-${activeCardIdx}-${activeCard.id}`}
                portrait={null}
                speakerName={activeCard.aiGenerated ? `${speaker?.name ?? ''} ✨` : speaker?.name ?? ''}
                speakerRole={speaker?.role ?? ''}
                onPick={onPick}
                onDone={onSceneDone}
                onActor={setActorState}
              />
            </View>
            </View>
          </View>
        ) : (
          <View>
            {monthDone ? (
              <Text style={styles.hintBanner}>
                Everyone's been heard. {CAST.accountant.name} is waiting in the office 🗂 to close the month.
              </Text>
            ) : pending.length > 0 ? (
              <Text style={styles.hintBanner}>
                {pending.length} {pending.length === 1 ? 'person needs' : 'people need'} you — follow the red dots, tap the floor to walk.
              </Text>
            ) : null}
            <CityWorld
              business={state.business}
              location={state.location}
              storeTier={state.storeTier}
              crowd={crowd}
              reputation={state.reputation}
              width={contentWidth}
              room={room}
              onChangeRoom={setRoom}
              playerLook={playerLook}
              playerArt={ownerCut(state.avatar.skin)}
              playerTopArt={ownerTop(state.avatar.skin)}
              playerPreset={state.avatar.skin}
              npcs={npcsHere}
              npcRoomsWithWork={npcRoomsWithWork}
              onTalk={onTalk}
              onBooks={() => setShowFinancials(true)}
              onMenu={() => setShowMenu(true)}
              onAction={(id) => {
                // tapping a district building: yours reports in, the rest are for sale
                if (id.startsWith('biz-')) {
                  const bizId = id.slice(4) as GameState['business'];
                  const v = state.ventures.find((x) => x.business === bizId);
                  if (v) {
                    const lastNet = last?.ventureProfit;
                    showToast(`${v.name} · ${v.managerName} is running it.${lastNet != null ? ` Locations netted ${money(lastNet)} last month.` : ''}`);
                  } else {
                    setShowAction('expand');
                  }
                  return;
                }
                setShowAction(id as 'bank' | 'team' | 'ads' | 'expand');
              }}
              activities={activitiesFor(room).map((a) => ({
                id: a.id,
                label: a.label(state.business),
                hint: a.hint,
                done: state.activitiesDone.includes(a.id),
                disabled: !canDoActivity(state, a.id).ok,
              }))}
              onActivity={(id) => {
                const r = doActivity(state, id);
                if (r.state !== state) { playSfx('good'); setState(r.state); }
                showToast(r.line);
              }}
            />
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* transient feedback for hands-on work */}
      {toast && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* ── settings: the AI scenario director ── */}
      <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
        <View style={styles.menuWrap}>
          <Card style={{ width: '100%', maxWidth: 400, padding: 20 }}>
            <Text style={styles.cardTitle}>✨ AI scenario director</Text>
            <Text style={styles.settingsBody}>
              Add an Anthropic API key and one scene each month gets written live by Claude — grounded in your actual books, and built to challenge how you tend to decide. The key is stored only on this device. Without a key, the handcrafted scenarios play as usual.
            </Text>
            <TextInput
              style={styles.keyInput}
              placeholder="sk-ant-…"
              placeholderTextColor={C.dim}
              value={keyDraft}
              onChangeText={setKeyDraft}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Button label="Save" onPress={() => { onSetAiKey(keyDraft.trim()); setShowSettings(false); }} style={{ flex: 1 }} />
              <Button kind="ghost" label="Close" onPress={() => setShowSettings(false)} style={{ flex: 1 }} />
            </View>
            {aiKey ? <Text style={styles.settingsHint}>Director is on — look for the ✨ next to a character each month.</Text> : null}
            <View style={styles.settingsDivider} />
            <Text style={styles.cardTitle}>Appearance</Text>
            <ChipRow
              options={[
                { id: 'dark' as ThemeMode, name: '🌙 Dark', hint: 'moody' },
                { id: 'light' as ThemeMode, name: '☀️ Light', hint: 'daylight' },
              ]}
              value={theme}
              onChange={(t) => { playSfx('tap'); onSetTheme(t); }}
            />
            <View style={styles.settingsDivider} />
            <Text style={styles.cardTitle}>Start over</Text>
            <Text style={styles.settingsBody}>
              Abandon this run and go back to the beginning — new owner, new business, new location. This can't be undone.
            </Text>
            <Pressable
              onPress={() => {
                playSfx('tap');
                if (!confirmRestart) { setConfirmRestart(true); setTimeout(() => setConfirmRestart(false), 3500); return; }
                setShowSettings(false);
                setConfirmRestart(false);
                onRestart();
              }}
              style={[styles.dangerBtn, confirmRestart && styles.dangerBtnArmed]}
            >
              <Text style={[styles.dangerBtnText, !confirmRestart && { color: C.danger }]}>
                {confirmRestart ? 'Tap again to abandon this run' : '↩ Start over'}
              </Text>
            </Pressable>
          </Card>
        </View>
      </Modal>

      {/* ── the menu, as customers see it — plus the owner's controls ── */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.menuWrap} onPress={() => setShowMenu(false)}>
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 400 }}>
            <ScrollView style={{ maxHeight: '100%' }} showsVerticalScrollIndicator={false}>
              <MenuPanel state={state} />
              <Card style={{ marginTop: 10, marginBottom: 0 }}>
                <Text style={styles.cardTitle}>Pricing</Text>
                <ChipRow
                  options={PRICE_LEVELS.map((p) => ({ id: p.id, name: p.name, hint: p.hint }))}
                  value={state.priceLevel}
                  onChange={(lvl) => { playSfx('tap'); setState({ ...state, priceLevel: lvl }); }}
                />
                <View style={styles.settingsDivider} />
                <Text style={styles.cardTitle}>New product line  ·  {state.productLines}/{MAX_PRODUCT_LINES}</Text>
                <Text style={styles.settingsBody}>
                  Fresh items on the board wake the regulars back up.
                </Text>
                <Button
                  label={state.productLines >= MAX_PRODUCT_LINES ? 'Menu is full' : `Launch for ${money(Math.round(biz.productLineCost * state.macro.cpi))}`}
                  disabled={state.productLines >= MAX_PRODUCT_LINES || state.cash < Math.round(biz.productLineCost * state.macro.cpi)}
                  onPress={() => { playSfx('cash'); setState(launchProductLine(state)); }}
                />
              </Card>
              <Text style={styles.menuClose} onPress={() => setShowMenu(false)}>tap anywhere to close</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── player-initiated actions: bank, team, ads, expansion ── */}
      <Modal visible={showAction != null} transparent animationType="fade" onRequestClose={() => setShowAction(null)}>
        <Pressable style={styles.menuWrap} onPress={() => setShowAction(null)}>
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 420, maxHeight: '90%' }}>
            <ScrollView showsVerticalScrollIndicator={false}>
            {showAction === 'bank' && (
              <Card style={{ padding: 20 }}>
                <View style={styles.actionTitleRow}>
                  <IconBank size={20} color={C.blue} />
                  <Text style={styles.actionTitle}>First Street Bank</Text>
                  <View style={{ flex: 1 }} />
                  <ApBadge ap={state.ap} />
                </View>
                <Text style={styles.settingsBody}>
                  Balance {money(state.loan)} of {money(LOAN_CAP)} · {state.interestRate.toFixed(1)}% APR, interest billed monthly.
                  Walking in off-schedule takes groundwork — {LOAN_AP} AP per loan.
                </Text>
                <Button
                  label={`Borrow ${money(LOAN_STEP)}  ·  ${LOAN_AP} AP`}
                  disabled={state.loan + LOAN_STEP > LOAN_CAP || state.ap < LOAN_AP}
                  onPress={() => { playSfx('cash'); setState({ ...borrow(state), ap: state.ap - LOAN_AP }); }}
                />
                <Button
                  kind="ghost"
                  label={`Repay ${money(Math.min(LOAN_STEP, state.loan))}`}
                  disabled={state.loan <= 0 || state.cash < Math.min(LOAN_STEP, state.loan)}
                  onPress={() => { playSfx('cash'); setState(repay(state)); }}
                  style={{ marginTop: 8 }}
                />
              </Card>
            )}
            {showAction === 'team' && state.business === 'barber' && (
              <Card style={{ padding: 20 }}>
                <View style={styles.actionTitleRow}>
                  <IconTeam size={20} />
                  <Text style={styles.actionTitle}>The chairs</Text>
                </View>
                <Text style={styles.settingsBody}>
                  Barbers rent a chair and keep what they cut — your income is the rent.
                  {' '}{money(chairRent(state))}/chair right now · {state.barbers.length}/{state.chairs} rented.
                </Text>

                {state.barbers.map((b) => (
                  <View key={b.id} style={styles.staffRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.staffName}>{b.name}</Text>
                      <Text style={styles.staffMeta}>
                        {'★'.repeat(b.skill)}{'☆'.repeat(5 - b.skill)} · {b.monthsHeld} mo · {b.clientele} own regulars
                        {b.rentOwed > 0 ? ` · owes ${money(b.rentOwed)}` : ''}
                      </Text>
                      <View style={styles.staffBarTrack}>
                        <View style={[styles.staffBarFill, {
                          width: `${Math.min(100, b.reliability)}%`,
                          backgroundColor: b.reliability >= 60 ? C.accent : b.reliability >= 35 ? C.warn : C.danger,
                        }]} />
                      </View>
                    </View>
                    <Button small kind="ghost" label="End" onPress={() => { playSfx('tap'); setState(releaseChair(state, b.id)); }} />
                  </View>
                ))}
                {state.barbers.length === 0 && (
                  <Text style={styles.settingsBody}>Every chair is empty. Nobody's paying you rent.</Text>
                )}

                {state.chairApplicants.length > 0 && (
                  <>
                    <View style={styles.settingsDivider} />
                    <Text style={styles.cardTitle}>Asking for a chair</Text>
                    {state.chairApplicants.map((a) => (
                      <View key={a.id} style={styles.staffRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.staffName}>{a.name}</Text>
                          <Text style={styles.staffMeta}>
                            {'★'.repeat(a.skill)}{'☆'.repeat(5 - a.skill)} · brings {a.clientele} regulars
                          </Text>
                          <Text style={styles.staffMeta}>"{a.pitch}"</Text>
                        </View>
                        <Button
                          small
                          label={emptyChairs(state) > 0 ? 'Rent' : 'Full'}
                          disabled={emptyChairs(state) <= 0}
                          onPress={() => {
                            playSfx('cash');
                            setState({ ...takeChair(state, a), chairApplicants: state.chairApplicants.filter((x) => x.id !== a.id) });
                          }}
                        />
                      </View>
                    ))}
                  </>
                )}

                <View style={styles.settingsDivider} />
                <Pressable
                  onPress={() => { playSfx('tap'); setState({ ...state, ownerChair: !state.ownerChair }); }}
                  style={styles.adTier}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adTierName}>Work a chair yourself</Text>
                    <Text style={styles.adTierDesc}>
                      {state.ownerChair ? 'You take walk-ins too — costs energy each month' : 'Leave the cutting to the renters'}
                    </Text>
                  </View>
                  <View style={[styles.toggleSm, state.ownerChair && styles.toggleSmOn]} />
                </Pressable>
              </Card>
            )}
            {showAction === 'team' && state.business !== 'barber' && (
              <Card style={{ padding: 20 }}>
                <View style={styles.actionTitleRow}>
                  <IconTeam size={20} />
                  <Text style={styles.actionTitle}>Your team</Text>
                </View>
                {state.roster.map((m) => (
                  <View key={m.id} style={styles.staffRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.staffName}>
                        {m.name}
                        {m.role === 'manager' && <Text style={styles.mgrBadge}>  MANAGER</Text>}
                      </Text>
                      <Text style={styles.staffMeta}>
                        {'★'.repeat(m.skill)}{'☆'.repeat(5 - m.skill)} · {m.monthsEmployed} mo · {m.hustle >= 70 ? 'hard worker' : m.hustle >= 45 ? 'steady' : 'coasting'}
                      </Text>
                      <View style={styles.staffBarTrack}>
                        <View style={[styles.staffBarFill, {
                          width: `${m.morale}%`,
                          backgroundColor: m.morale >= 60 ? C.accent : m.morale >= 35 ? C.warn : C.danger,
                        }]} />
                      </View>
                    </View>
                    {m.role !== 'manager' && !managerOf(state) && (
                      <Button small kind="ghost" label="Promote" onPress={() => { playSfx('good'); setState(promoteToManager(state, m.id)); }} />
                    )}
                  </View>
                ))}
                {!managerOf(state) && (
                  <Button
                    kind="ghost"
                    label={`Hire an outside manager  ·  ${money(Math.round(MANAGER_HIRE_COST * state.macro.cpi))}`}
                    disabled={state.cash < Math.round(MANAGER_HIRE_COST * state.macro.cpi)}
                    onPress={() => { playSfx('cash'); setState(hireOutsideManager(state)); }}
                    style={{ marginTop: 10 }}
                  />
                )}
                <View style={styles.settingsDivider} />
                <Text style={styles.settingsBody}>
                  Morale {Math.round(state.morale)}/100 · a round of bonuses lifts it by 14.
                </Text>
                <Button
                  label={`Pay ${money(Math.round(state.staff * STAFF_BONUS_PER_HEAD * state.macro.cpi))} in bonuses`}
                  disabled={state.morale >= 95 || state.cash < Math.round(state.staff * STAFF_BONUS_PER_HEAD * state.macro.cpi)}
                  onPress={() => { playSfx('cash'); setState(payStaffBonus(state)); }}
                />
                <View style={styles.settingsDivider} />
                <Text style={styles.settingsBody}>
                  Your tank: {Math.round(state.energy)}/100. {canTakeBreak(state).ok
                    ? `${managerOf(state)!.name} can hold the fort while you recharge.`
                    : canTakeBreak(state).why + '.'}
                </Text>
                <Button
                  kind="ghost"
                  label="🌴 Take a real week off"
                  disabled={!canTakeBreak(state).ok}
                  onPress={() => { playSfx('good'); setState(takeBreak(state)); setShowAction(null); showToast('You actually rested. Full tank.'); }}
                />
              </Card>
            )}
            {showAction === 'ads' && (
              <Card style={{ padding: 20 }}>
                <View style={styles.actionTitleRow}>
                  <IconMegaphone size={20} color={C.warn} />
                  <Text style={styles.actionTitle}>Run ads</Text>
                  <View style={{ flex: 1 }} />
                  <ApBadge ap={state.ap} />
                </View>
                <Text style={styles.settingsBody}>
                  Billed monthly while it runs — switch off any time. Launching off-schedule takes {ADS_AP} AP.
                </Text>
                {MARKETING_TIERS.map((t) => {
                  const active = state.marketingTier === t.id;
                  const needsAp = t.cost > 0 && !active;
                  const blocked = needsAp && state.ap < ADS_AP;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        if (active || blocked) return;
                        playSfx(t.cost > 0 ? 'cash' : 'tap');
                        setState({ ...state, marketingTier: t.id, ap: state.ap - (needsAp ? ADS_AP : 0) });
                      }}
                      style={[styles.adTier, active && styles.adTierActive, blocked && { opacity: 0.45 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.adTierName}>{t.name}{active ? '  ·  running' : ''}</Text>
                        <Text style={styles.adTierDesc}>{t.desc}{needsAp ? `  ·  ${ADS_AP} AP` : ''}</Text>
                      </View>
                      <Text style={[styles.adTierCost, active && { color: C.accent }]}>
                        {t.cost > 0 ? `${money(Math.round(t.cost * state.macro.cpi))}/mo` : 'free'}
                      </Text>
                    </Pressable>
                  );
                })}
              </Card>
            )}
            {showAction === 'expand' && (
              <Card style={{ padding: 20 }}>
                <View style={styles.actionTitleRow}>
                  <IconShop size={20} color={C.accent} />
                  <Text style={styles.actionTitle}>The space for lease</Text>
                  <View style={{ flex: 1 }} />
                  <ApBadge ap={state.ap} />
                </View>
                <Text style={styles.settingsBody}>
                  A second place needs three things: {VENTURE_AP} AP of groundwork, the cash, and a manager —
                  who moves over to run it. {managerOf(state) ? `${managerOf(state)!.name} is ready.` : 'You don\'t have one yet.'}
                </Text>
                {([state.business, ...BUSINESSES.filter((b) => b.id !== state.business).map((b) => b.id)] as const).map((bid, i) => {
                  const b = businessOf(bid);
                  const check = canOpenVenture(state, bid);
                  return (
                    <Pressable
                      key={bid}
                      onPress={() => {
                        if (!check.ok) { showToast(`${check.why}.`); return; }
                        playSfx('cash');
                        setState(openVenture(state, bid));
                        setShowAction(null);
                        showToast('The keys are signed. Your manager is already over there.');
                      }}
                      style={[styles.adTier, !check.ok && { opacity: 0.5 }]}
                    >
                      <View style={styles.ventureThumbFrame}>
                        {sceneArt(bid, 'street') != null
                          ? <Image source={sceneArt(bid, 'street')!} style={styles.ventureThumb} resizeMode="cover" />
                          : <View style={[styles.ventureThumb, { backgroundColor: b.accent }]} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.adTierName}>{i === 0 ? `Second ${b.name.toLowerCase()}` : `New venture: ${b.name.toLowerCase()}`}</Text>
                        <Text style={styles.adTierDesc}>{check.ok ? `${VENTURE_AP} AP · runs itself once open` : check.why}</Text>
                      </View>
                      <Text style={styles.adTierCost}>{money(check.cost)}</Text>
                    </Pressable>
                  );
                })}
                {state.ventures.length > 0 && (
                  <>
                    <View style={styles.settingsDivider} />
                    {state.ventures.map((v) => (
                      <View key={v.id} style={styles.ventureRow}>
                        <View style={styles.ventureThumbFrameSm}>
                          {sceneArt(v.business, 'street') != null
                            ? <Image source={sceneArt(v.business, 'street')!} style={styles.ventureThumb} resizeMode="cover" />
                            : <View style={[styles.ventureThumb, { backgroundColor: businessOf(v.business).accent }]} />}
                        </View>
                        <Text style={styles.settingsBody}>
                          {v.name} · run by {v.managerName} ({'★'.repeat(v.managerSkill)})
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </Card>
            )}
            <Text style={styles.menuClose} onPress={() => setShowAction(null)}>tap anywhere to close</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── financials ── */}
      <Modal visible={showFinancials} transparent animationType="slide" onRequestClose={() => setShowFinancials(false)}>
        <View style={styles.sheetWrap}>
          <View style={[styles.sheet, { maxHeight: '88%' }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>The Books</Text>
              <Pressable onPress={() => setShowFinancials(false)} hitSlop={10}>
                <Text style={{ color: C.dim, fontSize: 22 }}>✕</Text>
              </Pressable>
            </View>
            <ScrollView>
              <LineChart
                title="Money"
                money
                width={contentWidth - 40}
                series={[
                  { label: 'Revenue', color: C.blue, values: state.history.map((h) => h.revenue) },
                  { label: 'Profit', color: C.accent, values: state.history.map((h) => h.profit) },
                ]}
              />
              <LineChart
                title="Customers"
                width={contentWidth - 40}
                series={[
                  { label: 'Served', color: C.warn, values: state.history.map((h) => h.customers) },
                  { label: 'Regulars', color: C.accent, values: state.history.map((h) => h.loyalCustomers) },
                ]}
              />
              {last && (
                <Card>
                  <Text style={styles.cardTitle}>Last month's P&L — {monthName(last.month)}</Text>
                  <PLRow k="Revenue" v={money(last.revenue)} />
                  <PLRow k="Cost of goods" v={`−${money(last.cogs)}`} />
                  <PLRow k="Rent" v={`−${money(last.rent)}`} />
                  <PLRow k="Wages" v={`−${money(last.wages)}`} />
                  <PLRow k="Utilities & overhead" v={`−${money(last.overhead)}`} />
                  {last.marketingCost > 0 && <PLRow k="Marketing" v={`−${money(last.marketingCost)}`} />}
                  {(last.ventureProfit ?? 0) !== 0 && (
                    <PLRow k="Other locations" v={money(last.ventureProfit!)} good={last.ventureProfit! > 0} bad={last.ventureProfit! < 0} />
                  )}
                  {last.interestPaid > 0 && <PLRow k="Loan interest" v={`−${money(last.interestPaid)}`} />}
                  {last.taxes > 0 && <PLRow k="Taxes" v={`−${money(last.taxes)}`} />}
                  <View style={styles.divider} />
                  <PLRow k="Profit" v={money(last.profit)} strong good={last.profit >= 0} bad={last.profit < 0} />
                </Card>
              )}
              <Card>
                <Text style={styles.cardTitle}>Your position</Text>
                <View style={styles.recapNumbers}>
                  <Stat label="Cash" value={money(state.cash)} tone={state.cash < 5000 ? 'warn' : 'good'} />
                  <Stat label="Debt" value={money(state.loan)} tone={state.loan > 0 ? 'warn' : undefined} />
                  <Stat label="Store tier" value={`${state.storeTier}/3`} />
                </View>
                <View style={[styles.recapNumbers, { marginTop: 10 }]}>
                  <Stat label="Pricing" value={priceLevelOf(state.priceLevel).name} />
                  <Stat label="Marketing" value={state.marketingTier === 'none' ? 'Off' : state.marketingTier === 'local' ? 'Local' : 'Campaign'} />
                  <Stat label="Staff" value={`${state.staff}`} />
                </View>
                {last && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.subhead}>Market share: {Math.round(last.marketShare * 100)}%</Text>
                    {SEGMENTS.map((seg) => {
                      const snap = last.segments.find((x) => x.id === seg.id);
                      const total = last.segments.reduce((a, x) => a + x.customers, 0) || 1;
                      return (
                        <View key={seg.id} style={styles.segRow}>
                          <Text style={styles.segLabel}>{seg.name}</Text>
                          <View style={styles.segBarTrack}>
                            <View style={[styles.segBarFill, { width: `${Math.round(((snap?.customers ?? 0) / total) * 100)}%` }]} />
                          </View>
                          <Text style={styles.segValue}>{(snap?.customers ?? 0).toLocaleString()}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
                {state.competitors.map((c) => (
                  <Text key={c.id} style={[styles.headline, { color: C.danger }]}>
                    🏢 {c.name} — {STANCE_DESC[c.stance]} ({c.monthsActive}mo)
                  </Text>
                ))}
                {state.effects.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    {state.effects.map((e) => (
                      <Text key={e.id} style={[styles.headline, { color: e.good ? C.accent : C.danger }]}>
                        {e.good ? '▲' : '▼'} {e.label} ({e.monthsLeft}mo)
                      </Text>
                    ))}
                  </View>
                )}
              </Card>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Italic narrator interludes — month openings, away recaps. */
function NarratorSlate({ text, cta, onPress, subtle, overlap }: { text: string; cta: string; onPress: () => void; subtle?: boolean; overlap?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <Pressable onPress={subtle ? onPress : undefined}>
      <Animated.View style={[styles.slate, { opacity: fade }, overlap && { marginTop: -26, marginHorizontal: 6 }]}>
        <Text style={styles.slateText}>{text}</Text>
        {subtle ? (
          <Text style={styles.tapHintText}>tap to continue ▸</Text>
        ) : (
          <Button label={cta} onPress={onPress} style={{ marginTop: 14 }} />
        )}
      </Animated.View>
    </Pressable>
  );
}

function MiniStat({ icon, label, value, raw }: { icon: React.ReactNode; label: string; value: number; raw?: boolean }) {
  const C = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tone = raw ? C.blue : value >= 65 ? C.accent : value < 40 ? C.danger : C.warn;
  const pct = raw ? Math.min(100, value / 3) : Math.max(0, Math.min(100, value));
  return (
    <View style={[styles.miniStat, { borderColor: `${tone}55` }]}>
      <View style={styles.miniTop}>
        {icon}
        <Text style={[styles.miniValue, { color: tone }]}>{raw ? value : `${Math.round(value)}`}</Text>
      </View>
      <View style={styles.miniBarTrack}>
        <View style={[styles.miniBarFill, { width: `${pct}%`, backgroundColor: tone }]} />
      </View>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function ApBadge({ ap }: { ap: number }) {
  const C = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.apChip}>
      <IconBolt size={12} color={C.apText} />
      <Text style={styles.apText}>{ap} AP</Text>
    </View>
  );
}

function PLRow({ k, v, strong, bad, good }: { k: string; v: string; strong?: boolean; bad?: boolean; good?: boolean }) {
  const C = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.plRow}>
      <Text style={[styles.plKey, strong && { fontWeight: '700', color: C.text }]}>{k}</Text>
      <Text style={[styles.plVal, strong && { fontWeight: '700' }, bad && { color: C.danger }, good && { color: C.accent }]}>{v}</Text>
    </View>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 12, width: '100%', alignSelf: 'center' },
  dialogueOverlay: { position: 'absolute', left: 0, right: 0, bottom: 6 },
  hud: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.hudBg, borderRadius: 16, borderWidth: 1, borderColor: C.hudBorder,
    paddingVertical: 8, paddingHorizontal: 10, marginTop: 8,
    shadowColor: '#000', shadowOpacity: C.shadowOpacity, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  avatarChip: { width: 40, aspectRatio: 864 / 1080, backgroundColor: C.card, borderRadius: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: C.accent },
  avatarImg: { width: '100%', height: '100%' },
  hudMonth: { color: C.text, fontSize: 14, fontWeight: '800' },
  hudPhase: { color: C.dim, fontSize: 11, marginTop: 1 },
  hudCash: { fontSize: 17, fontWeight: '800' },
  hudLoan: { color: C.warn, fontSize: 10 },
  hudBtn: { backgroundColor: C.btnBg, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: C.btnBorder },
  progressTrack: { height: 6, backgroundColor: C.track, borderRadius: 3, overflow: 'hidden', marginTop: 8, borderWidth: 1, borderColor: C.hudBorder },
  progressFill: { height: 6, backgroundColor: C.accent, borderRadius: 3 },
  vitalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 4 },
  miniStat: {
    flexGrow: 1, flexBasis: 130, backgroundColor: C.panelBg, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 8,
    borderWidth: 1.5,
  },
  apChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.apBg, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1, borderColor: C.apBorder,
  },
  apText: { color: C.apText, fontSize: 13, fontWeight: '800' },
  staffRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.cardAlt,
  },
  staffName: { color: C.text, fontSize: 14, fontWeight: '700' },
  mgrBadge: { color: C.accent, fontSize: 9.5, fontWeight: '800', letterSpacing: 1 },
  staffMeta: { color: C.dim, fontSize: 11, marginTop: 2 },
  staffBarTrack: { height: 3.5, backgroundColor: C.track, borderRadius: 2, overflow: 'hidden', marginTop: 5 },
  staffBarFill: { height: 3.5, borderRadius: 2 },
  toast: {
    position: 'absolute', bottom: 24, left: 16, right: 16, alignItems: 'center',
  },
  toastText: {
    color: C.slateText, fontSize: 13, fontWeight: '600', textAlign: 'center',
    backgroundColor: C.slateBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden', maxWidth: 480,
  },
  miniTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  miniValue: { fontSize: 15, fontWeight: '900' },
  miniBarTrack: { height: 4, backgroundColor: C.track, borderRadius: 2, overflow: 'hidden', marginTop: 5 },
  miniBarFill: { height: 4, borderRadius: 2 },
  miniLabel: { color: C.dim, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 },
  hintBanner: { color: C.dim, fontSize: 12, lineHeight: 17, marginTop: 8, paddingHorizontal: 6 },
  slate: {
    backgroundColor: C.slateBg, borderRadius: 16, padding: 18, paddingLeft: 22,
    borderWidth: 1, borderColor: C.hudBorder, marginTop: 10, marginHorizontal: 6,
    borderLeftWidth: 4, borderLeftColor: C.warn,
    shadowColor: '#000', shadowOpacity: C.shadowOpacity, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
  },
  slateText: { color: C.slateText, fontSize: 15, lineHeight: 24, fontStyle: 'italic' },
  tapHintText: {
    color: C.warn, fontSize: 10.5, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase',
    textAlign: 'center', marginTop: 14, opacity: 0.9,
  },
  recapCard: { padding: 16, marginTop: 8, marginHorizontal: 6 },
  recapRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 10, paddingHorizontal: 6 },
  recapPortraitFrame: { width: 72, aspectRatio: 864 / 1080, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: C.border },
  recapPortrait: { width: '100%', height: '100%' },
  recapName: { color: C.text, fontSize: 16, fontWeight: '800' },
  recapRole: { color: C.dim, fontSize: 12, marginTop: 2 },
  prose: { color: C.text, fontSize: 14, lineHeight: 21 },
  headline: { color: C.dim, fontSize: 12.5, marginTop: 8, lineHeight: 18 },
  recapNumbers: { flexDirection: 'row', gap: 8, marginTop: 14 },
  finHint: { color: C.blue, fontSize: 13, fontWeight: '600' },
  finHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  actionTitle: { color: C.text, fontSize: 17, fontWeight: '800' },
  adTier: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.cardAlt, borderRadius: 10, padding: 12, marginTop: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  adTierActive: { borderColor: C.accent },
  // the venture rows show the place you would be opening, not an emoji
  ventureThumbFrame: {
    width: 62, height: 44, borderRadius: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  ventureThumbFrameSm: {
    width: 40, height: 28, borderRadius: 6, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
  },
  ventureThumb: { width: '100%', height: '100%' },
  ventureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  adTierName: { color: C.text, fontSize: 14, fontWeight: '700' },
  adTierDesc: { color: C.dim, fontSize: 12, marginTop: 2 },
  adTierCost: { color: C.dim, fontSize: 12.5, fontWeight: '700' },
  toggleSm: { width: 40, height: 22, borderRadius: 11, backgroundColor: C.track, borderWidth: 1, borderColor: C.border },
  toggleSmOn: { backgroundColor: C.accent, borderColor: C.accent },
  cardTitle: { color: C.text, fontSize: 15, fontWeight: '800', marginBottom: 8 },
  menuWrap: { flex: 1, backgroundColor: C.scrim, justifyContent: 'center', alignItems: 'center', padding: 24 },
  settingsBody: { color: C.dim, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  settingsHint: { color: C.accent, fontSize: 12, marginTop: 10 },
  settingsDivider: { height: 1, backgroundColor: C.border, marginVertical: 16 },
  dangerBtn: {
    borderRadius: 10, borderWidth: 1.5, borderColor: C.danger, paddingVertical: 11,
    alignItems: 'center',
  },
  dangerBtnArmed: { backgroundColor: C.danger },
  dangerBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  keyInput: {
    backgroundColor: C.cardAlt, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    color: C.text, fontSize: 14, paddingHorizontal: 12, paddingVertical: 10,
  },
  menuClose: { color: '#ffffffaa', fontSize: 12, textAlign: 'center', marginTop: 14 },
  sheetWrap: { flex: 1, backgroundColor: C.scrim, justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 8 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { color: C.text, fontSize: 19, fontWeight: '800' },
  subhead: { color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  segRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  segLabel: { color: C.dim, fontSize: 11, width: 76 },
  segBarTrack: { flex: 1, height: 7, backgroundColor: C.cardAlt, borderRadius: 4, overflow: 'hidden' },
  segBarFill: { height: 7, backgroundColor: C.blue, borderRadius: 4 },
  segValue: { color: C.text, fontSize: 11, fontWeight: '600', width: 52, textAlign: 'right' },
  plRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3.5 },
  plKey: { color: C.dim, fontSize: 13 },
  plVal: { color: C.text, fontSize: 13, fontWeight: '600' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 8 },
});
