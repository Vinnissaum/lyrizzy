# Project Structure

**Root:** `C:\git\triade`

## Directory Tree

```
triade/
├── src/                        ← React frontend
│   ├── main.tsx                ← Entry: branches by window label
│   ├── App.tsx                 ← Scaffold placeholder (not used by main.tsx)
│   ├── index.css               ← Global Tailwind import
│   ├── api/
│   │   └── commands.ts         ← All Tauri invoke/listen wrappers
│   └── windows/
│       ├── operator/
│       │   └── OperatorApp.tsx ← Operator console stub
│       └── presentation/
│           └── PresentationApp.tsx ← Presentation renderer stub
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── migrations/
│   │   └── 001_initial.sql     ← Full schema (songs, sets, media, settings, FTS5)
│   └── src/
│       ├── lib.rs              ← Tauri builder setup (partially filled)
│       ├── domain/mod.rs       ← Empty stub — submodules commented out
│       ├── db/mod.rs           ← Empty stub — submodules commented out
│       ├── commands/mod.rs     ← Empty stub — submodules commented out
│       ├── services/mod.rs     ← Empty stub — submodules commented out
│       └── protocol/mod.rs     ← Empty stub — asset.rs commented out
├── index.html                  ← Operator window entry (loads src/main.tsx)
├── presentation.html           ← Presentation window entry (loads src/main.tsx)
├── vite.config.ts              ← Dual rollup inputs: main + presentation
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── docs/
    └── TDD-v2.md               ← Full technical design document
```

## Module Organization

### Frontend API Layer

**Purpose:** Single point of contact for all Tauri IPC
**Location:** `src/api/`
**Key files:** `commands.ts` (invoke wrappers), `events.ts` (listen wrappers — planned)

### Frontend Windows

**Purpose:** Per-window root components, branched by `getCurrentWindow().label`
**Location:** `src/windows/`
**Key files:** `operator/OperatorApp.tsx`, `presentation/PresentationApp.tsx`

### Rust Backend Layers

**Purpose:** Clean separation of concerns in the Rust codebase
**Location:** `src-tauri/src/`

| Layer | Location | Purpose |
|-------|----------|---------|
| App setup | `lib.rs` | Tauri builder, plugin registration, command handler registration |
| State | `state.rs` (to add) | AppState struct with Arc<RwLock<T>> |
| Domain types | `domain/` | Pure Rust structs/enums for IPC and business logic |
| Database | `db/` | sqlx pool init, migration runner, CRUD queries |
| Commands | `commands/` | Tauri #[tauri::command] handlers |
| Services | `services/` | Pure business logic (no I/O in domain) |
| Protocol | `protocol/` | asset:// URI scheme handler |

### Database Migrations

**Purpose:** Versioned, automatic SQLite schema management
**Location:** `src-tauri/migrations/`
**Key files:** `001_initial.sql` (full schema — songs, song_sections, tags, media, sets, set_items, settings, FTS5)

## Where Things Live

**IPC contract:**

- Frontend side: `src/api/commands.ts`
- Rust side: `src-tauri/src/commands/` + `lib.rs` invoke_handler![]

**Database schema:**

- SQL migrations: `src-tauri/migrations/`
- Query functions: `src-tauri/src/db/`

**Asset serving:**

- Protocol handler: `src-tauri/src/protocol/asset.rs`
- CSP config: `src-tauri/tauri.conf.json` (security.csp)
