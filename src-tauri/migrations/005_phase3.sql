-- migration 005: Phase 3 schema additions
--
-- Adds: section-level notes + background, CCLI metadata columns on songs,
-- song_plays ledger, updated FTS triggers to include author, and new settings rows.
-- All INSERT OR IGNORE statements are idempotent on re-run.

-- ── song_sections: notes + section background ────────────────────────────────

ALTER TABLE song_sections ADD COLUMN notes TEXT;
ALTER TABLE song_sections ADD COLUMN background_id TEXT REFERENCES media(id) ON DELETE SET NULL;

-- ── songs: CCLI metadata ─────────────────────────────────────────────────────

ALTER TABLE songs ADD COLUMN author    TEXT;
ALTER TABLE songs ADD COLUMN copyright TEXT;

-- ── song_plays ledger ────────────────────────────────────────────────────────

CREATE TABLE song_plays (
    id         TEXT    NOT NULL PRIMARY KEY,
    song_id    TEXT    NOT NULL REFERENCES songs(id),
    set_id     TEXT    NOT NULL REFERENCES sets(id),
    played_on  TEXT    NOT NULL,  -- YYYY-MM-DD (operator local date at set-start)
    created_at INTEGER NOT NULL
);

-- Unique index enforces per-day idempotency: starting the same set twice on the
-- same calendar day must not produce duplicate rows.
CREATE UNIQUE INDEX idx_song_plays_unique   ON song_plays(song_id, set_id, played_on);
-- Lookup index for date-range CSV export queries.
CREATE        INDEX idx_song_plays_played_on ON song_plays(played_on);

-- ── FTS triggers: add author to body ────────────────────────────────────────
--
-- Drop the existing trigger set from migration 002, then recreate with
-- `COALESCE(author, '')` appended to the body so author is searchable.

DROP TRIGGER IF EXISTS songs_ai;
DROP TRIGGER IF EXISTS songs_au;
DROP TRIGGER IF EXISTS songs_ad;
DROP TRIGGER IF EXISTS song_sections_ai;
DROP TRIGGER IF EXISTS song_sections_au;
DROP TRIGGER IF EXISTS song_sections_ad;

-- ── Triggers on songs ────────────────────────────────────────────────────────

CREATE TRIGGER songs_ai AFTER INSERT ON songs WHEN new.deleted_at IS NULL BEGIN
    INSERT INTO songs_fts(rowid, title, artist, body)
    VALUES (new.rowid, new.title, COALESCE(new.artist, ''), COALESCE(new.author, ''));
END;

CREATE TRIGGER songs_au AFTER UPDATE ON songs BEGIN
    DELETE FROM songs_fts WHERE rowid = old.rowid;
    INSERT INTO songs_fts(rowid, title, artist, body)
    SELECT new.rowid, new.title, COALESCE(new.artist, ''),
        COALESCE((
            SELECT group_concat(ss.body, char(10) || char(10))
            FROM song_sections ss
            WHERE ss.song_id = new.id
            ORDER BY ss.sort_order
        ), '') ||
        CASE WHEN COALESCE(new.author, '') != '' THEN char(10) || new.author ELSE '' END
    WHERE new.deleted_at IS NULL;
END;

CREATE TRIGGER songs_ad AFTER DELETE ON songs BEGIN
    DELETE FROM songs_fts WHERE rowid = old.rowid;
END;

-- ── Triggers on song_sections ────────────────────────────────────────────────

CREATE TRIGGER song_sections_ai AFTER INSERT ON song_sections BEGIN
    DELETE FROM songs_fts
    WHERE rowid = (SELECT rowid FROM songs WHERE id = new.song_id);
    INSERT INTO songs_fts(rowid, title, artist, body)
    SELECT s.rowid, s.title, COALESCE(s.artist, ''),
        COALESCE((
            SELECT group_concat(ss.body, char(10) || char(10))
            FROM song_sections ss
            WHERE ss.song_id = s.id
            ORDER BY ss.sort_order
        ), '') ||
        CASE WHEN COALESCE(s.author, '') != '' THEN char(10) || s.author ELSE '' END
    FROM songs s
    WHERE s.id = new.song_id AND s.deleted_at IS NULL;
END;

CREATE TRIGGER song_sections_au AFTER UPDATE ON song_sections BEGIN
    DELETE FROM songs_fts
    WHERE rowid = (SELECT rowid FROM songs WHERE id = new.song_id);
    INSERT INTO songs_fts(rowid, title, artist, body)
    SELECT s.rowid, s.title, COALESCE(s.artist, ''),
        COALESCE((
            SELECT group_concat(ss.body, char(10) || char(10))
            FROM song_sections ss
            WHERE ss.song_id = s.id
            ORDER BY ss.sort_order
        ), '') ||
        CASE WHEN COALESCE(s.author, '') != '' THEN char(10) || s.author ELSE '' END
    FROM songs s
    WHERE s.id = new.song_id AND s.deleted_at IS NULL;
END;

CREATE TRIGGER song_sections_ad AFTER DELETE ON song_sections BEGIN
    DELETE FROM songs_fts
    WHERE rowid = (SELECT rowid FROM songs WHERE id = old.song_id);
    INSERT INTO songs_fts(rowid, title, artist, body)
    SELECT s.rowid, s.title, COALESCE(s.artist, ''),
        COALESCE((
            SELECT group_concat(ss.body, char(10) || char(10))
            FROM song_sections ss
            WHERE ss.song_id = s.id
            ORDER BY ss.sort_order
        ), '') ||
        CASE WHEN COALESCE(s.author, '') != '' THEN char(10) || s.author ELSE '' END
    FROM songs s
    WHERE s.id = old.song_id AND s.deleted_at IS NULL;
END;

-- ── Settings defaults ────────────────────────────────────────────────────────
--
-- INSERT OR IGNORE preserves any value the operator has already saved.

INSERT OR IGNORE INTO settings (key, value) VALUES
    ('theme',                      'light'),
    ('key_bindings',               '{"bindings":{"advanceSlide":[{"key":" ","ctrl":false,"shift":false,"alt":false},{"key":"ArrowRight","ctrl":false,"shift":false,"alt":false}],"previousSlide":[{"key":"ArrowLeft","ctrl":false,"shift":false,"alt":false}],"blank":[{"key":"b","ctrl":false,"shift":false,"alt":false}],"freeze":[{"key":"f","ctrl":false,"shift":false,"alt":false}],"exitPresentation":[{"key":"Escape","ctrl":false,"shift":false,"alt":false}],"jumpToItem1":[{"key":"1","ctrl":false,"shift":false,"alt":false}],"jumpToItem2":[{"key":"2","ctrl":false,"shift":false,"alt":false}],"jumpToItem3":[{"key":"3","ctrl":false,"shift":false,"alt":false}],"jumpToItem4":[{"key":"4","ctrl":false,"shift":false,"alt":false}],"jumpToItem5":[{"key":"5","ctrl":false,"shift":false,"alt":false}],"jumpToItem6":[{"key":"6","ctrl":false,"shift":false,"alt":false}],"jumpToItem7":[{"key":"7","ctrl":false,"shift":false,"alt":false}],"jumpToItem8":[{"key":"8","ctrl":false,"shift":false,"alt":false}],"jumpToItem9":[{"key":"9","ctrl":false,"shift":false,"alt":false}],"countdownPause":[{"key":"p","ctrl":false,"shift":false,"alt":false}],"openPresentationWindow":[{"key":"p","ctrl":true,"shift":false,"alt":false}],"focusSearch":[{"key":"f","ctrl":true,"shift":false,"alt":false}]}}'),
    ('last_update_check',          ''),
    ('ui.notes_panel_collapsed',   'false'),
    ('window.presentation.monitor',''),
    ('window.stage.monitor',       '');
