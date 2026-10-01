# Phase 19 — Presentation Screens Stop Covering the Desktop, Aviso Size & Preview

**Status:** IMPLEMENTED and RELEASED as `v1.6.0` (2026-10-01). P19-01..P19-12 done; hardware verification below still open.
**Gate:** 768 Vitest + 1 skipped (91 files), 370 Rust + 1 ignored, `tsc --noEmit` clean, `cargo clippy --all-targets -D warnings` clean
**Depends on:** Phase 16 (`v1.3.0` — the always-on-top rule this phase reverts), Phase 18 (`v1.5.0`)
**Release target:** `v1.6.0` (minor — new operator-facing capability in the Aviso dialog, plus a behaviour revert)
**Scope:** Medium — design inline, tasks inline (below). One Rust file + `lib.rs`, one new React component, locales.

---

## Problem Statement

Two field reports from the `v1.5.0` install.

1. **The presentation screens cover everything else.** Since `v1.3.0`, every fullscreen presentation window is
   always-on-top, and a focus-loss handler re-pins it whenever another app takes the foreground. On the
   projection monitor, any window that opens or is dragged there sits *behind* the projection — invisible
   and impossible to grab to drag back. The operator would rather accept the risk P16-01 was guarding
   against (Alt+Tab raising a window over a live projection) than lose windows behind it.
2. **The Aviso dialog is blind.** Clicking **Aviso** opens a bare textarea. The operator cannot see how the
   text will look on the wall, and resizing it means leaving the live screen for Settings → Aviso.

---

## Root-Cause Analysis

| # | Report | Root cause | Evidence |
|---|--------|-----------|----------|
| RC-1 | Windows hide behind the projection | P16-01 changed `should_pin_on_top` from `monitor_count == 1` to "pin everything that goes fullscreen", so on a multi-monitor setup **both** outputs are topmost. P16-03 added a `WindowEvent::Focused(false)` handler that calls `set_always_on_top(true)` on every fullscreen presentation window, so even a window the OS demoted gets pulled back over everything. | `commands/window.rs:295-312` (`should_pin_on_top`), `:325-337` (`should_reassert_on_top`), `lib.rs:117-142`; introduced in `65440f2` |
| RC-2 | No preview in the Aviso dialog | The dialog is inline JSX in `OperatorPresentationLayout` with a textarea and two buttons. The wall renders `SlideStage` → `SlideContent warningText` → `WarningBody`, which reads all appearance from `useSettingsStore`, but the dialog renders none of it. | `OperatorPresentationLayout.tsx:377-415`; wall path `PresentationApp.tsx:271-276`, `bodies.tsx:177-213` |
| RC-3 | No size control in the Aviso dialog | `announcementFontSize` is a global setting edited only in Settings → Aviso. The presentation windows already reload on any `announcement.*` setting change, so changing it from the dialog would reach the wall with no new IPC. | `stores/settings.ts:425-428`, `SettingsScreen.tsx:377-381`, `PresentationApp.tsx:112-119` |

---

## Requirements

### 19A — Revert always-on-top on multi-monitor (RC-1)

| ID | Requirement |
|----|-------------|
| P19-01 | On a setup with **two or more** monitors, no presentation window is always-on-top. Other windows can be raised over it, dragged onto and off its monitor, and are never hidden behind it. |
| P19-02 | On a **single-monitor** setup, the fullscreen presentation (output One over the operator screen) stays always-on-top — the pre-`v1.3.0` behaviour, unchanged. |
| P19-03 | The windowed fallback (output Two with no free monitor) is never pinned. This keeps P16-02's carve-out, which was a separate fix and is not part of the revert. |
| P19-04 | Losing focus no longer re-pins a presentation window: the P16-03 focus-loss handler and `should_reassert_on_top` are removed. The focus-loss **log line** stays. |

### 19B — Aviso dialog: size and preview (RC-2, RC-3)

**User decision (2026-10-01):** the size control changes the **global** announcement text size (the same
setting as Settings → Aviso). It persists as the default for future avisos, and an aviso already on screen
resizes live.

| ID | Requirement |
|----|-------------|
| P19-05 | The Aviso dialog shows a 16:9 preview of the aviso, rendered through the **same** `SlideStage` + `WarningBody` path the wall uses, so font, colours, position, margin, spacing and weight match the wall exactly. |
| P19-06 | The preview updates as the operator types. With an empty textarea it shows the placeholder text, dimmed, so the operator can judge the size before typing. |
| P19-07 | The dialog has a text-size control: − / + buttons around the current size name (Pequeno … Gigante), stepping through the existing five sizes and disabled at either end. |
| P19-08 | Changing the size calls `setAnnouncementFontSize`, so the change persists, the Settings → Aviso select reflects it, and any aviso already on screen resizes. Cancelling the dialog **does not** revert it (it is a setting, not a draft). |
| P19-09 | Existing behaviour is unchanged: the textarea gets focus when the dialog opens, Ctrl/⌘+Enter sends, Esc cancels, and Confirm stays disabled on whitespace-only text. Sending still fans out to the mirror output. |
| P19-10 | The dialog is wide enough for a usable preview (not the current `w-96`), and it fits within the operator window without horizontal scroll. |
| P19-11 | New strings exist in both `pt-BR` and `en-US`. |

### 19C — Release

| ID | Requirement |
|----|-------------|
| P19-12 | Version bumped to `1.6.0` across the five version sources (`package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock`, `tauri.conf.json`), committed on `main`, tagged `v1.6.0` and pushed, so the release workflow builds the signed draft. |

---

## Design (inline)

- **19A:** `should_pin_on_top(output, target_idx, monitor_count)` returns
  `monitor_count == 1 && !use_windowed_fallback(output, target_idx)`. Unit tests replace the P16-01 ones:
  multi-monitor → never pinned, single-monitor fullscreen → pinned, windowed fallback → never pinned.
  Delete `should_reassert_on_top`, its tests and the `lib.rs` block that calls it.
- **19B:** Extract the dialog into `src/components/presentation/AnnouncementDialog.tsx`
  (`{ open, onCancel, onConfirm(text) }`), so it can be tested without rendering the whole layout.
  The preview is `<SlideStage backgroundColor={PRESET_COLORS[preset].bg}><WarningBody text=… /></SlideStage>`
  inside an `aspect-video` box. This is the composition `LivePreview` and `PresentationApp` already use, so the
  preview cannot drift from the wall. The size control uses `stepSize` / `FONT_SIZE_ORDER` from `layout.ts`
  and reuses the `settings.windows.fontSizes.*` labels.
- **Out of scope:** `AnnouncementRenderer.tsx` is unused by production code (only its own test imports it).
  Noted here, left alone.

## Tasks (inline)

| # | Task | Reqs | Gate |
|---|------|------|------|
| T1 | Revert pin rule + focus-loss re-pin in `window.rs` / `lib.rs`, rewrite unit tests | P19-01..04 | `cargo test`, `cargo clippy -D warnings` |
| T2 | `AnnouncementDialog` component with preview + size stepper, wired into `OperatorPresentationLayout`, i18n keys, tests | P19-05..11 | `npx vitest run`, `tsc --noEmit` |
| T3 | Bump to `1.6.0`, update ROADMAP/STATE, commit, tag, push | P19-12 | `scripts` version test, tag pushed |

## Verification on hardware (manual, after release)

- Two monitors: start a presentation, drag a File Explorer window onto the projection monitor. It must appear
  **over** the projection.
- One monitor: start a presentation. It must stay over the operator window.
- Aviso: open the dialog, step the size, confirm. The wall matches the preview.
