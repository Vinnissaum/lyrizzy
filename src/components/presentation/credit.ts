/**
 * Idempotent author-credit normalizer for the title slide.
 *
 * Mirrors the Rust `credit_line` / `is_balanced_wrapped` contract in
 * `src-tauri/src/commands/presentation.rs` so the editor preview never drifts
 * from the actually projected slide.
 *
 * @param raw      The raw author/credit text.
 * @param inParens Whether the "author in parentheses" setting is ON.
 * @returns The credit line to render, or `null` when it should be omitted.
 */
export function creditLine(raw: string, inParens: boolean): string | null {
  const t = raw.trim();
  if (t === "") return null;
  const stripped = isBalancedWrapped(t) ? t.slice(1, -1).trim() : t;
  if (stripped === "") return null; // credit was just "()"
  return inParens ? `(${stripped})` : stripped;
}

/**
 * True when `t` is wrapped by a single outer pair of parentheses, i.e. it
 * starts with '(' and ends with ')' and the opening paren closes only at the
 * very end. Rejects `John (PD)` and `(A) and (B)`.
 */
export function isBalancedWrapped(t: string): boolean {
  if (!t.startsWith("(") || !t.endsWith(")")) return false;
  let depth = 0;
  const chars = [...t];
  const last = chars.length - 1;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === "(") depth += 1;
    if (c === ")") depth -= 1;
    if (depth === 0 && i !== last) return false; // closed early -> not an outer wrap
  }
  return depth === 0;
}
