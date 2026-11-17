# Lyrizzy (formerly Trinity Lyrics v2)

## Stack (v2)
- Backend: Rust 1.85+ (edition-2024 deps; dev/CI pinned to 1.96.0), Tauri 2.x, sqlx 0.8.x, Tokio 1.x, serde 1.x
- Frontend: TypeScript 5.x, React 18.x, Vite 6.x, Tailwind CSS v4, Zustand 5.x
- Database: SQLite via sqlx; migrations in src-tauri/migrations/*.sql

## Commands
- Dev server: `npm run tauri dev`
- Build: `npm run tauri build`
- Rust tests: `cargo test --manifest-path src-tauri/Cargo.toml`
- Frontend tests: `npx vitest`
- Add migration: create src-tauri/migrations/00N_description.sql; sqlx runs it at startup

## IPC Contract
- All Tauri commands declared in commands/ and registered in lib.rs invoke_handler![]
- All frontend calls go through src/api/commands.ts — never raw invoke() outside this file
- Events emitted by Rust: "state_changed" (PresentationState), "media_library_changed", "countdown_tick", "update_progress" (UpdateProgress)
- Both windows listen to ALL events, but only the operator window subscribes to "update_progress" — the presentation window has no update UI
- Frontend events between the windows (no Rust involved), wrapped in src/api/commands.ts like "forward_keydown": "video_report" (VideoReport, presentation → operator: the video set item on that wall; `itemId: null` = none) and "video_command" (VideoCommand, operator → the presentation window of that `output` showing that `itemId`). The `<video>` element is the truth for playback; the presentation window still invokes no mutating command (AD-094)

## Two-Window Pattern
- Operator window: label "operator", full UI, all commands
- Presentation window: label "presentation", opened on demand via open_presentation_window command
- Both windows mount the same React root (main.tsx); branch on getCurrentWindow().label
- Presentation window is read-only: never invokes mutating commands

## Architecture Invariants
- Rust AppState.presentation is the single source of truth — frontend stores are projections
- state.presentation.write().await must be dropped before calling app.emit() to avoid deadlock
- All slide generation is pure Rust (slide_splitter); no slide logic in the frontend

## User Guide (docs site)
- The user guide is a pt-BR VitePress site in docs/ (pages in docs/guia/), published to GitHub Pages by .github/workflows/docs.yml; the English files directly in docs/ are developer docs, excluded from the site
- A change users will notice updates its page in docs/guia/, using the exact pt-BR labels from src/i18n/locales/pt-BR.json
- When a screen changes, regenerate its screenshots with `npm run docs:screenshots` (scenes in scripts/docs-screenshots/capture.mjs, mocked backend and sample data in app.tsx and data.ts)

## Common Gotchas
- asset:// protocol: must be registered in tauri.conf.json security.csp AND in lib.rs
- asset:// handler: validate paths to prevent path traversal outside the media directory
- Monitor index ordering is OS-dependent — always test on real hardware with two monitors
- MP4/WebM work natively in WebView2; reject MKV/AVI at import with HandBrake guidance
- Song search: `songs_fts` (FTS5, tokenizer `unicode61`) indexes title, artist and the lyrics (`body`) and already ignores accents and ç; a search it cannot parse (unbalanced quote or parenthesis) falls back to a Rust filter on title and artist that folds them too (`services/fts_query.rs`). In-browser song filters use `matchesSongSearch` (`src/utils/songSearch.ts`) so they ignore accents and ç the same way
