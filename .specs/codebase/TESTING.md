# Testing Infrastructure

## Test Frameworks

**Unit/Integration (Rust):** Built-in `#[test]` + `#[tokio::test]`; `sqlx::test` for DB integration tests (planned)
**Unit/Component (frontend):** Vitest 2.1.9 + @testing-library/react 16.3.2 + @testing-library/jest-dom 6.9.1
**E2E:** None planned for Phase 0

## Test Organization

**Rust tests:** Co-located in the same file as the source, in a `#[cfg(test)] mod tests { ... }` block.
**Frontend tests:** Co-located alongside source files or in `src/__tests__/` (no existing tests yet — greenfield).

## Testing Patterns

### Rust Unit Tests

**Approach:** `#[cfg(test)] mod tests` block at the bottom of each module file
**Location:** Same file as implementation (Rust convention)
**Pattern:** `assert_eq!`, `assert!`, `#[tokio::test]` for async

### Rust Integration Tests (planned)

**Approach:** `sqlx::test` attribute spins up an in-memory SQLite database per test
**Location:** `src-tauri/tests/` or inline with `#[cfg(test)]` in db/ modules
**Pattern:** `#[sqlx::test] async fn test_name(pool: sqlx::SqlitePool)`

### Frontend Unit Tests

**Approach:** Vitest with React Testing Library
**Location:** Co-located or `src/__tests__/`
**Pattern:** `describe/it/expect`, `render()` + `screen.getBy*()`

## Test Execution

**Commands:**

| Command | What it runs |
|---------|-------------|
| `cargo test --manifest-path src-tauri/Cargo.toml` | All Rust unit + integration tests |
| `npx vitest` | All frontend tests (watch mode) |
| `npx vitest run` | All frontend tests (single run, CI) |

## Coverage Targets

**Rust services/:** > 80% (per TDD)
**Frontend utilities/stores:** > 70% (per TDD)
**Current:** 0% (Phase 0 — establishing baseline)

## Test Coverage Matrix

| Code Layer | Required Test Type | Location Pattern | Run Command |
|---|---|---|---|
| `src-tauri/src/services/*.rs` | unit | Same file `#[cfg(test)]` | `cargo test --manifest-path src-tauri/Cargo.toml` |
| `src-tauri/src/domain/*.rs` | unit (pure types only) | Same file `#[cfg(test)]` | `cargo test --manifest-path src-tauri/Cargo.toml` |
| `src-tauri/src/db/*.rs` | integration (sqlx::test) | Same file `#[cfg(test)]` | `cargo test --manifest-path src-tauri/Cargo.toml` |
| `src-tauri/src/commands/*.rs` | none (tested via integration) | — | — |
| `src-tauri/src/lib.rs` | none (app wiring) | — | — |
| `src-tauri/src/protocol/*.rs` | unit | Same file `#[cfg(test)]` | `cargo test --manifest-path src-tauri/Cargo.toml` |
| `src/stores/*.ts` | unit | Co-located or `src/__tests__/` | `npx vitest run` |
| `src/utils/*.ts` | unit | Co-located or `src/__tests__/` | `npx vitest run` |
| `src/api/commands.ts` | none (thin wrappers) | — | — |
| `src/windows/**/*.tsx` | component | Co-located | `npx vitest run` |
| `src/components/**/*.tsx` | component | Co-located | `npx vitest run` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| Rust unit tests | Yes | No shared state; pure functions | Services are pure fn |
| Rust sqlx::test | Yes | Per-test in-memory SQLite DB | `sqlx::test` creates isolated pool per test |
| Frontend Vitest | Yes | Module mocks; no shared DOM state | Vitest runs each file in isolation by default |

## Gate Check Commands

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | After tasks with unit tests only | `cargo test --manifest-path src-tauri/Cargo.toml` or `npx vitest run` (whichever applies) |
| Full | After tasks touching both Rust + frontend | `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run` |
| Build | After phase completion or config-only tasks | `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run` (build gate = full test suite; `npm run tauri build` only on release) |
