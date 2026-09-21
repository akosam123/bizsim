import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { businessOf } from '../game/config';
import { currentMenu, formatPrice } from '../game/menu';
import { GameState } from '../game/types';
import { COLORS } from './ui';

/**
 * The menu board, as your customers see it. Prices are live — they move
 * with your pricing level and inflation, and every product line you launch
 * adds an item marked NEW.
 */

export default function MenuPanel({ state }: { state: GameState }) {
  const biz = businessOf(state.business);
  const menu = currentMenu(state);
  return (
    <View style={styles.card}>
      <View style={[styles.headerBar, { backgroundColor: biz.accent }]} />
      <Text style={styles.shopName}>{biz.emoji}  {state.ownerName ? `${state.ownerName}'s` : 'The'} {biz.name}</Text>
      <Text style={styles.heading}>— {menu.heading} —</Text>
      <View style={styles.rule} />
      {menu.lines.map((item) => (
        <View key={item.name} style={styles.row}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
            {item.isNew ? <Text style={styles.newBadge}>  NEW</Text> : null}
          </Text>
          <View style={styles.dots} />
          <Text style={styles.price}>{formatPrice(item.price)}</Text>
        </View>
      ))}
      <View style={styles.rule} />
      <Text style={styles.note}>{menu.note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f2ead6', borderRadius: 14, padding: 20, paddingTop: 0,
    borderWidth: 1, borderColor: '#d9cba8', overflow: 'hidden',
  },
  headerBar: { height: 8, marginHorizontal: -20, marginBottom: 14 },
  shopName: { color: '#3a3430', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  heading: { color: '#8a7a5e', fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 4, letterSpacing: 2, textTransform: 'uppercase' },
  rule: { height: 1.5, backgroundColor: '#d9cba8', marginVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 9 },
  itemName: { color: '#3a3430', fontSize: 14.5, fontWeight: '600', flexShrink: 1 },
  newBadge: { color: COLORS.danger, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  dots: { flex: 1, borderBottomWidth: 1.5, borderStyle: 'dotted', borderColor: '#b3a37e', marginHorizontal: 6, minWidth: 16 },
  price: { color: '#3a3430', fontSize: 14.5, fontWeight: '800' },
  note: { color: '#8a7a5e', fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
});
