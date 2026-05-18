# Trinity Lyrics v2

**Vision:** A Windows desktop app for church liturgical presentation — manages a local library of song lyrics, organizes them into service sets, and drives a second monitor (projector/TV) with a fullscreen presentation window.
**For:** Church sound/tech volunteers managing Sunday service presentations
**Solves:** Eliminates the JVM startup penalty, excessive installer size (~120 MB), and high idle memory (~300 MB) of v1 (Kotlin + CMP) by replacing the platform with Rust + Tauri v2, which uses the OS-provided WebView2 (already on every Windows 10 1803+ machine).

## Goals

- Cold startup < 1 second on 5-year-old hardware (measured from icon click to UI visible)
- Installer size < 15 MB (vs. 120 MB in v1)
- Idle memory < 80 MB (vs. 300 MB in v1)
- Used in a real Sunday service after Phase 1

## Tech Stack

**Core:**

- Framework: Tauri 2.x
- Language: Rust 1.82+ (backend), TypeScript 5.x (frontend)
- Database: SQLite via sqlx 0.8.x

**Key dependencies:** React 18.x, Vite 6.x, Tailwind CSS v4, Zustand 5.x, Tokio 1.x

## Scope

**Phase 0 (skeleton) includes:**

- Two-window IPC demo (counter synced via "state_changed" event)
- sqlx + SQLite connected with migration running at startup
- asset:// protocol handler serving local media files
- MP4 video playback via asset:// in presentation window
- Tests green (cargo test + npx vitest)

**Phase 1 (MVP) includes:**

- Full song CRUD with FTS5 search
- Section editor with drag-to-reorder
- Set builder
- Holyrics + plain-text import
- Lyrics presentation with keyboard-first navigation
- Dual-monitor support
- Portuguese UI

**Explicitly out of scope (v1/MVP):**

- Cloud storage or multi-device sync
- PPTX rendering
- RTSP camera streaming
- CCLI license reporting
- Mobile or web deployment

## Constraints

- Timeline: Solo developer; ~6 weeks per phase
- Technical: Windows 10 1803+ only (WebView2 system dependency)
- Resources: Solo — no dedicated QA; manual test checklist covers critical paths
