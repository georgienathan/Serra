import React from 'react';
import { TextInput, TextInputProps, StyleSheet } from 'react-native';

export default function TInput(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="rgba(0,0,0,0.45)"
      style={[styles.input, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#fff',     // ← white box
    color: '#111827',            // dark text inside
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 8,
  },
});
