import type { TFunction } from "i18next";
import { normalizeError } from "../api/commands";

/**
 * Best description available for a rejection that is not an `ErrorPayload`.
 * `String(err)` is right for an `Error` or a string, but an arbitrary object
 * stringifies to "[object Object]" — the exact thing this module exists to
 * prevent — so fall back to its JSON shape.
 */
function describeRejection(err: unknown): string {
  const text = String(err);
  if (text !== "[object Object]") return text;
  try {
    return JSON.stringify(err) ?? text;
  } catch {
    return text;
  }
}

/**
 * Turn a rejected Tauri command into a sentence the operator can act on.
 *
 * Command errors arrive as `ErrorPayload` objects (`{ code, params }`), so
 * `String(err)` renders them as "[object Object]" — the failure the operator
 * actually saw when a replace-mode restore died (RC-4). This resolves the code
 * against the `error.*` namespace and falls back to `error.generic`, which
 * carries the code, so an unmapped code still says something useful instead of
 * showing a bare identifier.
 */
export function formatCommandError(err: unknown, t: TFunction): string {
  const { code, params } = normalizeError(err);
  if (code === "legacy") {
    return t("error.legacy", { message: describeRejection(err) });
  }
  return t([`error.${code}`, "error.generic"], { ...params, code });
}
