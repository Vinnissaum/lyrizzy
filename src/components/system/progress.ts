import type { UpdateProgress } from "../../types";

/** `total` null or non-positive means an unknown size — never render a percentage. */
export function formatProgress(
  p: UpdateProgress | null,
): { percent: number | null; determinate: boolean } {
  if (p === null || p.total === null || p.total <= 0) {
    return { percent: null, determinate: false };
  }
  const percent = Math.min(100, Math.floor((p.downloaded / p.total) * 100));
  return { percent, determinate: true };
}
