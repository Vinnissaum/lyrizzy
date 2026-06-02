# Phase 10 — Tasks

**Spec:** `./spec.md` · **Design:** `./design.md`
**Gate (every task):** `cargo test --manifest-path src-tauri/Cargo.toml` + `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` (Rust tasks) · `npx tsc --noEmit` + `npx vitest run` (frontend tasks).

`[P]` = parallelizable (no shared files with another in-flight task).

---

### T1 [P] — Smart parens: backend normalizer (P10-03)
- **Where:** `src-tauri/src/commands/presentation.rs`
- **What:** Add private `credit_line(raw, in_parens) -> Option<String>` + `is_balanced_wrapped(&str) -> bool` per design contract. Rewrite `build_title_slide` (≈L86-92) to use it.
- **Reuses:** existing `build_title_slide`, `resolve_title_credit`.
- **Done when:** ON+already-wrapped → no double wrap; OFF+wrapped → stripped; `()` → omitted; existing tests L524-537 pass.
- **Tests:** add unit cases for the 4 flag×wrap combinations + `()` + `John (PD)` (not wrapped).

### T2 [P] — Smart parens: frontend helper (P10-04)
- **Where:** new `src/components/presentation/credit.ts`; consume in `src/components/presentation/SongPreviewPane.tsx` (≈L46-50).
- **What:** `creditLine(raw, inParens): string | null` mirroring T1 exactly.
- **Done when:** SongPreviewPane uses the helper; preview matches projected slide.
- **Tests:** Vitest cases 1:1 with T1's Rust cases.

### T3 — Overlay renders over idle (P10-01)
- **Where:** `src/windows/presentation/PresentationApp.tsx`
- **What:** Reorder render branches → `blank` → `overlay` → `idle (countdown/waiting)` → `live/frozen`. Move existing blocks only; no new JSX.
- **Done when:** `{mode:"idle", overlay:{type:"media"}}` renders the media overlay; blank still beats overlay.
- **Tests:** `PresentationApp.test.tsx` new case (overlay-over-idle) + blank-beats-overlay case.

### T4 — Esc always escapes + local fallback (P10-02)
- **Depends on:** T3 (overlay precedence must be correct first).
- **Where:** `src/runtime/keyboard.ts`, `src/windows/operator/OperatorApp.tsx`, `src/windows/presentation/PresentationApp.tsx`.
- **What:** Introduce `isPresentationActive(state)` (mode∈{live,blank,frozen} || overlay!=null). Replace `getIsPresenting` gates. Presentation-window Esc: always forward + arm ~400ms local `getCurrentWindow().close()` fallback (idempotent, swallow errors). Unify operator user-binding `exitPresentation` action with hardcoded `onEscape` (clear overlay if present, else `exitPresentation()` command).
- **Done when:** Esc escapes from idle, idle+overlay, live, blank, frozen; double-Esc no-ops; fallback closes window when operator round-trip stalls.
- **Tests:** Vitest — idle+overlay Esc clears; idle Esc exits + fallback close (fake timers); idempotent double-press.

### T5 [P] — Operator observability (P10-05)
- **Where:** `src-tauri/src/lib.rs`
- **What:** Install `std::panic::set_hook` (tracing::error! payload+location) before builder; add `on_window_event` logging `CloseRequested`/`Destroyed`/`Focused(false)` with label+timestamp.
- **Done when:** closing a window emits a structured log line; panics are logged distinctly.
- **Tests:** Rust unit test for any extracted pure helper; manual log inspection (note in SUMMARY).

### T6 — Operator close → presentation close, no orphan (P10-06)
- **Depends on:** T5 (shares `on_window_event` handler in lib.rs).
- **Where:** `src-tauri/src/lib.rs` (+ optional helper in `commands/window.rs`).
- **What:** In `on_window_event`, when **operator** `Destroyed` → close presentation window if present. Presentation-alone close → no operator side-effect. Keep `exit_presentation` robust to missing window (already handled).
- **Done when:** closing operator closes presentation; closing presentation leaves operator open.
- **Tests:** Rust unit test for the decision helper (`should_close_presentation(label, event)`); manual two-window check on Windows hardware.

### T7 — Phase wrap-up
- **Depends on:** T1–T6.
- **What:** Update `ROADMAP.md` (Phase 10 row) + `STATE.md` (decisions D-40+: render-order precedence, isPresentationActive predicate, panic hook). Run full gate. Write `SUMMARY.md`.

---

## Dependencies

```
T1 ─┐
T2 ─┤
T3 ──► T4 ──┐
T5 ──► T6 ──┤
            └─► T7
```

T1, T2, T3, T5 can start in parallel. T4 after T3. T6 after T5. T7 last.

## Open verification note
P10-05/06 instrument and contain issue #3 but do not yet prove its root cause (needs field repro —
see design.md uncertainty flag). T7 SUMMARY should record whichever hypothesis the new logs confirm.
