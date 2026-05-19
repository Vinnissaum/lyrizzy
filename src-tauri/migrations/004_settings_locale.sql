-- migration 004: seed initial settings for locale and presentation transitions
--
-- INSERT OR IGNORE preserves any value the operator has already saved,
-- so running this migration twice is safe and idempotent.

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('app.locale',                   'pt-BR'),
  ('presentation.transition_ms',   '200'),
  ('presentation.reduce_motion',   'false');
