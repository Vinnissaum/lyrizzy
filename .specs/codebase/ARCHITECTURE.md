# Architecture

**Pattern:** Two-window Tauri desktop app with Rust backend as single source of truth

## High-Level Structure

```
Tauri Process (Rust)
  AppState (Arc<RwLock<T>>)   ← single source of truth
  Database pool (sqlx SQLite)
  Tauri command handlers       ← commands/ module
  Custom protocol (asset://)  ← protocol/ module
       │
       ├── WebviewWindow "operator" (primary monitor)
       │     React: OperatorApp.tsx
       │     Listens: "state_changed" Tauri event
       │     Invokes: Tauri commands
       │
       └── WebviewWindow "presentation" (secondary monitor)
             React: PresentationApp.tsx
             Listens: "state_changed" Tauri event
             Read-only: never invokes mutating commands
```

## Identified Patterns

### Two-Window Pattern

**Location:** `src/main.tsx` (entry), `src/windows/operator/`, `src/windows/presentation/`
**Purpose:** Separate operator console from fullscreen presentation output
**Implementation:** Both windows load the same `index.html`/`presentation.html` which both execute `src/main.tsx`. The entry point calls `getCurrentWindow().label` and dynamically imports the correct App component.
**Example:** `src/main.tsx` lines 6–15

### Event-Driven State Sync

**Location:** `src/api/commands.ts`, Rust commands/ + lib.rs
**Purpose:** Keep both windows in sync without polling
**Implementation:** All mutations go through Tauri commands → Rust writes state → emits "state_changed" → both windows' Zustand stores update via `listen()`.
**Invariant:** `state.write().await` MUST be dropped before `app.emit()` to avoid deadlock.

### IPC Contract Abstraction

**Location:** `src/api/commands.ts`
**Purpose:** All frontend Tauri calls go through one file; never raw `invoke()` elsewhere
**Implementation:** Typed wrapper functions over `invoke()` and `listen()`.

### sqlx Migrations

**Location:** `src-tauri/migrations/`, `src-tauri/src/db/mod.rs`
**Purpose:** Automatic, versioned DB schema management at startup
**Implementation:** `sqlx::migrate!()` macro embeds migration files at compile time; runs pending migrations at Tauri setup.

### Custom Protocol (asset://)

**Location:** `src-tauri/src/protocol/asset.rs` (to be implemented)
**Purpose:** Serve local media files (images, MP4) from `%APPDATA%\TrinityLyrics\media\` to the WebView without a server
**Implementation:** Registered in Tauri builder + tauri.conf.json CSP. Path traversal validation: canonical path must start with media_dir.

## Data Flow: Operator Advances Slide

```
Operator presses Space
  → React keydown handler
  → commands.ts: advanceSlide()        [invoke("advance_slide")]
  → Rust: state.write().advance()
  → drop write guard
  → app_handle.emit("state_changed", new_state)
  → Both windows: onStateChanged() → Zustand setState()
  → React re-renders
```

## Code Organization

**Approach:** Feature-based modules with domain/db/commands/services/protocol layers

**Backend structure:**
```
src-tauri/src/
  lib.rs          — Tauri app setup, command registration, state init
  domain/         — Business types (Song, ServiceSet, PresentationState, etc.)
  db/             — sqlx pool init, migration runner, CRUD queries
  commands/       — Tauri command handlers (called from frontend)
  services/       — Pure business logic (slide_splitter, countdown, etc.)
  protocol/       — Custom URI scheme handlers (asset://)
```

**Frontend structure:**
```
src/
  main.tsx                    — Entry; branches by window label
  windows/operator/           — Operator console app
  windows/presentation/       — Presentation renderer app
  components/                 — Reusable UI components (by feature)
  slides/                     — Fullscreen slide renderers
  stores/                     — Zustand stores (event-driven state)
  api/                        — commands.ts + events.ts (IPC abstraction)
  hooks/                      — Custom React hooks
```

**Module boundaries:** Commands only call services/db, never call each other. Domain types are pure data — no I/O, no async.
