import type { CSSProperties } from "react";
import type { WebViewCrop } from "../types";

/**
 * Embed HTTP Basic Auth credentials in a URL as `user:pass@host`. Used by every
 * webview mode so credentials can be supplied without the page prompting:
 * iframe mode (login-gated camera pages) and MJPEG mode (raw streams). Returns
 * the original URL unchanged when credentials are absent or the URL is invalid.
 */
export function withBasicAuth(url: string, user?: string, pass?: string): string {
  if (!user || !pass) return url;
  try {
    const parsed = new URL(url);
    parsed.username = user;
    parsed.password = pass;
    return parsed.toString();
  } catch {
    return url;
  }
}

/** A crop with no effect (identity transform). */
function isIdentity(crop?: WebViewCrop): boolean {
  return !crop || (crop.zoom === 1 && crop.offsetX === 0 && crop.offsetY === 0);
}

/**
 * Build the CSS for the *visual* iframe crop used by iframe mode.
 *
 * Same-origin policy makes it impossible to read a cross-origin camera page's
 * DOM, so we cannot truly "capture" the inner `<video>`. Instead we scale the
 * whole iframe up and shift it, then clip the overflow on the wrapper — the
 * desired region fills the screen and the surrounding control UI is pushed
 * off-screen. `offsetX`/`offsetY` are percentages of the viewport; `zoom` is a
 * multiplier. Sharing this helper between the renderer and the editor preview
 * guarantees what the operator tunes is exactly what gets presented.
 */
export function iframeCropStyle(crop?: WebViewCrop): CSSProperties {
  const base: CSSProperties = { width: "100%", height: "100%", border: 0 };
  if (isIdentity(crop)) return base;
  return {
    ...base,
    transformOrigin: "top left",
    transform: `translate(${crop!.offsetX}%, ${crop!.offsetY}%) scale(${crop!.zoom})`,
  };
}
