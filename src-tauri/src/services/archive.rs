/// Backup / restore service — exports and imports the full library as a `.tlz` archive.
///
/// `.tlz` is a regular ZIP file with a custom extension. Archive layout:
///   manifest.json          — schema version, export date, counts
///   data/songs.json        — all songs rows (including soft-deleted)
///   data/sections.json     — all song_sections rows
///   data/sets.json         — all sets rows
///   data/set_items.json    — all set_items rows
///   data/media.json        — all media rows (including soft-deleted)
///   data/settings.json     — all settings rows
///   media/<file_name>      — binary of every non-deleted media file
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

pub const SUPPORTED_SCHEMA_VERSION: u32 = 1;
pub const RESTORE_IN_PROGRESS_FLAG: &str = ".restore_in_progress";

/// Return type alias for `read_archive_data` to avoid complex-type lint.
type ArchiveReadResult = Result<(ArchiveJsonData, Vec<(String, Vec<u8>)>), ArchiveError>;

// ── Errors ───────────────────────────────────────────────────────────────────

#[derive(Debug)]
pub enum ArchiveError {
    Io(std::io::Error),
    Zip(zip::result::ZipError),
    Json(serde_json::Error),
    Db(sqlx::Error),
    SchemaTooNew { archive_version: u32 },
    InvalidArchive(String),
    JoinError(String),
}

impl std::fmt::Display for ArchiveError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(e) => write!(f, "Erro de E/S: {e}"),
            Self::Zip(e) => write!(f, "Erro ZIP: {e}"),
            Self::Json(e) => write!(f, "Erro JSON: {e}"),
            Self::Db(e) => write!(f, "Erro de banco de dados: {e}"),
            Self::SchemaTooNew { archive_version } => write!(
                f,
                "O arquivo requer esquema v{archive_version}; atualize o Trinity Lyrics para restaurar."
            ),
            Self::InvalidArchive(msg) => write!(f, "Arquivo inválido: {msg}"),
            Self::JoinError(msg) => write!(f, "Erro interno: {msg}"),
        }
    }
}

impl From<std::io::Error> for ArchiveError {
    fn from(e: std::io::Error) -> Self {
        Self::Io(e)
    }
}
impl From<zip::result::ZipError> for ArchiveError {
    fn from(e: zip::result::ZipError) -> Self {
        Self::Zip(e)
    }
}
impl From<serde_json::Error> for ArchiveError {
    fn from(e: serde_json::Error) -> Self {
        Self::Json(e)
    }
}
impl From<sqlx::Error> for ArchiveError {
    fn from(e: sqlx::Error) -> Self {
        Self::Db(e)
    }
}

// ── Public types ──────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveManifest {
    pub schema_version: u32,
    pub exported_at: i64,
    pub app_version: String,
    pub counts: ManifestCounts,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ManifestCounts {
    pub songs: u64,
    pub sections: u64,
    pub sets: u64,
    pub set_items: u64,
    pub media: u64,
    pub settings: u64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExportSummary {
    pub out_path: String,
    pub byte_size: u64,
    pub counts: ManifestCounts,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveInspection {
    pub schema_version: u32,
    pub exported_at: i64,
    pub app_version: String,
    pub counts: ManifestCounts,
}

#[derive(Serialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub songs_imported: u64,
    pub songs_skipped: u64,
    pub sections_imported: u64,
    pub sets_imported: u64,
    pub set_items_imported: u64,
    pub media_imported: u64,
    pub media_skipped: u64,
    pub media_failed: u64,
    pub settings_imported: u64,
}

#[derive(Deserialize, Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ImportMode {
    Replace,
    Merge,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgress {
    pub current_file: String,
    pub files_done: usize,
    pub files_total: usize,
}

// ── Internal snapshot type ────────────────────────────────────────────────────

struct JsonDump {
    manifest: ArchiveManifest,
    songs: String,
    sections: String,
    sets: String,
    set_items: String,
    media: String,
    settings: String,
    /// file_name values of every non-deleted media row (used for file copies)
    media_file_names: Vec<String>,
}

// ── Export ────────────────────────────────────────────────────────────────────

/// Export the full library to `out_path` (a `.tlz` archive).
///
/// DB queries run async; the ZIP write runs in `spawn_blocking` so the Tokio
/// thread is not blocked during I/O. Progress is reported via `on_progress`.
pub async fn export<F>(
    pool: &SqlitePool,
    media_dir: &Path,
    out_path: &Path,
    on_progress: F,
) -> Result<ExportSummary, ArchiveError>
where
    F: Fn(ExportProgress) + Send + 'static,
{
    let dump = gather_json_dump(pool).await?;
    let out = out_path.to_path_buf();
    let mdir = media_dir.to_path_buf();

    let summary = tokio::task::spawn_blocking(move || write_zip(&out, &mdir, dump, on_progress))
        .await
        .map_err(|e| ArchiveError::JoinError(e.to_string()))??;

    Ok(summary)
}

/// Read the manifest from a `.tlz` archive without fully extracting it.
pub fn inspect_archive(path: &Path) -> Result<ArchiveInspection, ArchiveError> {
    let file = File::open(path)?;
    let mut archive = ZipArchive::new(file)?;
    let manifest = read_manifest(&mut archive)?;
    if manifest.schema_version > SUPPORTED_SCHEMA_VERSION {
        return Err(ArchiveError::SchemaTooNew {
            archive_version: manifest.schema_version,
        });
    }
    Ok(ArchiveInspection {
        schema_version: manifest.schema_version,
        exported_at: manifest.exported_at,
        app_version: manifest.app_version,
        counts: manifest.counts,
    })
}

/// Import a `.tlz` archive in Replace or Merge mode.
///
/// Replace: wipes current library (DB + media files) then restores everything.
/// Merge: inserts only rows whose IDs don't already exist; copies only missing media files.
pub async fn import(
    pool: &SqlitePool,
    media_dir: &Path,
    path: &Path,
    mode: ImportMode,
) -> Result<ImportSummary, ArchiveError> {
    // Validate archive schema version before touching the DB
    let path_buf = path.to_path_buf();
    let inspection = tokio::task::spawn_blocking(move || inspect_archive(&path_buf))
        .await
        .map_err(|e| ArchiveError::JoinError(e.to_string()))??;

    if inspection.schema_version > SUPPORTED_SCHEMA_VERSION {
        return Err(ArchiveError::SchemaTooNew {
            archive_version: inspection.schema_version,
        });
    }

    if mode == ImportMode::Replace {
        // Write the flag before any destructive work
        let flag = media_dir.join(RESTORE_IN_PROGRESS_FLAG);
        fs::write(&flag, b"")?;

        // Wipe media files (keep the flag)
        if let Ok(entries) = fs::read_dir(media_dir) {
            for entry in entries.flatten() {
                if entry.file_name() != RESTORE_IN_PROGRESS_FLAG {
                    let _ = fs::remove_file(entry.path());
                }
            }
        }

        // Wipe DB tables in FK-safe order
        wipe_db(pool).await?;
    }

    // Extract archive data and insert into DB
    let path_buf = path.to_path_buf();
    let mdir = media_dir.to_path_buf();
    let pool_clone = pool.clone();

    let summary = do_import(pool_clone, mdir, path_buf, mode).await?;

    // Remove the in-progress flag (Replace mode only, but safe to always try)
    let flag = media_dir.join(RESTORE_IN_PROGRESS_FLAG);
    let _ = fs::remove_file(&flag);

    Ok(summary)
}

/// Hard-delete all tables in FK-safe order and clear the FTS index.
pub async fn wipe_db(pool: &SqlitePool) -> Result<(), ArchiveError> {
    sqlx::query("DELETE FROM set_items").execute(pool).await?;
    sqlx::query("DELETE FROM sets").execute(pool).await?;
    // songs has ON DELETE CASCADE → song_sections and song_tags are cascade-deleted
    sqlx::query("DELETE FROM songs").execute(pool).await?;
    sqlx::query("DELETE FROM media").execute(pool).await?;
    sqlx::query("DELETE FROM settings").execute(pool).await?;
    // Rebuild FTS after wiping songs
    sqlx::query("INSERT INTO songs_fts(songs_fts) VALUES('rebuild')")
        .execute(pool)
        .await?;
    Ok(())
}

// ── Private helpers ───────────────────────────────────────────────────────────

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

async fn fetch_json_array(pool: &SqlitePool, sql: &str) -> Result<String, ArchiveError> {
    let result: Option<String> = sqlx::query_scalar(sql).fetch_optional(pool).await?;
    Ok(result.unwrap_or_else(|| "[]".to_string()))
}

fn count_json_array(json: &str) -> u64 {
    serde_json::from_str::<serde_json::Value>(json)
        .ok()
        .and_then(|v| if let serde_json::Value::Array(a) = v { Some(a.len() as u64) } else { None })
        .unwrap_or(0)
}

async fn gather_json_dump(pool: &SqlitePool) -> Result<JsonDump, ArchiveError> {
    let songs = fetch_json_array(pool,
        "SELECT COALESCE(json_group_array(json_object(\
            'id', id, 'title', title, 'artist', artist, 'ccli_number', ccli_number, \
            'key_signature', key_signature, 'language', language, 'notes', notes, \
            'background_id', background_id, 'slide_config', slide_config, 'source', source, \
            'scrim_opacity', scrim_opacity, 'created_at', created_at, \
            'updated_at', updated_at, 'deleted_at', deleted_at)), '[]') FROM songs",
    ).await?;

    let sections = fetch_json_array(pool,
        "SELECT COALESCE(json_group_array(json_object(\
            'id', id, 'song_id', song_id, 'label', label, 'type', type, \
            'body', body, 'sort_order', sort_order, 'repeat_count', repeat_count)), '[]') \
         FROM song_sections",
    ).await?;

    let sets = fetch_json_array(pool,
        "SELECT COALESCE(json_group_array(json_object(\
            'id', id, 'name', name, 'service_date', service_date, 'notes', notes, \
            'created_at', created_at, 'updated_at', updated_at)), '[]') FROM sets",
    ).await?;

    let set_items = fetch_json_array(pool,
        "SELECT COALESCE(json_group_array(json_object(\
            'id', id, 'set_id', set_id, 'item_type', item_type, 'song_id', song_id, \
            'media_id', media_id, 'countdown_config', countdown_config, 'web_url', web_url, \
            'sort_order', sort_order, 'notes', notes, 'webview_config', webview_config, \
            'media_options', media_options)), '[]') FROM set_items",
    ).await?;

    let media = fetch_json_array(pool,
        "SELECT COALESCE(json_group_array(json_object(\
            'id', id, 'file_path', file_path, 'file_name', file_name, 'kind', kind, \
            'url', url, 'mime_type', mime_type, 'duration_ms', duration_ms, \
            'width', width, 'height', height, 'thumbnail_file', thumbnail_file, \
            'created_at', created_at, 'display_name', display_name, 'byte_size', byte_size, \
            'updated_at', updated_at, 'deleted_at', deleted_at)), '[]') FROM media",
    ).await?;

    let settings = fetch_json_array(pool,
        "SELECT COALESCE(json_group_array(json_object('key', key, 'value', value)), '[]') \
         FROM settings",
    ).await?;

    let media_file_names: Vec<String> =
        sqlx::query_scalar("SELECT file_name FROM media WHERE deleted_at IS NULL")
            .fetch_all(pool)
            .await?;

    let counts = ManifestCounts {
        songs: count_json_array(&songs),
        sections: count_json_array(&sections),
        sets: count_json_array(&sets),
        set_items: count_json_array(&set_items),
        media: count_json_array(&media),
        settings: count_json_array(&settings),
    };

    let manifest = ArchiveManifest {
        schema_version: SUPPORTED_SCHEMA_VERSION,
        exported_at: now_ms(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        counts,
    };

    Ok(JsonDump { manifest, songs, sections, sets, set_items, media, settings, media_file_names })
}

fn write_zip<F>(
    out_path: &Path,
    media_dir: &Path,
    dump: JsonDump,
    on_progress: F,
) -> Result<ExportSummary, ArchiveError>
where
    F: Fn(ExportProgress),
{
    let tmp = out_path.with_extension("tlz.tmp");

    // Write to a temp file; rename atomically on success
    {
        let file = File::create(&tmp)?;
        let mut zip = ZipWriter::new(file);
        let opts = SimpleFileOptions::default()
            .compression_method(CompressionMethod::Deflated)
            .compression_level(Some(6));

        // manifest
        zip.start_file("manifest.json", opts)?;
        zip.write_all(&serde_json::to_vec(&dump.manifest)?)?;

        // data/*.json
        let data_entries: &[(&str, &str)] = &[
            ("data/songs.json", &dump.songs),
            ("data/sections.json", &dump.sections),
            ("data/sets.json", &dump.sets),
            ("data/set_items.json", &dump.set_items),
            ("data/media.json", &dump.media),
            ("data/settings.json", &dump.settings),
        ];
        for (name, json) in data_entries {
            zip.start_file(*name, opts)?;
            zip.write_all(json.as_bytes())?;
        }

        // media files
        let total_entries = 7 + dump.media_file_names.len(); // 1 manifest + 6 data + media
        for (i, file_name) in dump.media_file_names.iter().enumerate() {
            on_progress(ExportProgress {
                current_file: file_name.clone(),
                files_done: 7 + i,
                files_total: total_entries,
            });

            let src = media_dir.join(file_name);
            if let Ok(mut src_file) = File::open(&src) {
                let entry_name = format!("media/{file_name}");
                zip.start_file(&entry_name, opts)?;
                let mut buf = Vec::new();
                src_file.read_to_end(&mut buf)?;
                zip.write_all(&buf)?;
            }
            // Missing file: skip silently (soft-deleted rows still have file_name)
        }

        zip.finish()?;
    }

    // Atomic rename
    if out_path.exists() {
        fs::remove_file(out_path)?;
    }
    fs::rename(&tmp, out_path)?;

    let byte_size = fs::metadata(out_path).map(|m| m.len()).unwrap_or(0);
    Ok(ExportSummary {
        out_path: out_path.to_string_lossy().to_string(),
        byte_size,
        counts: dump.manifest.counts,
    })
}

fn read_manifest(archive: &mut ZipArchive<File>) -> Result<ArchiveManifest, ArchiveError> {
    let mut entry = archive.by_name("manifest.json").map_err(|_| {
        ArchiveError::InvalidArchive("manifest.json não encontrado".to_string())
    })?;
    let mut buf = String::new();
    entry.read_to_string(&mut buf)?;
    serde_json::from_str::<ArchiveManifest>(&buf).map_err(|_| {
        ArchiveError::InvalidArchive("manifest.json inválido".to_string())
    })
}

async fn do_import(
    pool: SqlitePool,
    media_dir: PathBuf,
    path: PathBuf,
    mode: ImportMode,
) -> Result<ImportSummary, ArchiveError> {
    // Read archive JSON and media files in spawn_blocking
    let (json_data, media_entries) =
        tokio::task::spawn_blocking(move || read_archive_data(&path))
            .await
            .map_err(|e| ArchiveError::JoinError(e.to_string()))??;

    let mut summary = ImportSummary::default();
    let insert_or = if mode == ImportMode::Replace { "INSERT" } else { "INSERT OR IGNORE" };

    // Settings
    if let Ok(rows) = parse_json_array(&json_data.settings) {
        for row in &rows {
            let key = str_val(row, "key");
            let val = str_val(row, "value");
            if key.is_some() && val.is_some() {
                let q = format!("{insert_or} INTO settings (key, value) VALUES (?, ?)");
                if sqlx::query(&q).bind(key).bind(val).execute(&pool).await.is_ok() {
                    summary.settings_imported += 1;
                }
            }
        }
    }

    // Media rows (before songs — songs.background_id FK)
    if let Ok(rows) = parse_json_array(&json_data.media) {
        for row in &rows {
            let q = format!(
                "{insert_or} INTO media \
                 (id, file_path, file_name, kind, url, mime_type, duration_ms, width, height, \
                  thumbnail_file, created_at, display_name, byte_size, updated_at, deleted_at) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            if sqlx::query(&q)
                .bind(str_val(row, "id"))
                .bind(str_val(row, "file_path"))
                .bind(str_val(row, "file_name"))
                .bind(str_val(row, "kind"))
                .bind(str_val(row, "url"))
                .bind(str_val(row, "mime_type"))
                .bind(int_val(row, "duration_ms"))
                .bind(int_val(row, "width"))
                .bind(int_val(row, "height"))
                .bind(str_val(row, "thumbnail_file"))
                .bind(int_val(row, "created_at").unwrap_or(0))
                .bind(str_val(row, "display_name"))
                .bind(int_val(row, "byte_size").unwrap_or(0))
                .bind(int_val(row, "updated_at").unwrap_or(0))
                .bind(int_val(row, "deleted_at"))
                .execute(&pool)
                .await
                .is_ok()
            {
                summary.media_imported += 1;
            } else {
                summary.media_skipped += 1;
            }
        }
    }

    // Songs
    if let Ok(rows) = parse_json_array(&json_data.songs) {
        for row in &rows {
            let q = format!(
                "{insert_or} INTO songs \
                 (id, title, artist, ccli_number, key_signature, language, notes, \
                  background_id, slide_config, source, scrim_opacity, created_at, updated_at, deleted_at) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            if sqlx::query(&q)
                .bind(str_val(row, "id"))
                .bind(str_val(row, "title"))
                .bind(str_val(row, "artist"))
                .bind(str_val(row, "ccli_number"))
                .bind(str_val(row, "key_signature"))
                .bind(str_val(row, "language"))
                .bind(str_val(row, "notes"))
                .bind(str_val(row, "background_id"))
                .bind(str_val(row, "slide_config"))
                .bind(str_val(row, "source"))
                .bind(int_val(row, "scrim_opacity").unwrap_or(35))
                .bind(int_val(row, "created_at").unwrap_or(0))
                .bind(int_val(row, "updated_at").unwrap_or(0))
                .bind(int_val(row, "deleted_at"))
                .execute(&pool)
                .await
                .is_ok()
            {
                summary.songs_imported += 1;
            } else {
                summary.songs_skipped += 1;
            }
        }
    }

    // Sections
    if let Ok(rows) = parse_json_array(&json_data.sections) {
        for row in &rows {
            let q = format!(
                "{insert_or} INTO song_sections \
                 (id, song_id, label, type, body, sort_order, repeat_count) \
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            if sqlx::query(&q)
                .bind(str_val(row, "id"))
                .bind(str_val(row, "song_id"))
                .bind(str_val(row, "label"))
                .bind(str_val(row, "type"))
                .bind(str_val(row, "body"))
                .bind(int_val(row, "sort_order").unwrap_or(0))
                .bind(int_val(row, "repeat_count").unwrap_or(1))
                .execute(&pool)
                .await
                .is_ok()
            {
                summary.sections_imported += 1;
            }
        }
    }

    // Sets
    if let Ok(rows) = parse_json_array(&json_data.sets) {
        for row in &rows {
            let q = format!(
                "{insert_or} INTO sets (id, name, service_date, notes, created_at, updated_at) \
                 VALUES (?, ?, ?, ?, ?, ?)"
            );
            if sqlx::query(&q)
                .bind(str_val(row, "id"))
                .bind(str_val(row, "name"))
                .bind(str_val(row, "service_date"))
                .bind(str_val(row, "notes"))
                .bind(int_val(row, "created_at").unwrap_or(0))
                .bind(int_val(row, "updated_at").unwrap_or(0))
                .execute(&pool)
                .await
                .is_ok()
            {
                summary.sets_imported += 1;
            }
        }
    }

    // Set items
    if let Ok(rows) = parse_json_array(&json_data.set_items) {
        for row in &rows {
            let q = format!(
                "{insert_or} INTO set_items \
                 (id, set_id, item_type, song_id, media_id, countdown_config, web_url, \
                  sort_order, notes, webview_config, media_options) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            if sqlx::query(&q)
                .bind(str_val(row, "id"))
                .bind(str_val(row, "set_id"))
                .bind(str_val(row, "item_type"))
                .bind(str_val(row, "song_id"))
                .bind(str_val(row, "media_id"))
                .bind(str_val(row, "countdown_config"))
                .bind(str_val(row, "web_url"))
                .bind(int_val(row, "sort_order").unwrap_or(0))
                .bind(str_val(row, "notes"))
                .bind(str_val(row, "webview_config"))
                .bind(str_val(row, "media_options"))
                .execute(&pool)
                .await
                .is_ok()
            {
                summary.set_items_imported += 1;
            }
        }
    }

    // Rebuild FTS after all songs are inserted
    let _ = sqlx::query("INSERT INTO songs_fts(songs_fts) VALUES('rebuild')")
        .execute(&pool)
        .await;

    // Copy media files from archive to media_dir
    let mdir = media_dir.clone();
    for (file_name, data) in media_entries {
        let dest = mdir.join(&file_name);
        if mode == ImportMode::Merge && dest.exists() {
            summary.media_skipped += 1;
            continue;
        }
        match fs::write(&dest, &data) {
            Ok(_) => {}
            Err(_) => {
                summary.media_failed += 1;
            }
        }
    }

    Ok(summary)
}

// ── Archive read helpers ──────────────────────────────────────────────────────

struct ArchiveJsonData {
    songs: String,
    sections: String,
    sets: String,
    set_items: String,
    media: String,
    settings: String,
}

fn read_archive_data(
    path: &Path,
) -> ArchiveReadResult {
    let file = File::open(path)?;
    let mut archive = ZipArchive::new(file)?;

    let songs = read_zip_entry_str(&mut archive, "data/songs.json")?;
    let sections = read_zip_entry_str(&mut archive, "data/sections.json")?;
    let sets = read_zip_entry_str(&mut archive, "data/sets.json")?;
    let set_items = read_zip_entry_str(&mut archive, "data/set_items.json")?;
    let media = read_zip_entry_str(&mut archive, "data/media.json")?;
    let settings = read_zip_entry_str(&mut archive, "data/settings.json")?;

    // Collect media file entries
    let mut media_files: Vec<(String, Vec<u8>)> = Vec::new();
    for i in 0..archive.len() {
        if let Ok(mut entry) = archive.by_index(i) {
            let name = entry.name().to_string();
            if name.starts_with("media/") && name.len() > 6 {
                let file_name = name[6..].to_string();
                let mut data = Vec::new();
                if entry.read_to_end(&mut data).is_ok() {
                    media_files.push((file_name, data));
                }
            }
        }
    }

    Ok((
        ArchiveJsonData { songs, sections, sets, set_items, media, settings },
        media_files,
    ))
}

fn read_zip_entry_str(archive: &mut ZipArchive<File>, name: &str) -> Result<String, ArchiveError> {
    match archive.by_name(name) {
        Ok(mut entry) => {
            let mut buf = String::new();
            entry.read_to_string(&mut buf)?;
            Ok(buf)
        }
        Err(_) => Ok("[]".to_string()), // Missing entry → treat as empty
    }
}

// ── JSON row helpers ──────────────────────────────────────────────────────────

type JsonRow = serde_json::Map<String, serde_json::Value>;

fn parse_json_array(json: &str) -> Result<Vec<JsonRow>, serde_json::Error> {
    let val: serde_json::Value = serde_json::from_str(json)?;
    Ok(match val {
        serde_json::Value::Array(arr) => arr
            .into_iter()
            .filter_map(|v| {
                if let serde_json::Value::Object(m) = v { Some(m) } else { None }
            })
            .collect(),
        _ => Vec::new(),
    })
}

fn str_val(row: &JsonRow, key: &str) -> Option<String> {
    match row.get(key) {
        Some(serde_json::Value::String(s)) => Some(s.clone()),
        Some(serde_json::Value::Number(n)) => Some(n.to_string()),
        _ => None,
    }
}

fn int_val(row: &JsonRow, key: &str) -> Option<i64> {
    match row.get(key) {
        Some(serde_json::Value::Number(n)) => n.as_i64(),
        Some(serde_json::Value::String(s)) => s.parse::<i64>().ok(),
        _ => None,
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqliteConnectOptions;
    use std::str::FromStr;
    use tempfile::TempDir;

    async fn make_test_pool() -> (SqlitePool, TempDir) {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let opts = SqliteConnectOptions::from_str(&format!(
            "sqlite://{}?mode=rwc",
            db_path.to_string_lossy()
        ))
        .unwrap()
        .create_if_missing(true);
        let pool = SqlitePool::connect_with(opts).await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        (pool, dir)
    }

    #[tokio::test]
    async fn export_empty_db_produces_valid_archive() {
        let (pool, dir) = make_test_pool().await;
        let media_dir = dir.path().join("media");
        fs::create_dir_all(&media_dir).unwrap();
        let out = dir.path().join("backup.tlz");

        let summary = export(&pool, &media_dir, &out, |_| {}).await.unwrap();
        assert!(out.exists());
        assert!(summary.byte_size > 0);
        assert_eq!(summary.counts.songs, 0);
        assert_eq!(summary.counts.media, 0);
    }

    #[tokio::test]
    async fn inspect_archive_reads_manifest() {
        let (pool, dir) = make_test_pool().await;
        let media_dir = dir.path().join("media");
        fs::create_dir_all(&media_dir).unwrap();
        let out = dir.path().join("backup.tlz");

        export(&pool, &media_dir, &out, |_| {}).await.unwrap();

        let inspection = inspect_archive(&out).unwrap();
        assert_eq!(inspection.schema_version, SUPPORTED_SCHEMA_VERSION);
        assert_eq!(inspection.counts.songs, 0);
    }

    #[tokio::test]
    async fn round_trip_songs_and_settings() {
        let (pool, dir) = make_test_pool().await;
        let media_dir = dir.path().join("media");
        fs::create_dir_all(&media_dir).unwrap();

        // Insert a song and a setting
        let now = now_ms();
        sqlx::query("INSERT INTO songs (id, title, language, created_at, updated_at) VALUES ('s1', 'Test Song', 'pt', ?, ?)")
            .bind(now).bind(now).execute(&pool).await.unwrap();
        sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('test.key', 'hello')")
            .execute(&pool).await.unwrap();

        let out = dir.path().join("backup.tlz");
        let summary = export(&pool, &media_dir, &out, |_| {}).await.unwrap();
        assert_eq!(summary.counts.songs, 1);
        assert!(summary.counts.settings >= 1);

        // Restore into a fresh DB
        let (pool2, dir2) = make_test_pool().await;
        let media_dir2 = dir2.path().join("media");
        fs::create_dir_all(&media_dir2).unwrap();

        let imp = import(&pool2, &media_dir2, &out, ImportMode::Replace).await.unwrap();
        assert!(imp.songs_imported >= 1);

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM songs WHERE id = 's1'")
            .fetch_one(&pool2).await.unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn merge_mode_skips_existing_ids() {
        let (pool, dir) = make_test_pool().await;
        let media_dir = dir.path().join("media");
        fs::create_dir_all(&media_dir).unwrap();

        let now = now_ms();
        sqlx::query("INSERT INTO songs (id, title, language, created_at, updated_at) VALUES ('s1', 'Original', 'pt', ?, ?)")
            .bind(now).bind(now).execute(&pool).await.unwrap();

        let out = dir.path().join("backup.tlz");
        export(&pool, &media_dir, &out, |_| {}).await.unwrap();

        // Pre-populate target DB with the same id
        let (pool2, dir2) = make_test_pool().await;
        let media_dir2 = dir2.path().join("media");
        fs::create_dir_all(&media_dir2).unwrap();

        sqlx::query("INSERT INTO songs (id, title, language, created_at, updated_at) VALUES ('s1', 'Existing', 'pt', ?, ?)")
            .bind(now).bind(now).execute(&pool2).await.unwrap();

        import(&pool2, &media_dir2, &out, ImportMode::Merge).await.unwrap();

        // Title should NOT be overwritten in merge mode
        let title: String = sqlx::query_scalar("SELECT title FROM songs WHERE id = 's1'")
            .fetch_one(&pool2).await.unwrap();
        assert_eq!(title, "Existing");
    }
}
