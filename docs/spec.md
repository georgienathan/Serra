# SerraActive – Mini Spec

## Goals
- Bottom tabs: Dashboard, About, Cycle, Nutrition, Exercise.
- Cycle has **vertical subtabs**: Period, Sleep.
- Forms use `react-hook-form + zod`. White inputs, pink primary buttons.
- Data saved to Supabase single table `entries`:
  { id, user_id, category, day(YYYY-MM-DD), ts(ISO), payload JSONB, created_at }.
- Categories: `period | sleep | nutrition | exercise`.

## Design tokens
- palette.background: #130826 (dark purple)
- palette.text:       #ffffff
- palette.accent:     #f2a1b5  (pink – Cycle/Period/Sleep actions)
- palette.green:      #7ccf9c   (Nutrition accent)
- palette.teal:       #3ccbc5   (Exercise accent)

## UI atoms
- `TInput` (white TextInput, rounded 12, padding 12)
- `TButton` (solid pink, rounded 12, loading state)
- `TChip` (toggle pill)
- `TDateInput` (`YYYY-MM-DD`), `TTimeInput` (`HH:MM`)

## Screens – acceptance criteria
- **Dashboard**: cards show today preview; tap → navigate to tab/subtab.
- **Cycle/Period**: fields per Figma (bleeding, spotting, sex, ovulation, mucus amount+consistency, sex drive, feeling, symptoms multi-select, notes). Save to `entries(category='period')`. List+delete today entries.
- **Cycle/Sleep**: wake date, bedtime HH:MM, wake HH:MM, auto `duration_min` across midnight, quality(poor|ok|good), feeling(🙂|😐|☹️), notes. Save with `ts = wake ISO`. List+delete + show today total hours.
- **Nutrition**: calories, protein_g, carbs_g, fat_g (optional), notes. Today totals, list+delete.
- **Exercise**: type select (walk, run, cycle, strength, yoga, pilates, swim, crossfit, hyrox, horse_riding, other). Conditional fields (cardio: distance_km, duration_min; strength: sets, reps, weight_kg), intensity(easy|moderate|hard), feeling, notes. No calories. List+delete.

## Tech
- Expo (TS). React Navigation bottom tabs.
- Supabase client from `app.config.(ts|js)` → `extra.supabaseUrl / supabaseAnonKey`.
- FontAwesome5 icons: `tint` (Period), `moon` (Sleep), `utensils` (Nutrition), `dumbbell` (Exercise), `info-circle` (About).
