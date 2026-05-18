# Code Conventions

## Naming Conventions

**Rust files:** snake_case. Examples: `lib.rs`, `mod.rs`, `slide_splitter.rs`, `holyrics_parser.rs`

**Rust types/structs/enums:** PascalCase. Examples: `AppState`, `PresentationState`, `SongSection`

**Rust functions/methods:** snake_case. Examples: `advance_slide`, `run_migrations`, `split_section`

**Tauri command names:** snake_case strings matching the Rust function name. Examples: `"advance_slide"`, `"load_song"`, `"search_songs"`

**TypeScript files:** PascalCase for components, camelCase for modules. Examples: `OperatorApp.tsx`, `PresentationApp.tsx`, `commands.ts`, `presentationStore.ts`

**TypeScript functions/exports:** camelCase. Examples: `advanceSlide`, `onStateChanged`, `toggleBlank`

**React components:** PascalCase. Examples: `OperatorApp`, `PresentationApp`

**CSS/Tailwind:** Utility-first Tailwind classes. No custom CSS files except `index.css` for global resets.

## Code Organization

**Import ordering (TypeScript):**
1. External packages (`react`, `@tauri-apps/api/...`)
2. Internal modules (`./windows/...`, `../api/commands`)
Example from `main.tsx`:
```ts
import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./index.css";
```

**Rust module declarations:** All submodule `pub mod` declarations at top of parent `mod.rs`. Currently commented out pending implementation — uncomment as modules are added.

## Type Safety

**Approach:** TypeScript strict mode. All Tauri invoke wrappers are typed: `invoke<ReturnType>("command_name")`.

**IPC types:** TypeScript mirrors of Rust domain types live in `src/types/index.ts`. Must stay in sync with Rust definitions.

## Error Handling

**Rust:** Command handlers return `Result<T, String>` or `Result<T, tauri::Error>`. Errors propagate to frontend as rejected promises.

**Frontend:** Commands.ts wrappers return `Promise<T>` — callers handle errors via `.catch()` or `try/catch`.

## Comments/Documentation

**Style:** Inline comments explain WHY, not WHAT. Module-level comments in `mod.rs` files list the planned submodules (commented out until implemented).

**Invariants documented in CLAUDE.md:** Critical runtime invariants (deadlock prevention, IPC contract) are documented in the project CLAUDE.md for AI assistant context.

## Architecture Invariants (enforced by convention)

- `state.presentation.write().await` MUST be dropped before `app.emit()` — use explicit scope or `drop(guard)` before emit
- All frontend `invoke()` calls MUST go through `src/api/commands.ts` — no raw `invoke()` anywhere else
- Both windows listen to ALL events — no window-specific event filtering
- asset:// paths MUST be validated (canonical path starts with media_dir) before serving
