// supabase/functions/recommendations/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecommendationRequest {
  user_id: string;
  day: string; // YYYY-MM-DD
}

interface AggregatedData {
  sleep: {
    totalHours: number;
    avgQuality: string;
    entries: number;
  };
  nutrition: {
    totalCalories: number;
    avgProtein: number;
    avgCarbs: number;
    avgFat: number;
    entries: number;
  };
  exercise: {
    totalMinutes: number;
    totalDistance: number;
    types: string[];
    entries: number;
  };
  period: {
    hasPeriod: boolean;
    bleedDays: number;
    lastBleed: string | null;
  };
}

interface RecommendationResponse {
  markdown: string;
  scores: {
    readiness: number; // 1-5
  };
  aggregated: AggregatedData;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id, day }: RecommendationRequest = await req.json();
    
    if (!user_id || !day) {
      throw new Error('user_id and day are required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get last 7 days of data
    const endDate = new Date(day);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    const { data: entries, error } = await supabase
      .from('entries')
      .select('*')
      .eq('user_id', user_id)
      .gte('day', startDate.toISOString().split('T')[0])
      .lte('day', endDate.toISOString().split('T')[0]);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Aggregate data
    const aggregated = aggregateEntries(entries || []);
    
    // Generate recommendations
    const recommendations = await generateRecommendations(aggregated);
    
    const response: RecommendationResponse = {
      markdown: recommendations.markdown,
      scores: recommendations.scores,
      aggregated
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Recommendations error:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function aggregateEntries(entries: any[]): AggregatedData {
  const aggregated: AggregatedData = {
    sleep: { totalHours: 0, avgQuality: 'ok', entries: 0 },
    nutrition: { totalCalories: 0, avgProtein: 0, avgCarbs: 0, avgFat: 0, entries: 0 },
    exercise: { totalMinutes: 0, totalDistance: 0, types: [], entries: 0 },
    period: { hasPeriod: false, bleedDays: 0, lastBleed: null }
  };

  const sleepQualities: string[] = [];
  const exerciseTypes: Set<string> = new Set();

  entries.forEach(entry => {
    const payload = entry.payload;

    switch (entry.category) {
      case 'sleep':
        if (payload.bedtime && payload.wake_time) {
          const hours = calculateSleepHours(payload.bedtime, payload.wake_time);
          aggregated.sleep.totalHours += hours;
          aggregated.sleep.entries++;
          if (payload.quality) {
            sleepQualities.push(payload.quality);
          }
        }
        break;

      case 'nutrition':
        aggregated.nutrition.totalCalories += payload.calories || 0;
        aggregated.nutrition.avgProtein += payload.protein_g || 0;
        aggregated.nutrition.avgCarbs += payload.carbs_g || 0;
        aggregated.nutrition.avgFat += payload.fat_g || 0;
        aggregated.nutrition.entries++;
        break;

      case 'exercise':
        aggregated.exercise.totalMinutes += payload.duration_min || 0;
        aggregated.exercise.totalDistance += payload.distance_km || 0;
        aggregated.exercise.entries++;
        if (payload.type) {
          exerciseTypes.add(payload.type);
        }
        break;

      case 'period':
        if (payload.bleed && payload.bleed !== 'none') {
          aggregated.period.hasPeriod = true;
          aggregated.period.bleedDays++;
          if (!aggregated.period.lastBleed || entry.day > aggregated.period.lastBleed) {
            aggregated.period.lastBleed = entry.day;
          }
        }
        break;
    }
  });

  // Calculate averages
  if (aggregated.sleep.entries > 0) {
    aggregated.sleep.avgQuality = getMostCommon(sleepQualities) || 'ok';
  }
  
  if (aggregated.nutrition.entries > 0) {
    aggregated.nutrition.avgProtein = Math.round(aggregated.nutrition.avgProtein / aggregated.nutrition.entries);
    aggregated.nutrition.avgCarbs = Math.round(aggregated.nutrition.avgCarbs / aggregated.nutrition.entries);
    aggregated.nutrition.avgFat = Math.round(aggregated.nutrition.avgFat / aggregated.nutrition.entries);
  }

  aggregated.exercise.types = Array.from(exerciseTypes);

  return aggregated;
}

function calculateSleepHours(bedtime: string, waketime: string): number {
  // Simple calculation - assumes bedtime is previous day if after midnight
  const [bedH, bedM] = bedtime.split(':').map(Number);
  const [wakeH, wakeM] = waketime.split(':').map(Number);
  
  let hours = wakeH - bedH;
  if (hours < 0) hours += 24;
  
  const minutes = wakeM - bedM;
  return hours + minutes / 60;
}

function getMostCommon(arr: string[]): string | null {
  if (arr.length === 0) return null;
  
  const counts: Record<string, number> = {};
  arr.forEach(item => {
    counts[item] = (counts[item] || 0) + 1;
  });
  
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

async function generateRecommendations(data: AggregatedData): Promise<{ markdown: string; scores: { readiness: number } }> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiKey) {
    // Return mock recommendations for development
    return generateMockRecommendations(data);
  }
  
  try {
    // TODO: Implement actual OpenAI GPT-4 call
    // const response = await fetch('https://api.openai.com/v1/chat/completions', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${openaiKey}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     model: 'gpt-4',
    //     messages: [
    //       {
    //         role: 'system',
    //         content: 'You are a health and fitness coach...'
    //       },
    //       {
    //         role: 'user',
    //         content: JSON.stringify(data)
    //       }
    //     ]
    //   })
    // });
    
    // For now, return mock data
    return generateMockRecommendations(data);
    
  } catch (error) {
    console.error('OpenAI error:', error);
    return generateMockRecommendations(data);
  }
}

function generateMockRecommendations(data: AggregatedData): { markdown: string; scores: { readiness: number } } {
  const avgSleepHours = data.sleep.entries > 0 ? data.sleep.totalHours / data.sleep.entries : 0;
  const avgCalories = data.nutrition.entries > 0 ? data.nutrition.totalCalories / data.nutrition.entries : 0;
  const totalExercise = data.exercise.totalMinutes;

  // Calculate readiness score (1-5)
  let readiness = 3; // Default
  if (avgSleepHours >= 7 && avgSleepHours <= 9) readiness++;
  if (avgSleepHours < 6 || avgSleepHours > 10) readiness--;
  if (totalExercise >= 150) readiness++; // WHO recommends 150 min/week
  if (totalExercise < 60) readiness--;
  readiness = Math.max(1, Math.min(5, readiness)); // Clamp 1-5

  const markdown = `## 🌟 AI Coach Insights

**Your Week at a Glance:**

### 😴 Sleep
- Average: **${avgSleepHours.toFixed(1)} hours/night** (${data.sleep.entries} entries)
- Quality: **${data.sleep.avgQuality}**
${avgSleepHours < 7 ? '⚠️ Try to get 7-9 hours for optimal recovery.' : avgSleepHours > 9 ? '💤 You might be oversleeping - aim for 7-9 hours.' : '✅ Great sleep duration!'}

### 🍎 Nutrition
- Daily calories: **${Math.round(avgCalories)}** (${data.nutrition.entries} entries)
- Protein: **${data.nutrition.avgProtein}g** | Carbs: **${data.nutrition.avgCarbs}g** | Fat: **${data.nutrition.avgFat}g**
${data.nutrition.avgProtein < 50 ? '⚠️ Consider increasing protein intake for muscle recovery.' : '✅ Solid protein intake!'}

### 💪 Exercise
- Total: **${totalExercise} minutes** (${data.exercise.entries} sessions)
- Activities: ${data.exercise.types.length > 0 ? data.exercise.types.join(', ') : 'none logged'}
${totalExercise < 150 ? '⚠️ WHO recommends 150 min/week of moderate activity.' : '✅ Crushing your activity goals!'}

${data.period.hasPeriod ? `### 🌸 Cycle\n- Period detected (${data.period.bleedDays} days logged)\n- Remember to adjust training intensity if needed.\n\n` : ''}

**Recommendation:**
${readiness >= 4 ? 'Your body is well-rested and fueled. Great time for intense training!' : readiness >= 3 ? 'You\'re doing well. Keep up the consistency and listen to your body.' : 'Consider prioritizing recovery - sleep, nutrition, and lighter activity.'}

---
*AI-powered insights based on your last 7 days of data*`;

  return {
    markdown,
    scores: { readiness }
  };
}
