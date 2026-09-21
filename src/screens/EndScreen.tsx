import React from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import LineChart from '../components/LineChart';
import Storefront from '../components/Storefront';
import { Palette, useTheme, useThemedStyles } from '../components/theme';
import { Button, Card, Stat, money } from '../components/ui';
import { businessOf, locationOf } from '../game/config';
import { scoreGame } from '../game/engine';
import { GameState } from '../game/types';

interface Props {
  state: GameState;
  onRestart: () => void;
}

const GRADE_COLORS: Record<string, string> = {
  S: '#e8c86a', A: '#5ac47f', B: '#3d9be9', C: '#b07d4f', D: '#e05b4b',
};

export default function EndScreen({ state, onRestart }: Props) {
  const C = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width - 32, 488);
  const biz = businessOf(state.business);
  const loc = locationOf(state.location);
  const score = scoreGame(state);
  const totalRevenue = state.history.reduce((a, h) => a + h.revenue, 0);
  const totalProfit = state.history.reduce((a, h) => a + h.profit, 0);
  const totalCustomers = state.history.reduce((a, h) => a + h.customers, 0);
  const bestMonth = state.history.reduce((b, h) => (h.profit > b.profit ? h : b), state.history[0]);
  const worstMonth = state.history.reduce((w, h) => (h.profit < w.profit ? h : w), state.history[0]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{state.bankrupt ? '💀 Bankrupt' : '🏁 Final Results'}</Text>
      <Text style={styles.subtle}>{biz.emoji} {biz.name} · {loc.name} · {state.month} months</Text>

      <View style={styles.scene}>
        <Storefront
          business={state.business}
          location={state.location}
          storeTier={state.storeTier}
          crowd={state.bankrupt ? 0 : 0.7}
          reputation={state.reputation}
          width={contentWidth}
        />
      </View>

      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Text style={[styles.grade, { color: GRADE_COLORS[score.grade] }]}>{score.grade}</Text>
        <Text style={styles.valuation}>Business valuation: {money(score.valuation)}</Text>
        <Text style={styles.summary}>{score.summary}</Text>
      </Card>

      <Card>
        <View style={styles.statRow}>
          <Stat label="Total revenue" value={money(totalRevenue)} />
          <Stat label="Total profit" value={money(totalProfit)} tone={totalProfit >= 0 ? 'good' : 'bad'} />
        </View>
        <View style={[styles.statRow, { marginTop: 10 }]}>
          <Stat label="Customers served" value={totalCustomers.toLocaleString()} />
          <Stat label="Final reputation" value={`${Math.round(state.reputation)}/100`} />
        </View>
        {bestMonth && worstMonth && (
          <View style={[styles.statRow, { marginTop: 10 }]}>
            <Stat label="Best month" value={`M${bestMonth.month}: ${money(bestMonth.profit)}`} tone="good" />
            <Stat label="Worst month" value={`M${worstMonth.month}: ${money(worstMonth.profit)}`} tone="bad" />
          </View>
        )}
      </Card>

      <LineChart
        title="The whole journey"
        money
        width={contentWidth - 24}
        series={[
          { label: 'Revenue', color: C.blue, values: state.history.map((h) => h.revenue) },
          { label: 'Profit', color: C.accent, values: state.history.map((h) => h.profit) },
          { label: 'Cash', color: C.warn, values: state.history.map((h) => h.cash) },
        ]}
      />

      <Button label="Start a new business" onPress={onRestart} style={{ marginTop: 8, marginBottom: 48 }} />
    </ScrollView>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  h1: { color: C.text, fontSize: 28, fontWeight: '800', marginTop: 24 },
  subtle: { color: C.dim, fontSize: 13, marginBottom: 14, marginTop: 4 },
  scene: { borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  grade: { fontSize: 64, fontWeight: '900', lineHeight: 70 },
  valuation: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 6 },
  summary: { color: C.dim, fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 12 },
  statRow: { flexDirection: 'row', gap: 8 },
});
