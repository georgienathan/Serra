import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { palette } from '../lib/tw';

export default function TButton({
  title,
  onPress,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.btn, isDisabled && { opacity: 0.6 }, style]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.text}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: palette.accent, // pink
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  text: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
