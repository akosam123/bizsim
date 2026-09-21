import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Palette, useThemedStyles } from '../components/theme';
import { LeaderboardRow, leaderboard, myRank } from '../game/account';

interface Props {
  onClose: () => void;
  meId?: string | null;
}

const money = (n: number) =>
  '$' + Math.round(n).toLocaleString();

/**
 * The world board, ranked by the best balance a player has ever reached. Their
 * own row is pinned at the bottom when they're outside the visible top, so the
 * screen always answers "where am I?" without scrolling.
 */
export default function LeaderboardScreen({ onClose, meId }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [mine, setMine] = useState<LeaderboardRow | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([leaderboard(50), myRank()]).then(([top, me]) => {
      if (!live) return;
      setRows(top);
      setMine(me);
    });
    return () => { live = false; };
  }, []);

  const inTop = rows?.some((r) => r.user_id === meId) ?? false;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>World leaderboard</Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onClose} hitSlop={12}><Text style={styles.close}>Close</Text></Pressable>
      </View>

      {rows === null && <ActivityIndicator style={{ marginTop: 40 }} />}

      {rows?.length === 0 && (
        <Text style={styles.empty}>Nobody has posted a run yet. Be the first.</Text>
      )}

      {rows && rows.length > 0 && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={styles.headRow}>
            <Text style={[styles.head, { width: 46 }]}>#</Text>
            <Text style={[styles.head, { flex: 1 }]}>Player</Text>
            <Text style={[styles.head, { width: 62, textAlign: 'right' }]}>Streak</Text>
            <Text style={[styles.head, { width: 96, textAlign: 'right' }]}>Best</Text>
          </View>
          {rows.map((r) => (
            <Row key={r.user_id} row={r} me={r.user_id === meId} styles={styles} />
          ))}
        </ScrollView>
      )}

      {mine && !inTop && (
        <View style={styles.pinned}>
          <Text style={styles.pinnedLabel}>Your position</Text>
          <Row row={mine} me styles={styles} />
        </View>
      )}
    </View>
  );
}

function Row({ row, me, styles }: { row: LeaderboardRow; me: boolean; styles: any }) {
  return (
    <View style={[styles.row, me && styles.rowMe]}>
      <Text style={[styles.rank, { width: 46 }]}>{row.rank}</Text>
      <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>
        {row.display_name}{me ? '  (you)' : ''}
      </Text>
      <Text style={[styles.streak, { width: 62, textAlign: 'right' }]}>
        {row.current_streak > 0 ? `${row.current_streak}d` : '—'}
      </Text>
      <Text style={[styles.cash, { width: 96, textAlign: 'right' }]}>{money(row.best_cash)}</Text>
    </View>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  title: { color: C.text, fontSize: 20, fontWeight: '800' },
  close: { color: C.dim, fontSize: 14, fontWeight: '600' },
  empty: { color: C.dim, fontSize: 14, textAlign: 'center', marginTop: 40 },
  headRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 6,
  },
  head: { color: C.dim, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  rowMe: { borderColor: C.accent, backgroundColor: C.cardAlt },
  rank: { color: C.dim, fontSize: 14, fontWeight: '700' },
  name: { color: C.text, fontSize: 14, fontWeight: '600' },
  streak: { color: C.warn, fontSize: 13, fontWeight: '700' },
  cash: { color: C.accent, fontSize: 14, fontWeight: '800' },
  pinned: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, marginTop: 4 },
  pinnedLabel: {
    color: C.dim, fontSize: 11, fontWeight: '700', letterSpacing: 0.6,
    textTransform: 'uppercase', marginBottom: 6, paddingHorizontal: 12,
  },
});
