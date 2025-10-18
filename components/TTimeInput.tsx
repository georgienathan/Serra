import React from 'react';
import { View, Text } from 'react-native';
import TInput from './TInput';
import { palette } from '../lib/tw';

// 24h HH:MM; we keep it simple for web; swap for native pickers later
export default function TTimeInput({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;          // HH:MM
  onChange: (v: string) => void;
}) {
  return (
    <View>
      {label ? <Text style={{ color: palette.text, marginBottom: 6, fontWeight: '600' }}>{label}</Text> : null}
      <TInput
        placeholder="HH:MM"
        value={value}
        onChangeText={(t) => {
          const v = t.replace(/[^\d:]/g, '').slice(0, 5);
          onChange(v);
        }}
        keyboardType="numbers-and-punctuation"
      />
    </View>
  );
}
