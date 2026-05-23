-- migration 007: Phase 8 — background presets + typography
--
-- Adds preset-mode background + font controls to song-level AND section-level.
-- Existing `background_id` + `scrim_opacity` continue to power media-backed mode.
-- Default mode = NULL = inherit/legacy media mode (no behaviour change for existing rows).

ALTER TABLE songs           ADD COLUMN background_mode    TEXT;  -- 'preset' | 'media' | NULL
ALTER TABLE songs           ADD COLUMN background_preset  TEXT;  -- 'preto-branco' | 'branco-preto' | NULL
ALTER TABLE songs           ADD COLUMN font_family        TEXT;  -- 'sans' | 'serif' | 'mono' | NULL
ALTER TABLE songs           ADD COLUMN font_size          TEXT;  -- 'sm' | 'md' | 'lg' | 'xl' | NULL

ALTER TABLE song_sections   ADD COLUMN background_mode    TEXT;
ALTER TABLE song_sections   ADD COLUMN background_preset  TEXT;
ALTER TABLE song_sections   ADD COLUMN font_family        TEXT;
ALTER TABLE song_sections   ADD COLUMN font_size          TEXT;
