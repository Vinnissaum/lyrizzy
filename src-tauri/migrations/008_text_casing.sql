-- migration 008: per-song lyric text casing
--
-- Controls how lyric lines are cased when slides are generated.
-- NULL / 'normal' = unchanged, 'upper' = UPPERCASE, 'lower' = lowercase,
-- 'title' = Title Case. Applied in the Rust slide splitter, not stored on the body.

ALTER TABLE songs ADD COLUMN text_casing TEXT;  -- 'normal' | 'upper' | 'lower' | 'title' | NULL
