// components/DayCalendar.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { supabase } from '../src/lib/supabase';
import { palette } from '../lib/tw';

type DayCalendarProps = {
  selectedDay: string; // YYYY-MM-DD
  onSelect: (day: string) => void;
  categories?: ('nutrition' | 'exercise' | 'period' | 'sleep')[];
};

interface MarkedDates {
  [key: string]: {
    dots?: Array<{ key: string; color: string }>;
    selected?: boolean;
    selectedColor?: string;
  };
}

export default function DayCalendar({ 
  selectedDay, 
  onSelect, 
  categories = ['nutrition', 'exercise', 'period', 'sleep'] 
}: DayCalendarProps) {
  const [marks, setMarks] = useState<MarkedDates>({});

  useEffect(() => {
    loadCalendarMarks();
  }, [categories]);

  async function loadCalendarMarks() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get last 60 days of entries
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);

    const { data: entries } = await supabase
      .from('entries')
      .select('day, category')
      .eq('user_id', user.id)
      .in('category', categories)
      .gte('day', startDate.toISOString().split('T')[0])
      .lte('day', endDate.toISOString().split('T')[0]);

    // Build marks object
    const newMarks: MarkedDates = {};
    
    entries?.forEach(entry => {
      const day = entry.day;
      if (!newMarks[day]) {
        newMarks[day] = { dots: [] };
      }
      
      const color = getCategoryColor(entry.category);
      // Only add dot if this category doesn't already have one for this day
      if (!newMarks[day].dots?.find((d) => d.key === entry.category)) {
        newMarks[day].dots?.push({ key: entry.category, color });
      }
    });

    setMarks(newMarks);
  }

  function getCategoryColor(category: string): string {
    switch (category) {
      case 'nutrition':
        return palette.green;
      case 'exercise':
        return palette.teal;
      case 'period':
      case 'sleep':
        return palette.accent;
      default:
        return '#6b7280';
    }
  }

  function handleDayPress(day: DateData) {
    onSelect(day.dateString);
  }

  // Combine marks with selected state
  const markedDates: MarkedDates = {
    ...marks,
    [selectedDay]: {
      ...marks[selectedDay],
      selected: true,
      selectedColor: palette.accent
    }
  };

  return (
    <View style={styles.container}>
      <Calendar
        current={selectedDay}
        onDayPress={handleDayPress}
        markingType="multi-dot"
        markedDates={markedDates}
        theme={{
          backgroundColor: palette.background,
          calendarBackground: palette.background,
          textSectionTitleColor: palette.text,
          selectedDayBackgroundColor: palette.accent,
          selectedDayTextColor: '#fff',
          todayTextColor: palette.accent,
          dayTextColor: palette.text,
          textDisabledColor: '#666',
          dotColor: palette.accent,
          selectedDotColor: '#fff',
          arrowColor: palette.text,
          monthTextColor: palette.text,
          indicatorColor: palette.accent,
          textDayFontWeight: '300',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: '300',
          textDayFontSize: 16,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 13
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: palette.background,
  }
});
