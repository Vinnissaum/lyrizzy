const BLOCKED_SCHEMES = ['file:', 'javascript:', 'data:', 'vbscript:'];

export function isUrlAllowed(url: string): { ok: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'URL inválida' };
  }
  for (const scheme of BLOCKED_SCHEMES) {
    if (parsed.protocol === scheme) {
      return { ok: false, reason: `Esquema não permitido: ${parsed.protocol}` };
    }
  }
  return { ok: true };
}
