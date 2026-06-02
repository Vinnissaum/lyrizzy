# Phase 10 — Stability Fixes Specification

**Status:** Drafted 2026-06-01
**Scope:** Large (3 distinct fixes, backend + frontend, plus window-lifecycle hardening)

## Problem Statement

Three field-reported defects undermine trust in the presentation flow:

1. **Overlay-on-idle freeze + dead Esc.** Triggering an image/Oferta overlay while the
   presentation window is idle shows "Aguardando apresentação…" forever and Esc cannot
   dismiss it — the user must kill the app.
2. **Naïve author-parentheses.** The "author in parentheses" setting blindly wraps the
   credit line, producing `((John Newton))` when the author field already has parens, and
   never strips parens when the setting is turned off.
3. **Operator window vanishes unprompted.** While presenting, switching to another app on
   the machine sometimes leaves the operator window closed with no user action — the
   operator loses all control mid-service.

## Goals

- [ ] An active overlay (image/announcement/webview) renders over the idle screen — no freeze.
- [ ] Esc (and a guaranteed local fallback) always dismisses the presentation window from **any** mode.
- [ ] Author-credit parentheses are idempotent: never double-wrapped, stripped when the flag is off.
- [ ] The operator window never disappears without user action; if it does, the operator can still recover/abort the presentation.
- [ ] Enough observability to root-cause the operator auto-close in the field.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Bundling/installing ffmpeg | Issue #1's "without ffmpeg" was an incidental correlation; the root cause is the overlay/idle render order, not ffmpeg. ffmpeg stays an optional runtime dep (D-6). |
| Reworking the overlay data model | Overlays remain transient (`OverlayState`), mode-independent. We fix render precedence, not the model. |
| Multi-set / multi-presentation lifecycle | Single fixed set workflow unchanged (D-21). |
| Rebindable Esc | Esc/F10 stay hardcoded, PowerPoint-parity (D-33). |

---

## User Stories

### P1: Overlay renders over idle + Esc always escapes ⭐ MVP

**User Story**: As an operator, when I trigger an image (Oferta/Câmera/Aviso) overlay, I want it
to appear on the projector even if I haven't advanced a slide yet — and I want Esc to always get
me out — so I'm never stuck on a frozen "Aguardando" screen.

**Why P1**: This is a hard lock-up requiring an app kill during a live service. Highest severity, and the root cause is confirmed.

**Root cause** (confirmed):
- `commands/overlay.rs` sets `p.overlay = Some(...)` without touching `p.mode`, so an overlay
  triggered from idle leaves `mode === "idle"`.
- `PresentationApp.tsx` returns the idle branch (line ~163) **before** the overlay branch (line ~191),
  so the overlay never renders.
- `getIsPresenting()` (operator `OperatorApp.tsx:168`, presentation `PresentationApp.tsx:105`,
  dispatcher `runtime/keyboard.ts:65,94`) excludes idle, so Esc is never treated as an exit key.

**Acceptance Criteria**:

1. WHEN an overlay is set AND `mode === "idle"` THEN the presentation window SHALL render the overlay (not the "Aguardando" screen).
2. WHEN an overlay is set AND `mode === "blank"` (operator-initiated black via F10) THEN the window SHALL stay black (blank beats overlay — preserves intentional blackout).
3. WHEN the user presses Esc and an overlay is active THEN the system SHALL clear the overlay (existing operator behavior), regardless of `mode`.
4. WHEN the user presses Esc and no overlay is active THEN the system SHALL exit presentation and close the presentation window, regardless of `mode` (including idle).
5. WHEN the operator's clean-exit round-trip does not close the presentation window within a short timeout THEN the presentation window SHALL close itself locally as a fallback.

**Independent Test**: Open presentation on an empty/idle state, trigger an Oferta image overlay → image shows. Press Esc → overlay clears. Press Esc again → window closes.

---

### P1: Smart author parentheses ⭐ MVP

**User Story**: As a song editor, I want the "author in parentheses" toggle to be smart about
existing parentheses so the credit line is always clean — never `((name))`, and stripped when I turn the flag off.

**Why P1**: Visible on the projector during every song's title slide; trivial but embarrassing.

**Current behavior** (`commands/presentation.rs:86-92` and `SongPreviewPane.tsx:46-50`):
both naïvely do `format!("({a})")` / `` `(${credit})` `` with no existing-paren detection.

**Definition of "already wrapped"**: the trimmed credit string starts with `(` and ends with `)`
AND those are a balanced outer pair (i.e. the first `(` matches the last `)`). Examples:
- `(John Newton)` → already wrapped.
- `John Newton` → not wrapped.
- `John (PD)` → NOT wrapped (trailing paren only).
- `(A) and (B)` → NOT wrapped (first `(` doesn't match last `)`).

**Acceptance Criteria**:

1. WHEN flag is ON AND credit is not already wrapped THEN system SHALL render `(credit)`.
2. WHEN flag is ON AND credit is already wrapped THEN system SHALL render the credit unchanged (no double-wrap).
3. WHEN flag is OFF AND credit is already wrapped THEN system SHALL strip the outer pair and render the inner text.
4. WHEN flag is OFF AND credit is not wrapped THEN system SHALL render the credit unchanged.
5. WHEN the credit is empty/blank THEN system SHALL omit the credit line entirely (unchanged behavior).
6. The backend slide builder and the frontend song-editor preview SHALL produce identical output for the same input (logic replicated + unit-tested in both).

**Independent Test**: Song with author `(Public Domain)`, flag ON → title slide shows `(Public Domain)`. Flag OFF → shows `Public Domain`.

---

### P1: Operator window resilience & recovery

**User Story**: As an operator, I never want the operator window to disappear on its own while
presenting; and if something does kill it, I want to still be able to abort the presentation.

**Why P1**: Losing the operator mid-service is catastrophic. Even if the exact trigger can't be
reproduced immediately, the recovery guarantee (P1 escape hatch) and observability are achievable now.

**Acceptance Criteria**:

1. WHEN the operator window receives a close request that the user did not initiate THEN the system SHALL log the close (window-event tracing) with enough context to diagnose (event kind, focus state, timestamp).
2. WHEN a backend command panics THEN the system SHALL log the panic via a panic hook (so a process-wide crash is distinguishable from a single-window close).
3. WHEN the operator window closes (for any reason) THEN the presentation window SHALL also close (no orphaned always-on-top fullscreen window the user cannot reach).
4. WHEN the presentation window closes alone (e.g. user/Esc) THEN the operator SHALL remain open and presentation state SHALL reset to idle (existing exit semantics, made robust to the window already being gone).
5. The presentation window's local Esc fallback (P1 story 1, criterion 5) SHALL function even when the operator window is absent.

**Independent Test**: Add `on_window_event` logging; close operator manually → presentation window closes too; logs show the operator close event. (Field repro of the spontaneous close is captured via the new logging.)

---

## Edge Cases

- WHEN overlay is set then `mode` advances to live THEN overlay still beats live content (existing intent preserved).
- WHEN Esc is pressed rapidly twice THEN no double-close panic (exit is idempotent — D-28/P8-04 already guard the backend; frontend fallback must also no-op if already closing).
- WHEN author credit is exactly `()` THEN treat as empty after stripping → omit credit line.
- WHEN author credit has unbalanced parens `(name` THEN treated as not-wrapped; flag ON wraps to `((name)`? No — wrap only when not already balanced-wrapped, so it becomes `((name)`. Acceptable edge; document that malformed input is wrapped verbatim.
- WHEN the presentation window is closed by the OS while `exit_presentation` runs THEN ignore the close error (already handled `window.rs:354`).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| P10-01 | P1: Overlay over idle | Design | Pending |
| P10-02 | P1: Esc always escapes (any mode) + local fallback | Design | Pending |
| P10-03 | P1: Smart parens — backend (`build_title_slide`) | Design | Pending |
| P10-04 | P1: Smart parens — frontend (`SongPreviewPane`) | Design | Pending |
| P10-05 | P1: Operator window-event + panic observability | Design | Pending |
| P10-06 | P1: Operator close → presentation close (no orphan) | Design | Pending |

**Coverage:** 6 total, 0 mapped to tasks yet.

---

## Success Criteria

- [ ] No path leaves the projector frozen on "Aguardando" while an overlay is set.
- [ ] Esc reliably escapes the presentation window from idle, live, blank, frozen, and overlay states.
- [ ] Zero `((...))` or unstripped parens on title slides across flag states; verified by unit tests in Rust and Vitest.
- [ ] Window-close and panic events are logged; operator window never leaves an orphaned presentation window.
- [ ] `cargo test`, `cargo clippy -D warnings`, `tsc --noEmit`, and `npx vitest` all green.
