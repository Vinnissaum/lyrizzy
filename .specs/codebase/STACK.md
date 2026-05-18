# Tech Stack

**Analyzed:** 2026-05-18

## Core

- Framework: Tauri 2.x
- Language: Rust 1.82+ (backend), TypeScript 5.x (frontend)
- Runtime: WebView2 (OS-provided on Windows 10 1803+)
- Package manager: npm (frontend), Cargo (Rust)

## Frontend

- UI Framework: React 19.1.0 (note: package.json uses React 19 — TDD specifies 18.x)
- Styling: Tailwind CSS v4 via @tailwindcss/vite plugin
- State Management: Zustand 5.0.13
- Build tool: Vite 7.0.4
- Icons: Lucide React 1.16.0
- Drag-and-drop: @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0

## Backend (Rust)

- Desktop shell: tauri 2.x
- Async runtime: Tokio 1.x (features = "full")
- Serialization: serde 1.x + serde_json 1.x
- Database ORM: sqlx 0.8.x (runtime-tokio-native-tls, sqlite, migrate, macros)
- Tauri plugins: tauri-plugin-opener 2, tauri-plugin-dialog 2, tauri-plugin-shell 2

## Testing

- Unit/Integration (Rust): Rust built-in test framework + tokio-test (planned)
- Unit/Component (frontend): Vitest 2.1.9 + @testing-library/react 16.3.2 + @testing-library/jest-dom 6.9.1
- E2E: None planned for Phase 0

## Development Tools

- TypeScript: ~5.8.3
- @vitejs/plugin-react: 4.6.0
- @vitest/ui: 2.1.9
- tauri-build: 2.x (build dependency)
- tauri CLI: @tauri-apps/cli 2.x
