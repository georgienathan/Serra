// src/screens/Exercise.tsx
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
import AttachmentUpload from '../../components/AttachmentUpload';
import ProcessingBanner from '../../components/ProcessingBanner';
import ExtractionReviewDrawer from '../../components/ExtractionReviewDrawer';
import DayCalendar from '../../components/DayCalendar';
import { todayYMD, nowHM, toUTCISO } from '../lib/datetime';
import { uploadAndProcess } from '../lib/attachments';
import { useAttachmentStatus } from '../hooks/useAttachmentStatus';

/* ---------------------------------- Types --------------------------------- */

// Literal tuples (as const) so z.enum() works and TS keeps narrow types
const TYPES = [
  'walk',
  'run',
  'cycle',
  'strength',
  'yoga',
  'pilates',
  'swim',
  'crossfit',
  'hyrox',
  'horse',
  'other',
] as const;
type ExerciseType = typeof TYPES[number];

const INTENSITIES = ['easy', 'moderate', 'hard'] as const;
type Intensity = typeof INTENSITIES[number];

const FEELINGS = ['🙂', '😐', '☹️'] as const;
type Feeling = typeof FEELINGS[number];

// For conditional fields
const DISTANCE_TYPES: readonly ExerciseType[] = ['walk', 'run', 'cycle', 'swim'] as const;
const STEP_TYPES: readonly ExerciseType[] = ['walk', 'run'] as const;

type ExercisePayload = {
  type: ExerciseType;
  duration_min: number;
  distance_km?: number | null;
  steps?: number | null;
  intensity?: Intensity | null;
  feeling?: Feeling | null;
  notes?: string | null;
};

type ExerciseRow = { id: string; ts: string | null; payload: ExercisePayload };

/* ------------------------------- Validation -------------------------------- */

const numStr = z
  .string()
  .trim()
  .optional()
  .refine((v) => v === undefined || v === '' || !Number.isNaN(Number(v)), 'Must be a number');

const posMinutes = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, 'Minutes must be > 0');

const schema = z.object({
  dateYMD: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  timeHM: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
  type: z.enum(TYPES),
  duration: posMinutes,
  distance_km: numStr,
  steps: numStr,
  intensity: z.enum(INTENSITIES).optional(),
  feeling: z.enum(FEELINGS).optional(),
  notes: z.string().optional(),
});
type FormVals = z.infer<typeof schema>;

/* --------------------------------- Screen --------------------------------- */

export default function Exercise() {
  const [message, setMessage] = useState<string | null>(null);
  
  // Upload state
  const [currentAttachmentId, setCurrentAttachmentId] = useState<string | null>(null);
  const [showReviewDrawer, setShowReviewDrawer] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [rows, setRows] = useState<ExerciseRow[]>([]);

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
      dateYMD: todayYMD(),
      timeHM: nowHM(),
      type: 'run',
      duration: '',
      distance_km: '',
      steps: '',
      intensity: 'moderate',
      feeling: '🙂',
      notes: '',
    },
  });

  const day = watch('dateYMD');
  const typeWatch = watch('type');
  
  // Monitor attachment processing
  const { status: attachmentStatus, extracted } = useAttachmentStatus(currentAttachmentId);
  
  // Handle attachment processing completion
  React.useEffect(() => {
    if (attachmentStatus === 'ready' && extracted) {
      setExtractedData(extracted);
      setShowReviewDrawer(true);
    } else if (attachmentStatus === 'error') {
      setMessage('AI processing failed. Please try again.');
      setCurrentAttachmentId(null);
    }
  }, [attachmentStatus, extracted]);

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
      .eq('category', 'exercise')
      .eq('day', d)
      .order('ts', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoadingList(false);
      return;
    }

    const mapped: ExerciseRow[] = (data ?? []).map((r: any) => ({
      id: String(r.id),
      ts: r.ts ?? null,
      payload: (r.payload ?? {}) as ExercisePayload,
    }));
    setRows(mapped);
    setLoadingList(false);
  }

  useEffect(() => {
    loadForDay(day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          const e = r.payload || ({} as ExercisePayload);
          acc.minutes += e.duration_min ?? 0;
          acc.sessions += 1;
          acc.distance += e.distance_km ?? 0;
          acc.steps += e.steps ?? 0;
          return acc;
        },
        { minutes: 0, sessions: 0, distance: 0, steps: 0 }
      ),
    [rows]
  );

  const onSubmit = async (v: FormVals) => {
    try {
      setMessage(null);
      const toNum = (s?: string) => (s && s.trim() !== '' ? Number(s) : null);

      const payload: ExercisePayload = {
        type: v.type,
        duration_min: Number(v.duration),
        distance_km: DISTANCE_TYPES.includes(v.type) ? toNum(v.distance_km) : null,
        steps: STEP_TYPES.includes(v.type) ? toNum(v.steps) : null,
        intensity: v.intensity ?? null,
        feeling: v.feeling ?? null,
        notes: v.notes?.trim() || null,
      };

      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) {
        setMessage('Please sign in again.');
        return;
      }

      const tsISO = toUTCISO(v.dateYMD, v.timeHM);

      const { error } = await supabase.from('entries').insert({
        user_id: u.user.id,
        category: 'exercise',
        day: v.dateYMD,
        ts: tsISO,
        payload,
      });
      if (error) throw error;

      setMessage('Saved!');
      reset({
        ...v,
        timeHM: nowHM(),
        duration: '',
        distance_km: '',
        steps: '',
        notes: '',
      });
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

  // Upload handlers
  const handleUploadStart = () => {
    setMessage(null);
  };

  const handleUploadComplete = (attachmentId: string) => {
    setCurrentAttachmentId(attachmentId);
  };

  const handleUploadError = (error: string) => {
    setMessage(`Upload failed: ${error}`);
  };

  // Review drawer handlers
  const handleFieldChange = (field: string, value: any) => {
    setExtractedData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleApplyExtractedData = () => {
    if (extractedData) {
      // Convert extracted data to form values
      const formData = {
        type: extractedData.type || 'other',
        duration: extractedData.duration_min?.toString() || '',
        distance_km: extractedData.distance_km?.toString() || '',
        steps: '', // Not extracted by AI
        intensity: extractedData.intensity || undefined,
        feeling: watch('feeling') || '🙂',
        notes: extractedData.notes || '',
        // Keep existing values for date/time
        dateYMD: watch('dateYMD'),
        timeHM: watch('timeHM')
      };

      reset(formData);
      setShowReviewDrawer(false);
      setCurrentAttachmentId(null);
      setExtractedData(null);
      setMessage('AI data applied to form. Please review and save.');
    }
  };

  const handleCancelReview = () => {
    setShowReviewDrawer(false);
    setCurrentAttachmentId(null);
    setExtractedData(null);
  };

  return (
    <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Exercise</Text>
      {!!message && <Text style={styles.msg}>{message}</Text>}

      {/* Calendar */}
      <DayCalendar
        selectedDay={day}
        onSelect={(newDay) => {
          setValue('dateYMD', newDay);
          loadForDay(newDay);
        }}
        categories={['exercise']}
      />

      {/* Date + Time */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Controller
            control={control}
            name="dateYMD"
            render={({ field: { value, onChange } }) => (
              <TDateInput label="Date" value={value} onChange={onChange} />
            )}
          />
          {errors.dateYMD && <Text style={styles.err}>{errors.dateYMD.message}</Text>}
        </View>
        <View style={{ width: 120 }}>
          <Controller
            control={control}
            name="timeHM"
            render={({ field: { value, onChange } }) => (
              <TTimeInput label="Time" value={value} onChange={onChange} />
            )}
          />
          {errors.timeHM && <Text style={styles.err}>{errors.timeHM.message}</Text>}
        </View>
      </View>

      {/* AI Upload */}
      <AttachmentUpload
        category="exercise"
        day={day}
        onUploadStart={handleUploadStart}
        onUploadComplete={handleUploadComplete}
        onUploadError={handleUploadError}
        disabled={isSubmitting}
      />

      {/* Processing Banner */}
      {currentAttachmentId && (
        <ProcessingBanner
          status={attachmentStatus}
          error={attachmentStatus === 'error' ? 'Processing failed' : undefined}
        />
      )}

      {/* Type chips */}
      <Text style={styles.label}>Type</Text>
      <View style={styles.rowWrap}>
        <Controller
          control={control}
          name="type"
          render={({ field: { value, onChange } }) => (
            <>
              {TYPES.map((t) => (
                <TChip key={t} label={t} selected={value === t} onPress={() => onChange(t)} />
              ))}
            </>
          )}
        />
      </View>
      {errors.type && <Text style={styles.err}>{errors.type.message}</Text>}

      {/* Minutes + Intensity */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Duration (min)</Text>
          <Controller
            control={control}
            name="duration"
            render={({ field: { value, onChange } }) => (
              <TInput placeholder="e.g. 45" value={value} onChangeText={onChange} keyboardType="number-pad" />
            )}
          />
          {errors.duration && <Text style={styles.err}>{errors.duration.message}</Text>}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Intensity</Text>
          <View style={styles.rowWrap}>
            <Controller
              control={control}
              name="intensity"
              render={({ field: { value, onChange } }) => (
                <>
                  {INTENSITIES.map((i) => (
                    <TChip key={i} label={i} selected={value === i} onPress={() => onChange(i)} />
                  ))}
                </>
              )}
            />
          </View>
        </View>
      </View>

      {/* Conditional fields */}
      {DISTANCE_TYPES.includes(typeWatch) && (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Distance (km)</Text>
            <Controller
              control={control}
              name="distance_km"
              render={({ field: { value, onChange } }) => (
                <TInput
                  placeholder="optional"
                  value={value ?? ''}
                  onChangeText={onChange}
                  keyboardType="decimal-pad"
                />
              )}
            />
            {errors.distance_km && <Text style={styles.err}>{errors.distance_km.message}</Text>}
          </View>

          {STEP_TYPES.includes(typeWatch) ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Steps</Text>
              <Controller
                control={control}
                name="steps"
                render={({ field: { value, onChange } }) => (
                  <TInput placeholder="optional" value={value ?? ''} onChangeText={onChange} keyboardType="number-pad" />
                )}
              />
              {errors.steps && <Text style={styles.err}>{errors.steps.message}</Text>}
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
        </View>
      )}

      {/* Feeling + Notes */}
      <Text style={styles.label}>Feeling</Text>
      <View style={styles.rowWrap}>
        <Controller
          control={control}
          name="feeling"
          render={({ field: { value, onChange } }) => (
            <>
              {FEELINGS.map((f) => (
                <TChip key={f} label={f} selected={value === f} onPress={() => onChange(f)} />
              ))}
            </>
          )}
        />
      </View>

      <Controller
        control={control}
        name="notes"
        render={({ field: { value, onChange } }) => (
          <TInput placeholder="Notes (optional)" value={value ?? ''} onChangeText={onChange} />
        )}
      />

      <TButton title="Save workout" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />

      {/* Totals */}
      <View style={{ height: 16 }} />
      <Text style={styles.section}>Daily total — {day}</Text>
      <Text style={styles.text}>Duration: {totals.minutes} min • Sessions: {totals.sessions}</Text>
      {totals.distance > 0 && <Text style={styles.text}>Distance: {totals.distance} km</Text>}
      {totals.steps > 0 && <Text style={styles.text}>Steps: {totals.steps}</Text>}

      {/* List */}
      <View style={{ height: 12 }} />
      <Text style={styles.section}>Entries</Text>
      {loadingList ? (
        <ActivityIndicator />
      ) : rows.length === 0 ? (
        <Text style={styles.text}>No entries for this date.</Text>
      ) : (
        rows.map((row, i) => {
          const e = row.payload || ({} as ExercisePayload);
          const time = row.ts
            ? new Date(row.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '—';
          return (
            <View key={row.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {time} — {e.type} — {e.duration_min ?? 0} min
                </Text>
                <Pressable onPress={() => handleDelete(row.id)} hitSlop={8}>
                  <FontAwesome5 name="trash" size={14} color="#ef4444" />
                </Pressable>
              </View>
              {e.distance_km != null && <Text style={styles.text}>Distance: {e.distance_km} km</Text>}
              {e.steps != null && <Text style={styles.text}>Steps: {e.steps}</Text>}
              {e.intensity && <Text style={styles.text}>Intensity: {e.intensity}</Text>}
              {e.feeling && <Text style={styles.text}>Feeling: {e.feeling}</Text>}
              {e.notes ? <Text style={styles.text}>Notes: {e.notes}</Text> : null}
            </View>
          );
        })
      )}

      <View style={{ height: 24 }} />
      
      {/* Extraction Review Drawer */}
      <ExtractionReviewDrawer
        visible={showReviewDrawer}
        extracted={extractedData || {}}
        category="exercise"
        onApply={handleApplyExtractedData}
        onCancel={handleCancelReview}
        onFieldChange={handleFieldChange}
      />
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
