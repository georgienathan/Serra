// components/DashboardCalendar.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { supabase } from '../src/lib/supabase';

type Category = 'nutrition' | 'exercise' | 'cycle' | 'sleep';

type EntryRow = {
  day: string;          // 'YYYY-MM-DD'
  category: Category;
  payload: any;
};

const DOTS: Record<Category, { key: Category; color: string }> = {
  nutrition: { key: 'nutrition', color: '#82c68a' }, // primary (green)
  exercise:  { key: 'exercise',  color: '#53c0b4' }, // secondary (teal)
  cycle:     { key: 'cycle',     color: '#f7a1b2' }, // accent (pink)
  sleep:     { key: 'sleep',     color: '#6b7280' }, // gray
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DashboardCalendar() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Load ~60 days around today to keep it snappy
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
      const today = new Date();
      const start = ymd(addDays(today, -45));
      const end   = ymd(addDays(today, +45));

      const { data, error } = await supabase
        .from('entries')
        .select('day, category, payload')
        .eq('user_id', u.user.id)
        .gte('day', start)
        .lte('day', end);

      if (error) setMessage(error.message);
      setRows((data ?? []) as EntryRow[]);
      setLoading(false);
    })();
  }, []);

  // Build markedDates for the calendar
  const markedDates = useMemo(() => {
    const map: Record<string, { dots: { key: string; color: string }[]; selected?: boolean }> = {};
    for (const r of rows) {
      map[r.day] ??= { dots: [] };
      const dot = DOTS[r.category];
      if (dot && !map[r.day].dots.find(d => d.key === dot.key)) {
        map[r.day].dots.push(dot);
      }
    }
    if (selected) {
      map[selected] ??= { dots: [] };
      map[selected].selected = true;
    }
    return map;
  }, [rows, selected]);

  // Simple totals for the selected day (nutrition only for now)
  const totals = useMemo(() => {
    if (!selected) return { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
    const items = rows.filter(r => r.day === selected);
    const nutri = items
      .filter(r => r.category === 'nutrition')
      .map(r => r.payload || {});
    const sum = nutri.reduce(
      (acc: any, p: any) => {
        acc.calories += p.calories ?? 0;
        acc.protein  += p.protein_g ?? 0;
        acc.carbs    += p.carbs_g ?? 0;
        acc.fat      += p.fat_g ?? 0;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    return { ...sum, count: items.length };
  }, [rows, selected]);

  function onDayPress(d: any) {
    setSelected(d.dateString); // 'YYYY-MM-DD'
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading calendar…</Text>
      </View>
    );
  }

  return (
    <View>
      {!!message && <Text style={{ marginBottom: 8 }}>{message}</Text>}
      <Calendar
        markingType="multi-dot"
        markedDates={markedDates}
        onDayPress={onDayPress}
      />
      {selected && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.summaryTitle}>Summary — {selected}</Text>
          <Text>Entries: {totals.count}</Text>
          <Text>Nutrition: {totals.calories} kcal</Text>
          <Text>Macros: P {totals.protein}g • C {totals.carbs}g • F {totals.fat}g</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  summaryTitle: { fontWeight: '700', marginBottom: 4 },
});
