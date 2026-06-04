/** Format milliseconds as mm:ss (or hh:mm:ss when ≥ 1h). */
export function msToDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Parse a mm:ss or hh:mm:ss string into milliseconds; null if invalid. */
export function durationToMs(value: string): number | null {
  const parts = value.split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    if (s < 0 || s > 59) return null;
    return (m * 60 + s) * 1000;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (s < 0 || s > 59 || m < 0 || m > 59) return null;
    return (h * 3600 + m * 60 + s) * 1000;
  }
  return null;
}
