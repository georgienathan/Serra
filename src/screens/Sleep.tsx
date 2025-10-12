// src/screens/Sleep.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { supabase } from '../lib/supabase';
import { palette } from '../../lib/tw';
import TInput from '../../components/TInput';
import TButton from '../../components/TButton';
import TDateInput from '../../components/TDateInput';
import TTimeInput from '../../components/TTimeInput';
import TChip from '../../components/TChip';
import { todayYMD, nowHM, toUTCISO } from '../lib/datetime';

type Quality = 'poor' | 'ok' | 'good';
type Feeling = '🙂' | '😐' | '☹️';

type SleepPayload = {
  bedtime: string;          // "HH:MM" local
  wake_time: string;        // "HH:MM" local
  duration_min: number;
  quality?: Quality | null;
  feeling?: Feeling | null;
  notes?: string | null;
};

type SleepRow = { id: string; ts: string | null; payload: SleepPayload };

const QUALITIES = ['poor', 'ok', 'good'] as const;
const FEELINGS = ['🙂', '😐', '☹️'] as const;

const timeHM = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM');
const schema = z.object({
  dateYMD: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'), // wake date
  bedHM: timeHM,
  wakeHM: timeHM,
  quality: z.enum(QUALITIES).optional(),
  feeling: z.enum(FEELINGS).optional(),
  notes: z.string().optional(),
});
type FormVals = z.infer<typeof schema>;

function prevDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() - 1);
  const yy = dt.getFullYear();
  const mm = `${dt.getMonth() + 1}`.padStart(2, '0');
  const dd = `${dt.getDate()}`.padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
function parseHM(hm: string): number {
  const [h, m] = hm.split(':').map((x) => Number(x || 0));
  return h * 60 + m;
}
function durationFrom(bedHM: string, wakeHM: string): number {
  const b = parseHM(bedHM);
  const w = parseHM(wakeHM);
  return w >= b ? w - b : w + 1440 - b;
}

export default function Sleep() {
  const [message, setMessage] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [rows, setRows] = useState<SleepRow[]>([]);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      dateYMD: todayYMD(),       // wake date
      bedHM: '23:00',
      wakeHM: nowHM(),
      quality: 'ok',
      feeling: '🙂',
      notes: '',
    },
  });

  const day = watch('dateYMD');
  const bedHM = watch('bedHM');
  const wakeHM = watch('wakeHM');

  async function loadForDay(d: string) {
    setLoadingList(true);
    setMessage(null);

    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) {
      setMessage('Please sign in again.');
      setLoadingList(false);
      return;
    }

    const { data, error } = await supabase
      .from('entries')
      .select('id, ts, payload')
      .eq('user_id', u.user.id)
      .eq('category', 'sleep')
      .eq('day', d)
      .order('ts', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoadingList(false);
      return;
    }

    const mapped: SleepRow[] = (data ?? []).map((r: any) => ({
      id: String(r.id),
      ts: r.ts ?? null,
      payload: (r.payload ?? {}) as SleepPayload,
    }));

    setRows(mapped);
    setLoadingList(false);
  }

  useEffect(() => {
    loadForDay(day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const todaysTotal = useMemo(
    () => rows.reduce((acc, r) => acc + ((r.payload?.duration_min ?? 0) as number), 0),
    [rows]
  );

  const onSubmit = async (v: FormVals) => {
    try {
      setMessage(null);
      const dur = durationFrom(v.bedHM, v.wakeHM);

      // wake date = v.dateYMD; bedtime date may be previous day if crossing midnight
      const bedDate = parseHM(v.bedHM) <= parseHM(v.wakeHM) ? v.dateYMD : prevDay(v.dateYMD);
      const bedISO = toUTCISO(bedDate, v.bedHM);
      const wakeISO = toUTCISO(v.dateYMD, v.wakeHM); // save wake as ts

      const payload: SleepPayload = {
        bedtime: v.bedHM,
        wake_time: v.wakeHM,
        duration_min: dur,
        quality: v.quality ?? null,
        feeling: v.feeling ?? null,
        notes: v.notes?.trim() || null,
      };

      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) {
        setMessage('Please sign in again.');
        return;
      }

      const { error } = await supabase.from('entries').insert({
        user_id: u.user.id,
        category: 'sleep',
        day: v.dateYMD, // bucket by wake date
        ts: wakeISO,
        payload: { ...payload, bedtime_abs: bedISO, wake_abs: wakeISO },
      });
      if (error) throw error;

      setMessage('Saved!');
      reset({ ...v, bedHM: '23:00', wakeHM: nowHM(), notes: '' });
      await loadForDay(v.dateYMD);
    } catch (e: any) {
      setMessage(e.message ?? String(e));
    }
  };

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from('entries').delete().eq('id', id);
      if (error) throw error;
      await loadForDay(day);
    } catch (e: any) {
      setMessage(e.message ?? String(e));
    }
  }

  const previewHours = (durationFrom(bedHM, wakeHM) / 60).toFixed(2);

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Sleep</Text>
      {!!message && <Text style={styles.msg}>{message}</Text>}

      <Controller control={control} name="dateYMD" render={({ field: { value, onChange } }) => (
        <TDateInput label="Wake date" value={value} onChange={onChange} />
      )} />
      {errors.dateYMD && <Text style={styles.err}>{errors.dateYMD.message}</Text>}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Controller control={control} name="bedHM" render={({ field: { value, onChange } }) => (
            <TTimeInput label="Bedtime" value={value} onChange={onChange} />
          )} />
          {errors.bedHM && <Text style={styles.err}>{errors.bedHM.message}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Controller control={control} name="wakeHM" render={({ field: { value, onChange } }) => (
            <TTimeInput label="Wake time" value={value} onChange={onChange} />
          )} />
          {errors.wakeHM && <Text style={styles.err}>{errors.wakeHM.message}</Text>}
        </View>
      </View>

      <Text style={styles.label}>Quality</Text>
      <View style={styles.rowWrap}>
        <Controller control={control} name="quality" render={({ field: { value, onChange } }) => (
          <>
            {QUALITIES.map(q => (
              <TChip key={q} label={q} selected={value === q} onPress={() => onChange(q)} />
            ))}
          </>
        )} />
      </View>

      <Text style={styles.label}>Feeling</Text>
      <View style={styles.rowWrap}>
        <Controller control={control} name="feeling" render={({ field: { value, onChange } }) => (
          <>
            {FEELINGS.map(f => (
              <TChip key={f} label={f} selected={value === f} onPress={() => onChange(f)} />
            ))}
          </>
        )} />
      </View>

      <Controller control={control} name="notes" render={({ field: { value, onChange } }) => (
        <TInput placeholder="Notes (optional)" value={value ?? ''} onChangeText={onChange} />
      )} />

      <Text style={{ color: palette.text, marginVertical: 8 }}>
        Estimated duration: <Text style={{ fontWeight: '700' }}>{previewHours} h</Text>
      </Text>

      <TButton title="Save sleep" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />

      <View style={{ height: 16 }} />
      <Text style={styles.section}>Total for {day}</Text>
      <Text style={styles.text}>{(todaysTotal / 60).toFixed(2)} hours ({todaysTotal} min)</Text>

      <View style={{ height: 12 }} />
      <Text style={styles.section}>Entries</Text>
      {loadingList ? (
        <ActivityIndicator />
      ) : rows.length === 0 ? (
        <Text style={styles.text}>No entries for this date.</Text>
      ) : (
        rows.map((row) => {
          const e = row.payload || ({} as SleepPayload);
          const time = row.ts ? new Date(row.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
          const hours = (e.duration_min ?? 0) / 60;
          return (
            <View key={row.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {time} — {e.bedtime} → {e.wake_time} • {hours.toFixed(2)} h
                </Text>
                <Pressable onPress={() => handleDelete(row.id)} hitSlop={8}>
                  <FontAwesome5 name="trash" size={14} color="#ef4444" />
                </Pressable>
              </View>
              {e.quality && <Text style={styles.text}>Quality: {e.quality}</Text>}
              {e.feeling && <Text style={styles.text}>Feeling: {e.feeling}</Text>}
              {e.notes ? <Text style={styles.text}>Notes: {e.notes}</Text> : null}
            </View>
          );
        })
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: palette.text },
  section: { fontSize: 18, fontWeight: '600', marginBottom: 6, color: palette.text },
  label: { marginTop: 8, marginBottom: 6, fontWeight: '600', color: palette.text },
  text: { color: palette.text },
  msg: { marginBottom: 10, color: palette.text },
  err: { color: '#ef4444', marginTop: 4 },

  row: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-end' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontWeight: '700', color: palette.text },
});
