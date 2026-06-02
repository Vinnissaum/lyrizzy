# Phase 10 — Stability Fixes — Implementation Summary

**Completed:** 2026-06-02
**Spec:** `./spec.md` · **Design:** `./design.md` · **Tasks:** `./tasks.md`
**Execution:** T1–T7. T1/T2/T3-T4/T5-T6 run as 4 file-independent chains via parallel sub-agents; T7 integration + docs done centrally.

## Outcome

All 6 requirements (P10-01..P10-06) delivered. Central gate green:
- `cargo test --manifest-path src-tauri/Cargo.toml` — pass
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` — clean
- `npx tsc --noEmit` — clean
- `npx vitest run` — 254 passed (38 files)

## What changed

### P10-01 — Overlay renders over idle (T3)
`src/windows/presentation/PresentationApp.tsx` — reordered early-return render branches to `blank → overlay → idle (countdown/"Aguardando…") → live/frozen`. Previously `idle` returned before `overlay`, so an overlay triggered while idle never rendered and the projector froze on "Aguardando". Render-only fix; backend `overlay.rs` unchanged (overlays stay mode-independent, D-22/D-40). Tests: overlay-over-idle renders the media overlay; blank still beats overlay.

### P10-02 — Esc always escapes + local fallback (T4)
- `src/runtime/keyboard.ts` — new exported `isPresentationActive(state)` = `state != null && (mode ∈ {live,blank,frozen} || overlay != null)`, replacing the `getIsPresenting` mode-gate for Esc dispatch (D-41).
- `src/windows/operator/OperatorApp.tsx` — uses `isPresentationActive`; the hardcoded `onEscape` and the user-rebindable `exitPresentation` action unified behind one handler: clear overlay if present, else fire the `exitPresentation()` command (closes the window). Fixes the prior split where the rebindable action only did `setMode("idle")`.
- `src/windows/presentation/PresentationApp.tsx` — Esc always `preventDefault()` + `forwardKeydown(e)` AND arms a ~400ms local fallback `getCurrentWindow().close()` (try/catch swallow, single-arm gate so double-Esc closes once, timer cleared on cleanup) (D-42). Guarantees escape even when the operator window is gone. Added the `getCurrentWindow` import (the spec assumed it was already present here; it wasn't).
- Tests: idle+overlay Esc clears; idle Esc exits + fallback close fires after timeout (fake timers); double-Esc idempotent.

### P10-03 — Smart author parentheses, backend (T1)
`src-tauri/src/commands/presentation.rs` — private `credit_line(raw, in_parens) -> Option<String>` + `is_balanced_wrapped(&str) -> bool`; `build_title_slide` now does `author.and_then(|a| credit_line(a, in_parens))` and omits the line on `None`. Idempotent: ON+wrapped → no `((...))`; OFF+wrapped → stripped; `()`/blank → omitted; `John (PD)` and `(A) and (B)` are not-wrapped. +10 unit cases; pre-existing title-slide tests still green.

### P10-04 — Smart author parentheses, frontend (T2)
New `src/components/presentation/credit.ts` (`creditLine`/`isBalancedWrapped`) mirroring the Rust contract exactly; consumed in `SongPreviewPane.tsx` (replaces the inline ternary). `credit.test.ts` covers the same cases 1:1, preventing preview/projection drift (backend remains source of truth for the projected slide).

### P10-05 — Operator observability (T5)
`src-tauri/src/lib.rs` — `std::panic::set_hook` (logs payload + `file:line:col` via `tracing::error!`, chains the default hook) installed before the builder; `.on_window_event` handler logs `CloseRequested` / `Destroyed` / `Focused(false)` with the window label. Panic hook distinguishes a whole-process crash from a single-window close.

### P10-06 — Lifecycle hardening (T6)
`src-tauri/src/lib.rs` `on_window_event` — on **operator** `Destroyed`, close the presentation window if present (`get_webview_window("presentation")`, ignore-if-gone) to prevent an orphaned always-on-top fullscreen window; presentation-alone close does nothing to the operator. Pure decision extracted as `should_close_presentation_on_destroy(label) -> bool` in `src-tauri/src/commands/window.rs` with 3 unit tests.

## Notes & deviations
- `isPresentationActive` lives in `runtime/keyboard.ts` (no shared selectors module exists yet) — natural candidate to relocate if one is introduced.
- `getCurrentWindow` import added to `PresentationApp.tsx` (spec assumed it was already imported).
- Tauri's `WindowEvent::CloseRequested` exposes no user-vs-programmatic origin; the separate `Focused(false)` log line supplies the focus context the diagnosis needs instead.
- The operator Esc gate intentionally excludes idle-no-overlay (`isPresentationActive` is false there); that path is covered by the presentation window's local self-close fallback (acceptance criterion 5).

## Open verification (carried from tasks.md)
P10-05/06 instrument and contain issue #3 (spontaneous operator close) but do not yet prove its root cause — needs a field repro. Leading hypotheses to confirm from the new logs: (a) WebView2/GPU process crash on focus loss, (b) panic in an async command, (c) OS/WM always-on-top focus interaction. Manual two-window check (close operator → presentation closes; logs show events) is for the Windows hardware. Regardless of cause, the P10-02 local Esc fallback + P10-06 orphan prevention ensure the user is never left stuck.
