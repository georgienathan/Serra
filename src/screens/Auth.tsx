// src/screens/Auth.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<'in' | 'up' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSignIn() {
    setMsg(null);
    setLoading('in');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    setLoading(null);
  }

  async function handleSignUp() {
    setMsg(null);
    setLoading('up');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) setMsg(error.message);
    else {
      setMsg(
        data.session
          ? 'Signed up and logged in!'
          : 'Signed up! Check your email to confirm before logging in.'
      );
    }
    setLoading(null);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>

      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        placeholder="Password (min 6 characters)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      {msg ? <Text style={styles.message}>{msg}</Text> : null}

      <Pressable
        onPress={handleSignIn}
        disabled={!!loading}
        style={[styles.primaryBtn, loading ? { opacity: 0.6 } : null]}
      >
        {loading === 'in' ? <ActivityIndicator /> : <Text style={styles.primaryText}>Sign in</Text>}
      </Pressable>

      <View style={{ height: 8 }} />

      <Pressable
        onPress={handleSignUp}
        disabled={!!loading}
        style={[styles.secondaryBtn, loading ? { opacity: 0.6 } : null]}
      >
        {loading === 'up' ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.secondaryText}>Create an account</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  message: { textAlign: 'center', marginBottom: 10, color: '#fff' },
  primaryBtn: { backgroundColor: '#f2a1b5', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: 'white', fontWeight: '600', fontSize: 16 },
  secondaryBtn: { backgroundColor: '#e5e7eb', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  secondaryText: { color: '#111827', fontWeight: '600', fontSize: 16 },
});
