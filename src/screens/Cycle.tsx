// src/screens/Cycle.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';

import { palette } from '../../lib/tw';
import Sleep from './Sleep';

import { supabase } from '../lib/supabase';
import { todayYMD, nowHM, toUTCISO } from '../lib/datetime';

import TInput from '../../components/TInput';
import TButton from '../../components/TButton';
import TDateInput from '../../components/TDateInput';
import TChip from '../../components/TChip';
import DayCalendar from '../../components/DayCalendar';
import AttachmentUpload from '../../components/AttachmentUpload';
import ProcessingBanner from '../../components/ProcessingBanner';

import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { uploadAndProcess } from '../lib/attachments';
import { useAttachmentStatus } from '../hooks/useAttachmentStatus';

/* --------------------------- constants / types --------------------------- */
type TabKey = 'period' | 'sleep';

const BLEED_AMOUNTS = ['none', 'light', 'medium', 'heavy'] as const;
type BleedAmount = typeof BLEED_AMOUNTS[number];

const SEX_TYPES = ['protected', 'unprotected', 'none'] as const;
type SexType = typeof SEX_TYPES[number];

const OVU = ['positive', 'negative', 'none'] as const;
type Ovulation = typeof OVU[number];

const MUCUS_AMT = ['low', 'medium', 'high'] as const;
const MUCUS_CONS = ['watery', 'creamy', 'eggwhite', 'sticky', 'unknown'] as const;

const DRIVE = ['low', 'medium', 'high'] as const;
const FEEL = ['🙂', '😐', '☹️'] as const;

const SYMPTOMS = [
  'cramps',
  'backache',
  'sore_breasts',
  'ovulation_pain',
  'headache',
  'nausea',
  'diarrhea',
  'constipation',
  'bloating',
  'cravings',
  'other',
] as const;

const periodSchema = z.object({
  dateYMD: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bleed: z.enum(BLEED_AMOUNTS),
  spotting: z.boolean().optional(),
  sex: z.enum(SEX_TYPES),
  ovulation: z.enum(OVU),
  mucusAmount: z.enum(MUCUS_AMT).optional(),
  mucusConsistency: z.enum(MUCUS_CONS).optional(),
  sexDrive: z.enum(DRIVE).optional(),
  feeling: z.enum(FEEL).optional(),
  symptoms: z.array(z.enum(SYMPTOMS)).optional(),
  notes: z.string().optional(),
});
type PeriodVals = z.infer<typeof periodSchema>;

type PeriodPayload = {
  bleed: BleedAmount;
  spotting?: boolean | null;
  sex: SexType;
  ovulation: Ovulation;
  mucusAmount?: typeof MUCUS_AMT[number] | null;
  mucusConsistency?: typeof MUCUS_CONS[number] | null;
  sexDrive?: typeof DRIVE[number] | null;
  feeling?: typeof FEEL[number] | null;
  symptoms?: typeof SYMPTOMS[number][] | null;
  notes?: string | null;
};

type PeriodRow = { id: string; ts: string | null; payload: PeriodPayload };

/* ------------------------------ main screen ------------------------------ */

export default function Cycle() {
  const [tab, setTab] = useState<TabKey>('period');
  const route = useRoute<any>();

  // allow: navigation.navigate('Cycle', { tab: 'sleep' })
  useEffect(() => {
    if (route.params?.tab === 'sleep') setTab('sleep');
  }, [route.params]);

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: palette.background }}>
      <View style={styles.side}>
        <NavItem label="Period" selected={tab === 'period'} onPress={() => setTab('period')} />
        <NavItem label="Sleep"  selected={tab === 'sleep'}  onPress={() => setTab('sleep')}  />
      </View>
      <View style={styles.content}>
        {tab === 'period' ? <PeriodScreen /> : <Sleep />}
      </View>
    </View>
  );
}

function NavItem({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.item, selected && styles.itemSel]}>
      <Text style={[styles.itemText, selected && styles.itemTextSel]}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------- Period tab ------------------------------ */

function PeriodScreen() {
  const [currentAttachmentId, setCurrentAttachmentId] = useState<string | null>(null);
  const attachmentStatus = useAttachmentStatus(currentAttachmentId);
  
  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PeriodVals>({
    resolver: zodResolver(periodSchema),
    defaultValues: {
      dateYMD: todayYMD(),
      bleed: 'none',
      spotting: false,
      sex: 'none',
      ovulation: 'none',
      mucusAmount: 'low',
      mucusConsistency: 'unknown',
      sexDrive: 'medium',
      feeling: '🙂',
      symptoms: [],
      notes: '',
    },
  });

  const day = watch('dateYMD');
  const [rows, setRows] = useState<PeriodRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);

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
      .eq('category', 'period')
      .eq('day', d)
      .order('ts', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoadingList(false);
      return;
    }

    const mapped: PeriodRow[] = (data ?? []).map((r: any) => ({
      id: String(r.id),
      ts: r.ts ?? null,
      payload: (r.payload ?? {}) as PeriodPayload,
    }));
    setRows(mapped);
    setLoadingList(false);
  }

  useEffect(() => {
    loadForDay(day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

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

  const onSubmit = async (v: PeriodVals) => {
    try {
      setMessage(null);

      const payload: PeriodPayload = {
        bleed: v.bleed,
        spotting: !!v.spotting,
        sex: v.sex,
        ovulation: v.ovulation,
        mucusAmount: v.mucusAmount ?? null,
        mucusConsistency: v.mucusConsistency ?? null,
        sexDrive: v.sexDrive ?? null,
        feeling: v.feeling ?? null,
        symptoms: (v.symptoms ?? []).length ? v.symptoms : null,
        notes: v.notes?.trim() || null,
      };

      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) {
        setMessage('Please sign in again.');
        return;
      }

      const tsISO = toUTCISO(v.dateYMD, nowHM());

      const { error } = await supabase.from('entries').insert({
        user_id: u.user.id,
        category: 'period',
        day: v.dateYMD,
        ts: tsISO,
        payload,
      });
      if (error) throw error;

      setMessage('Saved!');
      reset({ ...v, notes: '' });
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

  return (
    <ScrollView contentContainerStyle={{ padding: 12 }}>
      <Text style={styles.title}>PERIOD</Text>
      {!!message && <Text style={styles.msg}>{message}</Text>}

      {/* Upload Photo or Voice Note */}
      <AttachmentUpload 
        category="period"
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

      {/* Date */}
      <Controller
        control={control}
        name="dateYMD"
        render={({ field: { value, onChange } }) => (
          <TDateInput label="Date" value={value} onChange={onChange} />
        )}
      />
      {errors.dateYMD && <Text style={styles.err}>{errors.dateYMD.message}</Text>}

      {/* Bleeding */}
      <Text style={styles.label}>Bleeding amount</Text>
      <View style={styles.rowWrap}>
        <Controller
          control={control}
          name="bleed"
          render={({ field: { value, onChange } }) => (
            <>
              {BLEED_AMOUNTS.map((b) => (
                <TChip key={b} label={b} selected={value === b} onPress={() => onChange(b)} />
              ))}
            </>
          )}
        />
      </View>

      {/* Spotting toggle */}
      <Text style={styles.label}>Spotting</Text>
      <View style={styles.rowWrap}>
        <Controller
          control={control}
          name="spotting"
          render={({ field: { value, onChange } }) => (
            <>
              <TChip label="No" selected={!value} onPress={() => onChange(false)} />
              <TChip label="Yes" selected={!!value} onPress={() => onChange(true)} />
            </>
          )}
        />
      </View>

      {/* Sex */}
      <Text style={styles.label}>Vaginal sex</Text>
      <View style={styles.rowWrap}>
        <Controller
          control={control}
          name="sex"
          render={({ field: { value, onChange } }) => (
            <>
              {SEX_TYPES.map((s) => (
                <TChip key={s} label={s} selected={value === s} onPress={() => onChange(s)} />
              ))}
            </>
          )}
        />
      </View>

      {/* Ovulation test */}
      <Text style={styles.label}>Ovulation test</Text>
      <View style={styles.rowWrap}>
        <Controller
          control={control}
          name="ovulation"
          render={({ field: { value, onChange } }) => (
            <>
              {OVU.map((o) => (
                <TChip key={o} label={o} selected={value === o} onPress={() => onChange(o)} />
              ))}
            </>
          )}
        />
      </View>

      {/* Cervical mucus */}
      <Text style={styles.label}>Cervical mucus</Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.subLabel}>Amount</Text>
          <View style={styles.rowWrap}>
            <Controller
              control={control}
              name="mucusAmount"
              render={({ field: { value, onChange } }) => (
                <>
                  {MUCUS_AMT.map((m) => (
                    <TChip key={m} label={m} selected={value === m} onPress={() => onChange(m)} />
                  ))}
                </>
              )}
            />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.subLabel}>Consistency</Text>
          <View style={styles.rowWrap}>
            <Controller
              control={control}
              name="mucusConsistency"
              render={({ field: { value, onChange } }) => (
                <>
                  {MUCUS_CONS.map((m) => (
                    <TChip key={m} label={m} selected={value === m} onPress={() => onChange(m)} />
                  ))}
                </>
              )}
            />
          </View>
        </View>
      </View>

      {/* Sex drive */}
      <Text style={styles.label}>Sex drive</Text>
      <View style={styles.rowWrap}>
        <Controller
          control={control}
          name="sexDrive"
          render={({ field: { value, onChange } }) => (
            <>
              {DRIVE.map((d) => (
                <TChip key={d} label={d} selected={value === d} onPress={() => onChange(d)} />
              ))}
            </>
          )}
        />
      </View>

      {/* Feeling */}
      <Text style={styles.label}>I'm feeling…</Text>
      <View style={styles.rowWrap}>
        <Controller
          control={control}
          name="feeling"
          render={({ field: { value, onChange } }) => (
            <>
              {FEEL.map((f) => (
                <TChip key={f} label={f} selected={value === f} onPress={() => onChange(f)} />
              ))}
            </>
          )}
        />
      </View>

      {/* Symptoms (multi-select) */}
      <Text style={styles.label}>Pain & symptoms</Text>
      <View style={styles.rowWrap}>
        <Controller
          control={control}
          name="symptoms"
          render={({ field: { value = [], onChange } }) => (
            <>
              {SYMPTOMS.map((s) => {
                const on = value.includes(s);
                return (
                  <TChip
                    key={s}
                    label={s.replace('_', ' ')}
                    selected={on}
                    onPress={() =>
                      on ? onChange(value.filter((v) => v !== s)) : onChange([...value, s])
                    }
                  />
                );
              })}
            </>
          )}
        />
      </View>

      {/* Notes */}
      <Controller
        control={control}
        name="notes"
        render={({ field: { value, onChange } }) => (
          <TInput placeholder="Notes (optional)" value={value ?? ''} onChangeText={onChange} />
        )}
      />

      {/* Save */}
      <TButton title="Save period entry" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />

      {/* Entries list */}
      <View style={{ height: 16 }} />
      <Text style={styles.section}>Entries — {day}</Text>
      <PeriodList day={day} rows={rows} onDelete={handleDelete} loading={loadingList} />
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function PeriodList({
  day,
  rows,
  onDelete,
  loading,
}: {
  day: string;
  rows: PeriodRow[];
  onDelete: (id: string) => void;
  loading: boolean;
}) {
  if (loading) return <ActivityIndicator />;
  if (rows.length === 0) return <Text style={styles.text}>No entries for this date.</Text>;
  return (
    <>
      {rows.map((row) => {
        const p = row.payload;
        const time = row.ts
          ? new Date(row.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '—';
        return (
          <View key={row.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                {time} — bleed: {p.bleed}
                {p.spotting ? ' (spotting)' : ''}
                {p.sex !== 'none' ? ` • sex: ${p.sex}` : ''}
                {p.ovulation !== 'none' ? ` • ovulation: ${p.ovulation}` : ''}
              </Text>
              <Pressable onPress={() => onDelete(row.id)} hitSlop={8}>
                <FontAwesome5 name="trash" size={14} color="#ef4444" />
              </Pressable>
            </View>
            {p.mucusAmount && p.mucusConsistency && (
              <Text style={styles.text}>
                Mucus: {p.mucusAmount} / {p.mucusConsistency}
              </Text>
            )}
            {p.sexDrive && <Text style={styles.text}>Sex drive: {p.sexDrive}</Text>}
            {p.feeling && <Text style={styles.text}>Feeling: {p.feeling}</Text>}
            {p.symptoms?.length ? (
              <Text style={styles.text}>Symptoms: {p.symptoms.join(', ')}</Text>
            ) : null}
            {p.notes ? <Text style={styles.text}>Notes: {p.notes}</Text> : null}
          </View>
        );
      })}
    </>
  );
}

/* ---------------------------------- styles -------------------------------- */
const styles = StyleSheet.create({
  side: {
    width: 120,
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 8,
    borderRightWidth: 1,
    borderColor: '#e5e7eb22',
  },
  content: { flex: 1, padding: 12 },

  item: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  itemSel: { backgroundColor: '#3ccbc5' },
  itemText: { color: palette.text },
  itemTextSel: { color: '#fff', fontWeight: '700' },

  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: palette.text },
  section: { fontSize: 18, fontWeight: '600', marginBottom: 6, color: palette.text },
  label: { marginTop: 8, marginBottom: 6, fontWeight: '600', color: palette.text },
  subLabel: { color: palette.text, marginBottom: 4 },
  text: { color: palette.text },
  msg: { marginBottom: 10, color: palette.text },
  err: { color: '#ef4444', marginTop: 4 },

  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle: { fontWeight: '700', color: palette.text },
});
