import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native';
import { DARK, LIGHT, ThemeMode, ThemeProvider } from './src/components/theme';
import { catchUpOfflineTime } from './src/game/clock';
import { newGame } from './src/game/engine';
import { clearSave, loadGame, loadPrefs, saveGame, savePrefs } from './src/game/persistence';
import { setSoundEnabled } from './src/game/sound';
import { AvatarSpec } from './src/game/cast';
import { BusinessId, GameState, LocationId } from './src/game/types';
import { Profile, currentProfile, isConfigured, startRun, touchStreak, updateRun } from './src/game/account';
import AccountScreen from './src/screens/AccountScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import EndScreen from './src/screens/EndScreen';
import GameScreen from './src/screens/GameScreen';
import SetupScreen from './src/screens/SetupScreen';

type Screen = 'account' | 'setup' | 'game' | 'end';

export default function App() {
  // Signing in comes first when online play is configured, so a run always has
  // somewhere to record itself. Playing signed-out stays possible; you just
  // don't appear on the board.
  const [screen, setScreen] = useState<Screen>(isConfigured() ? 'account' : 'setup');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showBoard, setShowBoard] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [savedGame, setSavedGame] = useState<GameState | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [aiKey, setAiKey] = useState('');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const palette = theme === 'light' ? LIGHT : DARK;

  // load save + prefs once on launch; the world kept turning while you were gone
  useEffect(() => {
    loadGame().then((saved) => {
      if (!saved) return;
      const { state: caught } = catchUpOfflineTime(saved);
      if (caught.gameOver) {
        // the run ended while they were away — show them how it ended
        setState(caught);
        setScreen('end');
        clearSave();
        return;
      }
      setSavedGame(caught);
    });
    // an existing session skips the sign-in screen entirely
    if (isConfigured()) {
      currentProfile().then((p) => {
        if (!p) return;
        setProfile(p);
        setScreen('setup');
        touchStreak().then((st) => {
          if (st) setProfile((cur) => (cur ? { ...cur, current_streak: st.current, longest_streak: st.longest } : cur));
        });
      });
    }
    loadPrefs().then((p) => {
      setSoundOn(p.soundOn);
      setSoundEnabled(p.soundOn);
      setAiKey(p.aiKey ?? '');
      setTheme(p.theme ?? 'dark');
    });
  }, []);

  // auto-save the run on every change
  useEffect(() => {
    if (state && !state.gameOver && screen === 'game') saveGame(state);
  }, [state, screen]);

  // mirror the headline figures up so the leaderboard stays current mid-run
  useEffect(() => {
    if (state && runId && screen === 'game') updateRun(runId, state);
  }, [state?.month, runId, screen]);

  const start = (business: BusinessId, location: LocationId, ownerName: string, avatar: AvatarSpec) => {
    setState(newGame(business, location, ownerName, avatar));
    setSavedGame(null);
    setScreen('game');
    // open a run record so the month-by-month figures have somewhere to land
    startRun(business, location, ownerName).then(setRunId);
  };

  const continueSaved = () => {
    if (!savedGame) return;
    setState(savedGame);
    setSavedGame(null);
    setScreen('game');
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    savePrefs({ soundOn: next, aiKey, theme });
  };

  const updateAiKey = (key: string) => {
    setAiKey(key);
    savePrefs({ soundOn, aiKey: key, theme });
  };

  const updateTheme = (t: ThemeMode) => {
    setTheme(t);
    savePrefs({ soundOn, aiKey, theme: t });
  };

  return (
    <ThemeProvider value={palette}>
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
        <StatusBar style={palette.statusBar} />
        {screen === 'account' && (
          <AccountScreen
            onDone={(p) => { setProfile(p); setScreen('setup'); touchStreak(); }}
            onSkip={() => setScreen('setup')}
            refresh={currentProfile}
          />
        )}
        {showBoard && (
          <LeaderboardScreen onClose={() => setShowBoard(false)} meId={profile?.id} />
        )}
        {!showBoard && screen === 'setup' && (
          <SetupScreen
            onStart={start}
            savedGame={savedGame}
            onContinue={continueSaved}
            theme={theme}
            onSetTheme={updateTheme}
            soundOn={soundOn}
            onToggleSound={toggleSound}
            aiKey={aiKey}
            onSetAiKey={updateAiKey}
            profile={profile}
            onShowLeaderboard={isConfigured() ? () => setShowBoard(true) : undefined}
            onSignIn={() => setScreen('account')}
          />
        )}
        {!showBoard && screen === 'game' && state && (
          <GameScreen
            state={state}
            setState={setState}
            onGameOver={(s) => {
              if (runId) updateRun(runId, s, true);
              setState(s); clearSave(); setScreen('end');
            }}
            soundOn={soundOn}
            onToggleSound={toggleSound}
            aiKey={aiKey}
            onSetAiKey={updateAiKey}
            theme={theme}
            onSetTheme={updateTheme}
            onRestart={() => { clearSave(); setState(null); setSavedGame(null); setRunId(null); setScreen('setup'); }}
            runId={runId}
          />
        )}
        {!showBoard && screen === 'end' && state && (
          <EndScreen state={state} onRestart={() => { setState(null); setScreen('setup'); }} />
        )}
      </SafeAreaView>
    </ThemeProvider>
  );
}
