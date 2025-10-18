import React from 'react';
import { View, Text } from 'react-native';
import TInput from './TInput';
import { palette } from '../lib/tw';

export default function TDateInput({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;          // YYYY-MM-DD
  onChange: (v: string) => void;
}) {
  return (
    <View>
      {label ? <Text style={{ color: palette.text, marginBottom: 6, fontWeight: '600' }}>{label}</Text> : null}
      <TInput
        placeholder="YYYY-MM-DD"
        value={value}
        onChangeText={(t) => {
          const v = t.replace(/[^\d-]/g, '').slice(0, 10);
          onChange(v);
        }}
        keyboardType="numbers-and-punctuation"
      />
    </View>
  );
}
