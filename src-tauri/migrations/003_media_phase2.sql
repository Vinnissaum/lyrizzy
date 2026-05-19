-- migration 003: Phase 2 media schema extensions
--
-- Renames legacy media columns, adds Phase 2 payload columns to set_items,
-- adds scrim_opacity to songs, and seeds initial media indexes.
-- All ALTER TABLE ADD COLUMN are idempotent via IF NOT EXISTS pattern on SQLite
-- (SQLite does not support IF NOT EXISTS for ADD COLUMN, so migrations run exactly once
-- via sqlx::migrate! which tracks applied migrations).

-- ── media table ──────────────────────────────────────────────────────────────

-- Rename media_type → kind (SQLite 3.25+ RENAME COLUMN)
ALTER TABLE media RENAME COLUMN media_type TO kind;

-- Rename thumbnail_path → thumbnail_file
ALTER TABLE media RENAME COLUMN thumbnail_path TO thumbnail_file;

-- Add Phase 2 columns
ALTER TABLE media ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN byte_size    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media ADD COLUMN updated_at   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media ADD COLUMN deleted_at   INTEGER;

-- Backfill display_name from file_name for existing rows
UPDATE media SET display_name = file_name WHERE display_name = '';

-- Backfill updated_at from created_at for existing rows
UPDATE media SET updated_at = created_at WHERE updated_at = 0;

-- Indexes for filtered listing queries (kind + soft-delete + file name search)
CREATE INDEX IF NOT EXISTS idx_media_kind_deleted ON media(kind, deleted_at);
CREATE INDEX IF NOT EXISTS idx_media_file_name    ON media(file_name);

-- ── set_items table ──────────────────────────────────────────────────────────

-- Normalize old 'webview' item_type to the canonical 'web_view' snake_case value
UPDATE set_items SET item_type = 'web_view' WHERE item_type = 'webview';

-- Add Phase 2 JSON config columns
ALTER TABLE set_items ADD COLUMN webview_config TEXT;
ALTER TABLE set_items ADD COLUMN media_options  TEXT;

-- ── songs table ─────────────────────────────────────────────────────────────

-- Per-song scrim opacity for video/image backgrounds (0–100, default 35%)
ALTER TABLE songs ADD COLUMN scrim_opacity INTEGER NOT NULL DEFAULT 35;
