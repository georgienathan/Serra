// components/StatCard.tsx
import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { palette } from '../lib/tw';


type Props = {
  title: string;
  value: ReactNode;
  onPress?: () => void;
  icon?: ReactNode;
  accentColor?: string; // NEW
};

export default function StatCard({
  title,
  value,
  onPress,
  icon,
  accentColor = palette.accent, // default to pink
}: Props) {
  const Container = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      style={[styles.card, { borderColor: accentColor }]}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: accentColor }]}>
          {icon}
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={styles.value}>{value}</Text>
      ) : (
        value
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '700', color: '#111827' },
  value: { color: '#111827' },
});
