# Trinity Lyrics v2

## Stack (v2)
- Backend: Rust 1.82+, Tauri 2.x, sqlx 0.8.x, Tokio 1.x, serde 1.x
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
- Events emitted by Rust: "state_changed" (PresentationState), "media_library_changed", "countdown_tick"
- Both windows listen to ALL events

## Two-Window Pattern
- Operator window: label "operator", full UI, all commands
- Presentation window: label "presentation", opened on demand via open_presentation_window command
- Both windows mount the same React root (main.tsx); branch on getCurrentWindow().label
- Presentation window is read-only: never invokes mutating commands

## Architecture Invariants
- Rust AppState.presentation is the single source of truth — frontend stores are projections
- state.presentation.write().await must be dropped before calling app.emit() to avoid deadlock
- All slide generation is pure Rust (slide_splitter); no slide logic in the frontend

## Common Gotchas
- asset:// protocol: must be registered in tauri.conf.json security.csp AND in lib.rs
- asset:// handler: validate paths to prevent path traversal outside the media directory
- Monitor index ordering is OS-dependent — always test on real hardware with two monitors
- MP4/WebM work natively in WebView2; reject MKV/AVI at import with HandBrake guidance
- FTS5 trigger updates only title/artist; song body text not indexed in current schema
