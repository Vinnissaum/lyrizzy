import i18next from "../i18n/index";

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(i18next.language);
  } catch {
    return iso;
  }
}

export function formatDatetime(epochMs: number): string {
  try {
    return new Date(epochMs).toLocaleString(i18next.language);
  } catch {
    return String(epochMs);
  }
}
