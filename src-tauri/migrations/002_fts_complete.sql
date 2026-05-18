-- migration 002: complete FTS5 triggers and backfill
--
-- Replaces the incomplete songs_fts_insert trigger from 001 with a full
-- INSERT/UPDATE/DELETE trigger set on both songs and song_sections so that
-- songs_fts.body is always the '\n\n'-joined section bodies in sort_order.

-- Drop legacy trigger from migration 001
DROP TRIGGER IF EXISTS songs_fts_insert;

-- Recreate songs_fts as a standalone FTS5 table so that DELETE FROM songs_fts
-- works without the content= table complications.
DROP TABLE IF EXISTS songs_fts;
CREATE VIRTUAL TABLE songs_fts USING fts5(title, artist, body, tokenize='unicode61');

-- ── Triggers on songs ───────────────────────────────────────────────────────

CREATE TRIGGER songs_ai AFTER INSERT ON songs WHEN new.deleted_at IS NULL BEGIN
  INSERT INTO songs_fts(rowid, title, artist, body)
  VALUES (new.rowid, new.title, COALESCE(new.artist, ''), '');
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
    ), '')
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
    ), '')
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
    ), '')
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
    ), '')
  FROM songs s
  WHERE s.id = old.song_id AND s.deleted_at IS NULL;
END;

-- ── Backfill ─────────────────────────────────────────────────────────────────

INSERT INTO songs_fts(rowid, title, artist, body)
SELECT s.rowid, s.title, COALESCE(s.artist, ''),
  COALESCE((
    SELECT group_concat(ss.body, char(10) || char(10))
    FROM song_sections ss
    WHERE ss.song_id = s.id
    ORDER BY ss.sort_order
  ), '')
FROM songs s
WHERE s.deleted_at IS NULL;
