// at top
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import StatCard from '../../components/StatCard';
import AICoachCard from '../../components/AICoachCard';
import { palette } from '../../lib/tw';

// tiny helper
function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Dashboard() {
  const nav = useNavigation<any>();
  const [sleepMin, setSleepMin] = useState<number>(0);
  const [hasPeriod, setHasPeriod] = useState<boolean>(false);
  const [nutritionCount, setNutritionCount] = useState<number>(0);
  const [exerciseCount, setExerciseCount] = useState<number>(0);
  const day = todayYMD();

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return;

      // sum today's sleep minutes
      const { data: sleepRows } = await supabase
        .from('entries')
        .select('payload')
        .eq('user_id', u.user.id)
        .eq('category', 'sleep')
        .eq('day', day);

      const total = (sleepRows ?? []).reduce((acc: number, r: any) => acc + (r.payload?.duration_min ?? 0), 0);
      setSleepMin(total);

      // did we log period today?
      const { data: periodRows } = await supabase
        .from('entries')
        .select('id')
        .eq('user_id', u.user.id)
        .eq('category', 'period')
        .eq('day', day)
        .limit(1);
      setHasPeriod((periodRows ?? []).length > 0);

      // count today's nutrition entries
      const { data: nutritionRows } = await supabase
        .from('entries')
        .select('id')
        .eq('user_id', u.user.id)
        .eq('category', 'nutrition')
        .eq('day', day);
      setNutritionCount((nutritionRows ?? []).length);

      // count today's exercise entries
      const { data: exerciseRows } = await supabase
        .from('entries')
        .select('id')
        .eq('user_id', u.user.id)
        .eq('category', 'exercise')
        .eq('day', day);
      setExerciseCount((exerciseRows ?? []).length);
    })();
  }, [day]);

  return (
    <View style={{ padding: 16, gap: 12 }}>
      {/* AI Coach Card */}
      <AICoachCard />

      {/* Cycle → Period subtab */}
      <StatCard
        title="Period"
        value={hasPeriod ? 'Logged' : 'Not logged'}
        accentColor={palette.accent} // your pink
        icon={<FontAwesome5 name="tint" size={16} color="white" />}
        onPress={() => nav.navigate('Cycle', { tab: 'period' })}
      />

      {/* Cycle → Sleep subtab */}
      <StatCard
        title="Sleep"
        value={`${(sleepMin / 60).toFixed(1)} h today`}
        accentColor={palette.accent} // same family as cycle
        icon={<FontAwesome5 name="moon" size={16} color="white" />}
        onPress={() => nav.navigate('Cycle', { tab: 'sleep' })}
      />

      {/* Nutrition */}
      <StatCard
        title="Nutrition"
        value={`${nutritionCount} ${nutritionCount === 1 ? 'entry' : 'entries'} today`}
        accentColor={palette.green}
        icon={<FontAwesome5 name="apple-alt" size={16} color="white" />}
        onPress={() => nav.navigate('Nutrition')}
      />

      {/* Exercise */}
      <StatCard
        title="Exercise"
        value={`${exerciseCount} ${exerciseCount === 1 ? 'session' : 'sessions'} today`}
        accentColor={palette.teal}
        icon={<FontAwesome5 name="dumbbell" size={16} color="white" />}
        onPress={() => nav.navigate('Exercise')}
      />
    </View>
  );
}
