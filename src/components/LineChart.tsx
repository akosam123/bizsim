import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';
import { Palette, useTheme, useThemedStyles } from './theme';

interface Series {
  label: string;
  color: string;
  values: number[];
}

interface Props {
  title: string;
  series: Series[];
  width: number;
  height?: number;
  money?: boolean;
}

function fmt(v: number, money?: boolean): string {
  const abs = Math.abs(v);
  const short = abs >= 1000 ? `${(v / 1000).toFixed(abs >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`;
  return money ? `$${short}` : short;
}

export default function LineChart({ title, series, width: rawWidth, height = 140, money }: Props) {
  const C = useTheme();
  const styles = useThemedStyles(makeStyles);
  const width = Math.max(220, rawWidth); // window dims can read 0 for a frame
  const all = series.flatMap((s) => s.values);
  if (all.length < 2) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.empty}>Play a couple of months to see trends.</Text>
      </View>
    );
  }
  const pad = { l: 42, r: 8, t: 8, b: 18 };
  const min = Math.min(0, ...all);
  const max = Math.max(...all) || 1;
  const n = Math.max(...series.map((s) => s.values.length));
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (height - pad.t - pad.b);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.legend}>
          {series.map((s) => (
            <View key={s.label} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <Svg width={width} height={height}>
        {[min, (min + max) / 2, max].map((v, i) => (
          <React.Fragment key={i}>
            <Line x1={pad.l} y1={y(v)} x2={width - pad.r} y2={y(v)} stroke={C.border} strokeWidth={1} />
            <SvgText x={pad.l - 6} y={y(v) + 4} fontSize={10} fill={C.dim} textAnchor="end">
              {fmt(v, money)}
            </SvgText>
          </React.Fragment>
        ))}
        {min < 0 && <Line x1={pad.l} y1={y(0)} x2={width - pad.r} y2={y(0)} stroke={C.dim} strokeWidth={1} strokeDasharray="3,3" />}
        {series.map((s) => (
          <Polyline
            key={s.label}
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
          />
        ))}
      </Svg>
    </View>
  );
}

const makeStyles = (C: Palette) => StyleSheet.create({
  wrap: {
    backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: C.mode === 'light' ? 1 : 0, borderColor: C.border,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { color: C.text, fontWeight: '700', fontSize: 13 },
  legend: { flexDirection: 'row', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: C.dim, fontSize: 11 },
  empty: { color: C.dim, fontSize: 12, paddingVertical: 12 },
});
