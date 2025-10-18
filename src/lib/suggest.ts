// src/lib/suggest.ts
export type SuggestCtx = {
  calories: number;      // kcal
  protein: number;       // g
  carbs: number;         // g
  fat: number;           // g
  exerciseMinutes: number;
  sleepMinutes: number;
};

export function buildSuggestions(ctx: SuggestCtx): string[] {
  const s: string[] = [];

  if (ctx.calories < 1200) {
    s.push("You're quite low on calories today — consider a balanced snack (protein + carbs).");
  }
  if (ctx.protein < 60) {
    s.push("Aim for 20–30g protein in your next meal to hit a solid daily target.");
  }
  if (ctx.exerciseMinutes === 0) {
    s.push("A short 10–20 min walk would boost your activity for today.");
  } else if (ctx.exerciseMinutes < 30) {
    s.push("You’re close — add a quick 10 min session to reach 30+ min today.");
  }
  if (ctx.sleepMinutes < 7 * 60) {
    s.push("Try a wind-down routine to target 7h sleep tonight.");
  }

  if (s.length === 0) s.push("Looking great today — keep doing what works! 💪");
  return s;
}
