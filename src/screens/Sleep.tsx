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
import DayCalendar from '../../components/DayCalendar';
import AttachmentUpload from '../../components/AttachmentUpload';
import ProcessingBanner from '../../components/ProcessingBanner';
import { todayYMD, nowHM, toUTCISO } from '../lib/datetime';
import { getSleepMetricsForDay } from '../lib/wearable-helpers';
import { uploadAndProcess } from '../lib/attachments';
import { useAttachmentStatus } from '../hooks/useAttachmentStatus';
import { MoodType, MOOD_ICONS, MOOD_LABELS } from '../lib/mood-icons';

type Quality = 'poor' | 'ok' | 'good';
type Feeling = MoodType;

type SleepPayload = {
  bedtime: string;          // "HH:MM" local
  wake_time: string;        // "HH:MM" local
  duration_min: number;
  quality?: Quality | null;
  feeling?: Feeling | null;
  notes?: string | null;
  // Wearable metrics (optional)
  deep_min?: number | null;
  rem_min?: number | null;
  sleep_score?: number | null;
  resting_hr?: number | null;
  hrv?: number | null;
};

type SleepRow = { id: string; ts: string | null; payload: SleepPayload };

const QUALITIES = ['poor', 'ok', 'good'] as const;
const FEELINGS = ['happy', 'neutral', 'sad'] as const;

const timeHM = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM');
const schema = z.object({
  dateYMD: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'), // wake date
  bedHM: timeHM,
  wakeHM: timeHM,
  quality: z.enum(QUALITIES).optional(),
  feeling: z.enum(FEELINGS).optional(),
  notes: z.string().optional(),
  // Wearable metrics (optional)
  deep_min: z.number().optional(),
  rem_min: z.number().optional(),
  sleep_score: z.number().optional(),
  resting_hr: z.number().optional(),
  hrv: z.number().optional(),
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
  
  // Upload state
  const [currentAttachmentId, setCurrentAttachmentId] = useState<string | null>(null);
  const attachmentStatus = useAttachmentStatus(currentAttachmentId);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      dateYMD: todayYMD(),       // wake date
      bedHM: '23:00',
      wakeHM: nowHM(),
      quality: 'ok',
      feeling: 'happy',
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

    // Load wearable data and pre-populate form fields
    const wearableData = await getSleepMetricsForDay(d);
    if (wearableData.duration_min > 0 || wearableData.deep_min > 0 || wearableData.rem_min > 0) {
      // Pre-populate wearable fields if data exists
      setValue('deep_min', wearableData.deep_min || undefined);
      setValue('rem_min', wearableData.rem_min || undefined);
      setValue('sleep_score', wearableData.sleep_score || undefined);
      setValue('resting_hr', wearableData.resting_hr || undefined);
      setValue('hrv', wearableData.hrv || undefined);
    }

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
        // Include wearable metrics if provided
        deep_min: v.deep_min ?? null,
        rem_min: v.rem_min ?? null,
        sleep_score: v.sleep_score ?? null,
        resting_hr: v.resting_hr ?? null,
        hrv: v.hrv ?? null,
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

  function handleUploadStart() {
    setMessage('Uploading...');
  }

  function handleUploadComplete(attachmentId: string) {
    setCurrentAttachmentId(attachmentId);
    setMessage('Processing...');
  }

  function handleUploadError(error: string) {
    setMessage(error);
  }

  const previewHours = (durationFrom(bedHM, wakeHM) / 60).toFixed(2);

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>SLEEP</Text>
      {!!message && <Text style={styles.msg}>{message}</Text>}

      {/* Upload Photo or Voice Note */}
      <AttachmentUpload 
        category="sleep"
        day={day}
        onUploadStart={handleUploadStart}
        onUploadComplete={handleUploadComplete}
        onUploadError={handleUploadError}
      />
      {currentAttachmentId && attachmentStatus && (
        <ProcessingBanner status={attachmentStatus.status} />
      )}

      {/* Calendar */}
      <DayCalendar
        selectedDay={day}
        onSelect={(newDay) => {
          setValue('dateYMD', newDay);
          loadForDay(newDay);
        }}
        categories={['period', 'sleep']}
      />

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

      <Text style={styles.label}>QUALITY</Text>
      <View style={styles.rowWrap}>
        <Controller control={control} name="quality" render={({ field: { value, onChange} }) => (
          <>
            {QUALITIES.map(q => (
              <TChip key={q} label={q.toUpperCase()} selected={value === q} onPress={() => onChange(q)} />
            ))}
          </>
        )} />
      </View>

      <Text style={styles.label}>FEELING</Text>
      <View style={styles.rowWrap}>
        <Controller control={control} name="feeling" render={({ field: { value, onChange } }) => (
          <>
            {FEELINGS.map(f => (
              <Pressable
                key={f}
                onPress={() => onChange(f)}
                style={[
                  styles.moodButton,
                  value === f && styles.moodButtonSelected
                ]}
              >
                <FontAwesome5 
                  name={MOOD_ICONS[f]} 
                  size={20} 
                  color={value === f ? palette.teal : palette.text} 
                />
                <Text style={[
                  styles.moodLabel,
                  value === f && styles.moodLabelSelected
                ]}>
                  {MOOD_LABELS[f]}
                </Text>
              </Pressable>
            ))}
          </>
        )} />
      </View>

      <Controller control={control} name="notes" render={({ field: { value, onChange } }) => (
        <TInput placeholder="Notes (optional)" value={value ?? ''} onChangeText={onChange} />
      )} />

      {/* Wearable Metrics Section */}
      <View style={{ height: 16 }} />
      <Text style={styles.section}>Wearable Data (auto-populated)</Text>
      <Text style={{ color: palette.text, opacity: 0.7, fontSize: 12, marginBottom: 8 }}>
        These fields are automatically filled from your wearables. You can edit them manually.
      </Text>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Deep sleep (min)</Text>
          <Controller control={control} name="deep_min" render={({ field: { value, onChange } }) => (
            <TInput 
              placeholder="0" 
              value={value?.toString() ?? ''} 
              onChangeText={(t) => onChange(t ? parseFloat(t) : undefined)} 
              keyboardType="numeric"
            />
          )} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>REM sleep (min)</Text>
          <Controller control={control} name="rem_min" render={({ field: { value, onChange } }) => (
            <TInput 
              placeholder="0" 
              value={value?.toString() ?? ''} 
              onChangeText={(t) => onChange(t ? parseFloat(t) : undefined)} 
              keyboardType="numeric"
            />
          )} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Sleep score</Text>
          <Controller control={control} name="sleep_score" render={({ field: { value, onChange } }) => (
            <TInput 
              placeholder="0-100" 
              value={value?.toString() ?? ''} 
              onChangeText={(t) => onChange(t ? parseFloat(t) : undefined)} 
              keyboardType="numeric"
            />
          )} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Resting HR (bpm)</Text>
          <Controller control={control} name="resting_hr" render={({ field: { value, onChange } }) => (
            <TInput 
              placeholder="0" 
              value={value?.toString() ?? ''} 
              onChangeText={(t) => onChange(t ? parseFloat(t) : undefined)} 
              keyboardType="numeric"
            />
          )} />
        </View>
      </View>

      <Text style={styles.label}>HRV (ms)</Text>
      <Controller control={control} name="hrv" render={({ field: { value, onChange } }) => (
        <TInput 
          placeholder="0" 
          value={value?.toString() ?? ''} 
          onChangeText={(t) => onChange(t ? parseFloat(t) : undefined)} 
          keyboardType="numeric"
        />
      )} />

      <Text style={{ color: palette.text, marginVertical: 8 }}>
        Estimated duration: <Text style={{ fontWeight: '700' }}>{previewHours} h</Text>
      </Text>

      <TButton title="SAVE SLEEP" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />

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
              {e.quality && <Text style={styles.text}>QUALITY: {e.quality.toUpperCase()}</Text>}
              {e.feeling && <Text style={styles.text}>FEELING: {MOOD_LABELS[e.feeling as MoodType] || e.feeling}</Text>}
              {e.notes ? <Text style={styles.text}>NOTES: {e.notes}</Text> : null}
              {/* Display wearable metrics if available */}
              {(e.deep_min || e.rem_min || e.sleep_score || e.resting_hr || e.hrv) && (
                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
                  <Text style={{ ...styles.text, fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Wearable Data:</Text>
                  {e.deep_min && <Text style={{ ...styles.text, fontSize: 12 }}>Deep: {e.deep_min} min</Text>}
                  {e.rem_min && <Text style={{ ...styles.text, fontSize: 12 }}>REM: {e.rem_min} min</Text>}
                  {e.sleep_score && <Text style={{ ...styles.text, fontSize: 12 }}>Score: {e.sleep_score}</Text>}
                  {e.resting_hr && <Text style={{ ...styles.text, fontSize: 12 }}>Resting HR: {e.resting_hr} bpm</Text>}
                  {e.hrv && <Text style={{ ...styles.text, fontSize: 12 }}>HRV: {e.hrv} ms</Text>}
                </View>
              )}
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

  moodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  moodButtonSelected: {
    borderColor: palette.teal,
    backgroundColor: '#fff',
  },
  moodLabel: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  moodLabelSelected: {
    color: palette.teal,
  },

  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontWeight: '700', color: palette.text },
});
