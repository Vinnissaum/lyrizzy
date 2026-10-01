# Phase 20 — Tasks

**Spec:** `spec.md` (P20-01..P20-10)
**Status:** Done (T1–T6), released as `v1.7.0`
**Baseline (v1.6.0):** 768 Vitest + 1 skipped (91 files), 370 Rust + 1 ignored, `tsc` and `clippy -D warnings` clean.

| # | Task | Where | Reqs | Depends on | Done when / Tests | Gate |
|---|------|-------|------|------------|-------------------|------|
| T1 | `source_item_id` on `CountdownState`; `should_preserve_countdown`; `start_countdown` gains `source_item_id` + `preserve_active`; arm/reset clear the source | `domain/countdown.rs`, `commands/countdown.rs` | P20-02, P20-03 | — | Unit tests: preserve table (scheduled, running+takeover, running same/different/None source, paused, finished, idle); serde default for `sourceItemId` | `cargo test`, `clippy` |
| T2 | `should_reset_countdown_on_exit` replaces the takeover-only gate in `exit_presentation`; teardown clears source and scales | `commands/window.rs` | P20-01 | T1 | Unit tests: reset for running/paused/finished with and without takeover; not for scheduled/idle | `cargo test`, `clippy` |
| T3 | Frontend types + `StartCountdownParams`; landing effect passes `sourceItemId` + `preserveActive` and stops reading the store | `types/index.ts`, `api/commands.ts`, `PresentationApp.tsx`, `PresentationApp.test.tsx` | P20-04, P20-05 | T1 | Existing landing tests updated; new test: a stale `running` store state still calls start with `preserveActive` (the backend decides) | `vitest`, `tsc` |
| T4 | `presentation_mime` allow-list + MIME; `.ppsx`/`.pps` accepted | `commands/media.rs` | P20-06, P20-07, P20-08 | — | Unit tests for every accepted extension, case-insensitivity at the call site, and rejection of `key`/`docx` | `cargo test`, `clippy` |
| T5 | `PRESENTATION_EXTENSIONS` shared by both pickers; tooltip + user guide | `utils/presentationFiles.ts` (+test), `SetBuilder.tsx`, `OperatorPresentationLayout.tsx`, locales, `docs/user-guide/*` | P20-08, P20-09 | — | Constant test; pickers use it | `vitest`, `tsc` |
| T6 | Bump `1.7.0`, ROADMAP/STATE, commit, tag, push | version files, `.specs/project/*` | P20-10 | T1–T5 | `check-version` OK, tag on remote | full gate |
