// src/screens/Nutrition.tsx
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
import { supabase } from '../lib/supabase';
import { palette } from '../../lib/tw';

import TInput from '../../components/TInput';
import TButton from '../../components/TButton';
import TDateInput from '../../components/TDateInput';
import TTimeInput from '../../components/TTimeInput';
import AttachmentUpload from '../../components/AttachmentUpload';
import ProcessingBanner from '../../components/ProcessingBanner';
import ExtractionReviewDrawer from '../../components/ExtractionReviewDrawer';

import { todayYMD, nowHM, toUTCISO } from '../lib/datetime';
import { uploadAndProcess } from '../lib/attachments';
import { useAttachmentStatus } from '../hooks/useAttachmentStatus';

import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

type NutritionPayload = {
  ingredients?: string | null;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  feeling?: '🙂' | '😐' | '☹️' | null;
  notes?: string | null;
};

type NutritionRow = {
  id: string;
  ts: string | null;
  payload: NutritionPayload;
};

const numStr = z
  .string()
  .trim()
  .optional()
  .refine((v) => v === undefined || v === '' || !Number.isNaN(Number(v)), 'Must be a number');

const schema = z.object({
  dateYMD: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  timeHM: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
  ingredients: z.string().min(1, 'Please enter ingredients or a title'),
  calories: numStr,
  protein: numStr,
  carbs: numStr,
  fat: numStr,
  notes: z.string().optional(),
  feeling: z.enum(['🙂', '😐', '☹️']).optional(),
});
type FormVals = z.infer<typeof schema>;

export default function Nutrition() {
  const [message, setMessage] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [rows, setRows] = useState<NutritionRow[]>([]);
  
  // Upload state
  const [currentAttachmentId, setCurrentAttachmentId] = useState<string | null>(null);
  const [showReviewDrawer, setShowReviewDrawer] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      dateYMD: todayYMD(),
      timeHM: nowHM(),
      ingredients: '',
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      notes: '',
      feeling: '🙂',
    },
  });

  const day = watch('dateYMD');
  
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

    const { data: u, error: uErr } = await supabase.auth.getUser();
    if (uErr || !u?.user) {
      setMessage('Please sign in again.');
      setLoadingList(false);
      return;
    }

    const { data, error } = await supabase
      .from('entries')
      .select('id, ts, payload')
      .eq('user_id', u.user.id)
      .eq('category', 'nutrition')
      .eq('day', d)
      .order('ts', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoadingList(false);
      return;
    }

    const mapped: NutritionRow[] = (data ?? []).map((r: any) => ({
      id: String(r.id),
      ts: r.ts ?? null,
      payload: (r.payload ?? {}) as NutritionPayload,
    }));

    setRows(mapped);
    setLoadingList(false);
  }

  useEffect(() => {
    loadForDay(day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const e = r.payload || {};
        acc.calories += e.calories ?? 0;
        acc.protein += e.protein_g ?? 0;
        acc.carbs += e.carbs_g ?? 0;
        acc.fat += e.fat_g ?? 0;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [rows]);

  const onSubmit = async (v: FormVals) => {
    try {
      setMessage(null);
      const toNum = (s?: string) => (s && s.trim() !== '' ? Number(s) : null);

      const payload: NutritionPayload = {
        ingredients: v.ingredients.trim(),
        calories: toNum(v.calories),
        protein_g: toNum(v.protein),
        carbs_g: toNum(v.carbs),
        fat_g: toNum(v.fat),
        notes: v.notes?.trim() || null,
        feeling: v.feeling ?? null,
      };

      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) {
        setMessage('Please sign in again.');
        return;
      }

      const tsISO = toUTCISO(v.dateYMD, v.timeHM);

      const { error } = await supabase.from('entries').insert({
        user_id: u.user.id,
        category: 'nutrition',
        day: v.dateYMD,
        ts: tsISO,
        payload,
      });
      if (error) throw error;

      setMessage('Saved!');
      reset({
        ...v,
        timeHM: nowHM(),
        ingredients: '',
        calories: '',
        protein: '',
        carbs: '',
        fat: '',
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
        calories: extractedData.calories?.toString() || '',
        protein: extractedData.protein_g?.toString() || '',
        carbs: extractedData.carbs_g?.toString() || '',
        fat: extractedData.fat_g?.toString() || '',
        notes: extractedData.notes || '',
        // Keep existing values for date/time/feeling
        dateYMD: watch('dateYMD'),
        timeHM: watch('timeHM'),
        feeling: watch('feeling') || '🙂',
        ingredients: watch('ingredients') || ''
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
      <Text style={styles.title}>Nutrition</Text>
      {!!message && <Text style={styles.msg}>{message}</Text>}

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
        category="nutrition"
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

      {/* Ingredients */}
      <Controller
        control={control}
        name="ingredients"
        render={({ field: { value, onChange } }) => (
          <TInput placeholder="Ingredients / title" value={value} onChangeText={onChange} />
        )}
      />
      {errors.ingredients && <Text style={styles.err}>{errors.ingredients.message}</Text>}

      {/* Macros */}
      <View style={styles.row}>
        <Controller
          control={control}
          name="calories"
          render={({ field: { value, onChange } }) => (
            <TInput
              placeholder="Calories"
              value={value ?? ''}
              onChangeText={onChange}
              keyboardType="number-pad"
              style={styles.input}
            />
          )}
        />
        <Controller
          control={control}
          name="protein"
          render={({ field: { value, onChange } }) => (
            <TInput
              placeholder="Protein (g)"
              value={value ?? ''}
              onChangeText={onChange}
              keyboardType="number-pad"
              style={styles.input}
            />
          )}
        />
      </View>
      {(errors.calories || errors.protein) && (
        <Text style={styles.err}>{errors.calories?.message || errors.protein?.message}</Text>
      )}

      <View style={styles.row}>
        <Controller
          control={control}
          name="carbs"
          render={({ field: { value, onChange } }) => (
            <TInput
              placeholder="Carbs (g)"
              value={value ?? ''}
              onChangeText={onChange}
              keyboardType="number-pad"
              style={styles.input}
            />
          )}
        />
        <Controller
          control={control}
          name="fat"
          render={({ field: { value, onChange } }) => (
            <TInput
              placeholder="Fat (g)"
              value={value ?? ''}
              onChangeText={onChange}
              keyboardType="number-pad"
              style={styles.input}
            />
          )}
        />
      </View>
      {(errors.carbs || errors.fat) && (
        <Text style={styles.err}>{errors.carbs?.message || errors.fat?.message}</Text>
      )}

      {/* Notes */}
      <Controller
        control={control}
        name="notes"
        render={({ field: { value, onChange } }) => (
          <TInput
            placeholder="Notes (optional)"
            value={value ?? ''}
            onChangeText={onChange}
            style={[styles.input, { width: '100%' }]}
          />
        )}
      />

      {/* Save */}
      <TButton title="Save entry" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />

      {/* Totals */}
      <View style={{ height: 16 }} />
      <Text style={styles.section}>Daily total — {day}</Text>
      <Text style={styles.text}>Calories: {totals.calories}</Text>
      <Text style={styles.text}>Protein: {totals.protein} g</Text>
      <Text style={styles.text}>Carbs: {totals.carbs} g</Text>
      <Text style={styles.text}>Fat: {totals.fat} g</Text>

      {/* List */}
      <View style={{ height: 12 }} />
      <Text style={styles.section}>Entries</Text>
      {loadingList ? (
        <ActivityIndicator />
      ) : rows.length === 0 ? (
        <Text style={styles.text}>No entries for this date.</Text>
      ) : (
        rows.map((row, i) => {
          const e = row.payload || {};
          const time = row.ts ? new Date(row.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
          return (
            <View key={row.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {time} — {e.ingredients || `Entry ${i + 1}`}
                </Text>
                <Pressable onPress={() => handleDelete(row.id)} hitSlop={8}>
                  <FontAwesome5 name="trash" size={14} color="#ef4444" />
                </Pressable>
              </View>
              {e.calories != null && <Text style={styles.text}>Calories: {e.calories}</Text>}
              {e.protein_g != null && <Text style={styles.text}>Protein: {e.protein_g} g</Text>}
              {e.carbs_g != null && <Text style={styles.text}>Carbs: {e.carbs_g} g</Text>}
              {e.fat_g != null && <Text style={styles.text}>Fat: {e.fat_g} g</Text>}
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
        category="nutrition"
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
  text: { color: palette.text },
  msg: { marginBottom: 10, color: palette.text },
  err: { color: '#ef4444', marginTop: 4 },

  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { flex: 1 }, // layout only; TInput supplies white bg/border

  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontWeight: '700', color: palette.text },
});

