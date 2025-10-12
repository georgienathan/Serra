// src/screens/About.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import TInput from '../../components/TInput';
import { palette } from '../../lib/tw';

export default function About() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState<string>('');
  const [preferredName, setPreferredName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMessage(null);

      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr || !u.user) {
        setMessage('Please sign in again.');
        setLoading(false);
        return;
      }

      setEmail(u.user.email ?? '');

      // fetch profile (preferred_name)
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('preferred_name')
        .eq('id', u.user.id)
        .maybeSingle();

      if (!error && profile?.preferred_name) {
        setPreferredName(profile.preferred_name);
      }
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      setMessage(null);

      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr || !u.user) {
        setMessage('Please sign in again.');
        setSaving(false);
        return;
      }

      // upsert preferred_name (creates row if missing)
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: u.user.id, preferred_name: preferredName });

      if (error) throw error;

      setMessage('Saved!');
    } catch (e: any) {
      setMessage(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: palette.text }}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 8 }}
      style={{ backgroundColor: palette.background }}
    >
      <Text style={styles.title}>About</Text>

      {!!message && <Text style={styles.msg}>{message}</Text>}

      <Text style={styles.label}>Email</Text>
      <View style={styles.readonlyBox}>
        <Text style={{ color: palette.text, opacity: 0.8 }}>{email || '—'}</Text>
      </View>

      <Text style={styles.label}>Preferred name</Text>
      <TInput
        placeholder="e.g. Georgie"
        value={preferredName}
        onChangeText={setPreferredName}
      />

      <Pressable
        onPress={handleSave}
        disabled={saving}
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
      </Pressable>

      <View style={{ height: 24 }} />

      {/* Wearables Connections */}
      <Text style={styles.section}>Wearables & Devices</Text>
      <Pressable
        onPress={() => navigation.navigate('Connections')}
        style={styles.connectionsButton}
      >
        <View style={styles.connectionsContent}>
          <FontAwesome5 name="link" size={20} color={palette.teal} />
          <View style={styles.connectionsText}>
            <Text style={styles.connectionsTitle}>Connected Devices</Text>
            <Text style={styles.connectionsSubtitle}>Sync data from Oura, Strava, Fitbit & more</Text>
          </View>
        </View>
        <FontAwesome5 name="chevron-right" size={16} color={palette.text} style={{ opacity: 0.5 }} />
      </Pressable>

      <View style={{ height: 24 }} />

      {/* placeholders for future questionnaire editing */}
      <Text style={styles.section}>Questionnaire (coming soon)</Text>
      <Text style={{ color: palette.text, opacity: 0.85 }}>
        You’ll be able to review and edit your aims, skills, and equipment here.
      </Text>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8, color: palette.text },
  section: { fontSize: 18, fontWeight: '600', marginTop: 12, marginBottom: 6, color: palette.text },
  label: { marginTop: 8, marginBottom: 6, fontWeight: '600', color: palette.text },
  msg: { marginBottom: 10, color: palette.text },
  readonlyBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveBtn: {
    backgroundColor: '#f2a1b5',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveText: { color: 'white', fontWeight: '700', fontSize: 16 },
  connectionsButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  connectionsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  connectionsText: {
    flex: 1,
  },
  connectionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 2,
  },
  connectionsSubtitle: {
    fontSize: 13,
    color: palette.text,
    opacity: 0.6,
  },
});
