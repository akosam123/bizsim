import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Palette, useTheme, useThemedStyles } from './theme';

/**
 * Legacy constant palette. Kept ONLY for art-layer components (sprites,
 * scene overlays, SVG fallbacks) whose colors sit on top of artwork and
 * shouldn't follow the chrome theme. Chrome components use useTheme().
 */
export const COLORS = {
  bg: '#12141d',
  card: '#1c2030',
  cardAlt: '#242940',
  border: '#33384a',
  text: '#e8ebf5',
  dim: '#8b93ad',
  accent: '#5ac47f',
  danger: '#e05b4b',
  warn: '#e8c86a',
  blue: '#3d9be9',
};

export function Button({
  label, onPress, kind = 'primary', disabled, small, style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  small?: boolean;
  style?: ViewStyle;
}) {
  const C = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        kind === 'primary' && { backgroundColor: C.accent },
        kind === 'ghost' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
        kind === 'danger' && { backgroundColor: C.danger },
        disabled && { opacity: 0.35 },
        pressed && !disabled && { opacity: 0.75 },
        style,
      ]}
    >
      <Text style={[
        styles.btnText,
        small && { fontSize: 12 },
        kind === 'ghost' && { color: C.text },
        kind === 'danger' && { color: '#ffffff' },
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' | 'warn' }) {
  const C = useTheme();
  const styles = useThemedStyles(makeStyles);
  const color = tone === 'good' ? C.accent : tone === 'bad' ? C.danger : tone === 'warn' ? C.warn : C.text;
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

export function money(v: number): string {
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString()}`;
}

/** A row of mutually-exclusive choice chips. */
export function ChipRow<T extends string>({
  options, value, onChange,
}: {
  options: { id: T; name: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.chipRow}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.name}</Text>
            {o.hint ? <Text style={[styles.chipHint, active && styles.chipHintActive]}>{o.hint}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  btn: {
    backgroundColor: C.accent,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnSmall: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8 },
  btnText: { color: '#0e1a12', fontWeight: '700', fontSize: 14 },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: C.mode === 'light' ? 1 : 0,
    borderColor: C.border,
  },
  stat: { flex: 1, minWidth: 80 },
  statLabel: { color: C.dim, fontSize: 11, marginBottom: 2 },
  statValue: { fontSize: 16, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    backgroundColor: C.cardAlt,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.border,
    flexGrow: 1,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.text, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: C.mode === 'light' ? '#ffffff' : '#0e1a12', fontWeight: '700' },
  chipHint: { color: C.dim, fontSize: 10, marginTop: 2, textAlign: 'center' },
  chipHintActive: { color: C.mode === 'light' ? '#e4f5ea' : '#27503a' },
});
