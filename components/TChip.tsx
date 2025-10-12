import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { palette } from '../lib/tw';

export default function TChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSel]}>
      <Text style={[styles.text, selected && styles.textSel]}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  chipSel: { backgroundColor: palette.teal, borderColor: palette.teal },
  text: { color: '#111827' },
  textSel: { color: '#fff', fontWeight: '600' },
});
