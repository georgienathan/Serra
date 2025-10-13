# Wearable → Manual Entry Integration

## Overview

This feature allows wearable data to automatically populate manual entry forms, so users can see, verify, and edit all datapoints captured by their wearables.

---

## How It Works

### Data Flow

```
1. Wearable Sync
   ↓
2. Data stored in `metrics` table
   ↓
3. User opens Sleep/Exercise screen
   ↓
4. Form fields auto-populate with wearable data
   ↓
5. User edits/adds additional data
   ↓
6. User saves
   ↓
7. Complete entry stored in `entries` table
```

---

## Implementation Details

### Helper Functions (`src/lib/wearable-helpers.ts`)

**Purpose:** Fetch and aggregate wearable metrics for a specific day.

**Functions:**
- `getSleepMetricsForDay(day)` - Returns sleep duration, deep, REM, score, HR, HRV
- `getExerciseMetricsForDay(day)` - Returns workout duration, distance, calories, HR, strain
- `getActivityMetricsForDay(day)` - Returns steps, calories, distance, activity score
- `getRecoveryMetricsForDay(day)` - Returns recovery score, readiness, HRV, resting HR

**Aggregation Strategy:**
- **Cumulative metrics** (steps, calories, distance): **SUM** all values
- **Point-in-time metrics** (heart rate, HRV, scores): **AVERAGE** all values

**Example:**
```typescript
const sleepData = await getSleepMetricsForDay('2025-01-15');
// Returns:
// {
//   duration_min: 450,
//   deep_min: 72,
//   rem_min: 108,
//   sleep_score: 85,
//   resting_hr: 52,
//   hrv: 65
// }
```

---

### Sleep Screen Updates

**New Fields Added:**
- Deep sleep (minutes)
- REM sleep (minutes)
- Sleep score (0-100)
- Resting heart rate (bpm)
- HRV (ms)

**Auto-Population:**
When user selects a day in the calendar, wearable data automatically loads and fills the form fields.

**Manual Override:**
All fields are editable. Users can:
- Verify auto-populated values
- Correct inaccurate data
- Add missing data
- Clear unwanted data

**Data Persistence:**
All data (manual + wearable) is saved to the `entries` table under the `sleep` category with the enhanced `SleepPayload` type.

**UI/UX:**
- Clear section label: "Wearable Data (auto-populated)"
- Helper text: "These fields are automatically filled from your wearables. You can edit them manually."
- Entry cards show wearable data in a separate section with visual divider

---

### Exercise Screen Updates

**New Fields Added:**
- Calories burned
- Average heart rate (bpm)
- Max heart rate (bpm)
- Strain/effort score

**Auto-Population:**
When user selects a day in the calendar, wearable data automatically loads and fills the form fields. Also pre-populates distance if available from wearables.

**Manual Override:**
All fields are editable. Users can:
- Verify auto-populated values
- Correct inaccurate data
- Add missing data (e.g., gym equipment doesn't track HR)
- Clear unwanted data

**Data Persistence:**
All data (manual + wearable) is saved to the `entries` table under the `exercise` category with the enhanced `ExercisePayload` type.

**UI/UX:**
- Clear section label: "Wearable Data (auto-populated)"
- Helper text: "These fields are automatically filled from your wearables. You can edit them manually."
- Entry cards show wearable data in a separate section with visual divider

---

## User Experience

### Example 1: Sleep Entry with Wearable Data

1. **User wears Oura Ring overnight**
   - Oura captures: 7.5h total, 1.2h deep, 1.8h REM, sleep score 85, resting HR 52

2. **App syncs Oura data (automatic every 6 hours)**
   - Data stored in `metrics` table

3. **User opens Sleep screen**
   - Selects today's date
   - Form auto-fills:
     - Deep sleep: 72 min
     - REM sleep: 108 min
     - Sleep score: 85
     - Resting HR: 52 bpm

4. **User adds manual data**
   - Bedtime: 11:00 PM
   - Wake time: 7:30 AM
   - Quality: good
   - Feeling: 🙂
   - Notes: "Slept through the night"

5. **User saves**
   - Complete entry with manual + wearable data saved
   - Displayed in entry list with all details

---

### Example 2: Exercise Entry with Wearable Data

1. **User runs with Strava**
   - Strava captures: 45min, 7.5km, 450 calories, avg HR 165, max HR 182

2. **App syncs Strava data (automatic every 6 hours)**
   - Data stored in `metrics` table

3. **User opens Exercise screen**
   - Selects today's date
   - Form auto-fills:
     - Distance: 7.5 km
     - Calories: 450
     - Avg HR: 165 bpm
     - Max HR: 182 bpm

4. **User adds manual data**
   - Type: run
   - Duration: 45 min
     - Intensity: hard
   - Feeling: 🙂
   - Notes: "Felt strong, good pace"

5. **User saves**
   - Complete entry with manual + wearable data saved
   - Displayed in entry list with all details

---

### Example 3: Manual Override

1. **Wearable syncs incorrect data**
   - WHOOP reports 8.5h sleep, but user woke up multiple times

2. **User opens Sleep screen**
   - Fields auto-populate with wearable data
   - User sees duration pre-filled with 510 min

3. **User corrects the data**
   - Manually adjusts duration to 6.5h
   - Changes quality to "poor"
   - Adds notes: "Woke up 3 times during the night"

4. **User saves**
   - Corrected data saved
   - User's manual input overrides wearable data

---

## Benefits

✅ **Complete Data Capture**
- All possible datapoints from wearables are now manually accessible
- Users can add data that wearables missed
- Users can correct inaccurate wearable data

✅ **Single Source of Truth**
- All data (manual + wearable) stored in `entries` table
- No data duplication or conflicts
- Easy to query and display

✅ **User Control**
- Users verify auto-populated data
- Users can override any value
- Users decide what to keep and what to change

✅ **Better Insights**
- Richer entries with more metrics
- More accurate tracking
- Better foundation for AI recommendations

✅ **Flexible Workflow**
- Works with or without wearables
- Works with partial wearable data
- Works with multiple wearables (data aggregated)

---

## Technical Implementation

### Schema Extensions

**Sleep Payload:**
```typescript
type SleepPayload = {
  bedtime: string;
  wake_time: string;
  duration_min: number;
  quality?: Quality | null;
  feeling?: Feeling | null;
  notes?: string | null;
  // NEW: Wearable metrics
  deep_min?: number | null;
  rem_min?: number | null;
  sleep_score?: number | null;
  resting_hr?: number | null;
  hrv?: number | null;
};
```

**Exercise Payload:**
```typescript
type ExercisePayload = {
  type: ExerciseType;
  duration_min: number;
  distance_km?: number | null;
  steps?: number | null;
  intensity?: Intensity | null;
  feeling?: Feeling | null;
  notes?: string | null;
  // NEW: Wearable metrics
  calories?: number | null;
  avg_hr?: number | null;
  max_hr?: number | null;
  strain?: number | null;
};
```

### Data Loading

**Sleep Screen:**
```typescript
const wearableData = await getSleepMetricsForDay(selectedDay);
if (wearableData.duration_min > 0) {
  setValue('deep_min', wearableData.deep_min);
  setValue('rem_min', wearableData.rem_min);
  setValue('sleep_score', wearableData.sleep_score);
  setValue('resting_hr', wearableData.resting_hr);
  setValue('hrv', wearableData.hrv);
}
```

**Exercise Screen:**
```typescript
const wearableData = await getExerciseMetricsForDay(selectedDay);
if (wearableData.calories > 0) {
  setValue('calories', wearableData.calories.toString());
  setValue('avg_hr', Math.round(wearableData.avg_hr).toString());
  setValue('max_hr', Math.round(wearableData.max_hr).toString());
  setValue('strain', wearableData.strain.toFixed(1));
  setValue('distance_km', wearableData.distance_km.toFixed(2));
}
```

---

## Future Enhancements

### Nutrition Integration (Not Yet Implemented)
- Auto-populate calories from activity trackers
- Auto-populate meal times from health apps
- Auto-populate macros from connected apps

### Period Integration (Not Yet Implemented)
- Auto-populate cycle data from period tracking apps
- Auto-populate symptoms from health apps
- Auto-populate temperature from wearables

### Conflict Resolution
- If multiple wearables provide same metric, show all values
- Let user choose which source to trust
- Mark preferred sources for automatic selection

### Data Quality Indicators
- Show confidence score for auto-populated data
- Highlight unusual values
- Suggest corrections based on historical patterns

### Batch Import
- Import historical data from wearables
- Bulk-create entries for past days
- Preserve user annotations and manual overrides

---

## Summary

✅ **All wearable datapoints are now manually accessible**
✅ **Auto-population saves time and reduces errors**
✅ **Users maintain full control over their data**
✅ **Single source of truth in `entries` table**
✅ **Seamless integration with existing workflows**

**Result:** Users can now verify, edit, and save every metric their wearables capture, creating richer, more accurate entries that serve as the foundation for AI-powered insights and recommendations.

