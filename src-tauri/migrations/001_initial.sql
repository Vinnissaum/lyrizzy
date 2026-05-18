-- migrations/001_initial.sql

CREATE TABLE songs (
  id             TEXT NOT NULL PRIMARY KEY,
  title          TEXT NOT NULL,
  artist         TEXT,
  ccli_number    TEXT,
  key_signature  TEXT,
  language       TEXT NOT NULL DEFAULT 'pt',
  notes          TEXT,
  background_id  TEXT REFERENCES media(id),
  slide_config   TEXT,   -- JSON: {maxLines, fontSize, fontFamily, textAlign, textColor}
  source         TEXT,   -- 'holyrics' for imported songs
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  deleted_at     INTEGER        -- soft delete (epoch ms)
);

CREATE TABLE song_sections (
  id           TEXT NOT NULL PRIMARY KEY,
  song_id      TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,   -- "Verse 1", "Chorus"
  type         TEXT NOT NULL,   -- verse|chorus|bridge|pre_chorus|outro|interlude|tag
  body         TEXT NOT NULL,
  sort_order   INTEGER NOT NULL,
  repeat_count INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE tags (
  id    TEXT NOT NULL PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE,
  color TEXT
);

CREATE TABLE song_tags (
  song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (song_id, tag_id)
);

CREATE TABLE media (
  id             TEXT NOT NULL PRIMARY KEY,
  file_path      TEXT NOT NULL,
  file_name      TEXT NOT NULL,
  media_type     TEXT NOT NULL,  -- image|video|url
  url            TEXT,
  mime_type      TEXT,
  duration_ms    INTEGER,
  width          INTEGER,
  height         INTEGER,
  thumbnail_path TEXT,
  created_at     INTEGER NOT NULL
);

CREATE TABLE sets (
  id           TEXT NOT NULL PRIMARY KEY,
  name         TEXT NOT NULL,
  service_date TEXT,  -- ISO date string
  notes        TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE set_items (
  id               TEXT NOT NULL PRIMARY KEY,
  set_id           TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  item_type        TEXT NOT NULL,  -- song|media|countdown|webview|blank
  song_id          TEXT REFERENCES songs(id),
  media_id         TEXT REFERENCES media(id),
  countdown_config TEXT,           -- JSON blob (CountdownConfig)
  web_url          TEXT,
  sort_order       INTEGER NOT NULL,
  notes            TEXT
);

CREATE TABLE settings (
  key   TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL
);

-- Full-text search
CREATE VIRTUAL TABLE songs_fts USING fts5(
  title, artist, body,
  content='songs',
  content_rowid='rowid'
);

CREATE TRIGGER songs_fts_insert AFTER INSERT ON songs BEGIN
  INSERT INTO songs_fts(rowid, title, artist, body) VALUES (new.rowid, new.title, new.artist, '');
END;
