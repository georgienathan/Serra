// combine local date + time strings into a UTC ISO string
export function toUTCISO(dateYMD: string, timeHM: string): string {
  const [y, m, d] = dateYMD.split('-').map(Number);
  const [hh, mm] = (timeHM || '12:00').split(':').map((x) => Number(x || 0));
  const local = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 12, mm ?? 0, 0, 0);
  return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
}
export function todayYMD(d = new Date()) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function nowHM(d = new Date()) {
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}
