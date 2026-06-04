//! Selective export/import of native artifacts (songs, sets, settings) as scoped
//! `.tlz` files. This path is **additive** to the full-library backup in
//! `archive.rs` and — unlike the legacy restore — NEVER wipes the target library
//! (SHARE-08). It reuses every serializer / bind helper / ZIP routine promoted to
//! `pub(crate)` in `archive.rs`, so the two paths can never drift apart.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use serde::{Deserialize, Serialize};
use sqlx::{SqliteConnection, SqlitePool};

use crate::commands::song::new_id;
use crate::services::archive::{
    self, bind_media, bind_section, bind_set, bind_set_item, bind_song, media_insert_sql,
    normalize_title, now_ms, parse_json_array, read_archive_data, read_archive_manifest,
    section_insert_sql, set_insert_sql, set_item_insert_sql, song_insert_sql, str_val, write_tlz,
    ArchiveError, ArchiveKind, ArchiveManifest, ExportProgress, ExportSummary, ImportSummary,
    JsonDump, JsonRow, ManifestCounts, MEDIA_JSON_OBJECT, SECTION_JSON_OBJECT, SETTINGS_JSON_OBJECT,
    SET_ITEM_JSON_OBJECT, SET_JSON_OBJECT, SONG_JSON_OBJECT,
};

// ── Plan / resolution types ────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ResolutionAction {
    Skip,
    Overwrite,
    Copy,
}

#[derive(Serialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ConflictKind {
    SameId,
    SameTitleArtist,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportPlanItem {
    /// "song" | "set" | "media"
    pub artifact_type: String,
    pub id: String,
    pub title: String,
    /// `None` = no collision with anything in the target library.
    pub conflict: Option<ConflictKind>,
    pub default_action: ResolutionAction,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportPlan {
    pub kind: ArchiveKind,
    pub schema_version: u32,
    pub counts: ManifestCounts,
    pub items: Vec<ImportPlanItem>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Resolution {
    pub id: String,
    pub action: ResolutionAction,
}

// ── Small query helpers ─────────────────────────────────────────────────────────

fn placeholders(n: usize) -> String {
    std::iter::repeat_n("?", n).collect::<Vec<_>>().join(",")
}

/// `SELECT json_group_array(<json_object>) FROM <table> WHERE <col> IN (ids…)`.
/// Returns `"[]"` for an empty id list (avoids invalid `IN ()` SQL).
async fn fetch_rows_in(
    pool: &SqlitePool,
    json_object: &str,
    table: &str,
    col: &str,
    ids: &[String],
) -> Result<String, ArchiveError> {
    if ids.is_empty() {
        return Ok("[]".to_string());
    }
    let ph = placeholders(ids.len());
    let sql = format!(
        "SELECT COALESCE(json_group_array({json_object}), '[]') FROM {table} WHERE {col} IN ({ph})"
    );
    let mut q = sqlx::query_scalar::<_, Option<String>>(&sql);
    for id in ids {
        q = q.bind(id);
    }
    Ok(q.fetch_one(pool).await?.unwrap_or_else(|| "[]".to_string()))
}

/// Scalar `SELECT <col> FROM <table> WHERE <key> IN (ids…)` returning distinct? no —
/// raw values. Used for id/file-name lookups. Empty id list → empty vec.
async fn scalar_in(
    pool: &SqlitePool,
    select: &str,
    table: &str,
    key: &str,
    ids: &[String],
) -> Result<Vec<String>, ArchiveError> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let ph = placeholders(ids.len());
    let sql = format!("SELECT {select} FROM {table} WHERE {key} IN ({ph})");
    let mut q = sqlx::query_scalar::<_, String>(&sql);
    for id in ids {
        q = q.bind(id);
    }
    Ok(q.fetch_all(pool).await?)
}

fn count(json: &str) -> u64 {
    parse_json_array(json).map(|v| v.len() as u64).unwrap_or(0)
}

#[allow(clippy::too_many_arguments)]
fn build_dump(
    kind: ArchiveKind,
    songs: String,
    sections: String,
    sets: String,
    set_items: String,
    media: String,
    settings: String,
    media_file_names: Vec<String>,
) -> JsonDump {
    let counts = ManifestCounts {
        songs: count(&songs),
        sections: count(&sections),
        sets: count(&sets),
        set_items: count(&set_items),
        media: count(&media),
        settings: count(&settings),
    };
    let manifest = ArchiveManifest {
        schema_version: archive::SUPPORTED_SCHEMA_VERSION,
        kind,
        exported_at: now_ms(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        counts,
    };
    JsonDump { manifest, songs, sections, sets, set_items, media, settings, media_file_names }
}

async fn write_artifact<F>(
    out: &Path,
    media_dir: &Path,
    dump: JsonDump,
    kind: ArchiveKind,
    on_progress: F,
) -> Result<ExportSummary, ArchiveError>
where
    F: Fn(ExportProgress) + Send + 'static,
{
    let out = out.to_path_buf();
    let mdir = media_dir.to_path_buf();
    tokio::task::spawn_blocking(move || write_tlz(&out, &mdir, dump, kind, on_progress))
        .await
        .map_err(|e| ArchiveError::JoinError(e.to_string()))?
}

/// Distinct media ids backing the given songs (`background_id`, media mode).
async fn background_media_ids(
    pool: &SqlitePool,
    song_ids: &[String],
) -> Result<Vec<String>, ArchiveError> {
    if song_ids.is_empty() {
        return Ok(Vec::new());
    }
    let ph = placeholders(song_ids.len());
    let sql = format!(
        "SELECT DISTINCT background_id FROM songs \
         WHERE id IN ({ph}) AND background_id IS NOT NULL"
    );
    let mut q = sqlx::query_scalar::<_, String>(&sql);
    for id in song_ids {
        q = q.bind(id);
    }
    Ok(q.fetch_all(pool).await?)
}

// ── Export (T2) ─────────────────────────────────────────────────────────────────

/// SHARE-01/02/03 — export selected songs (+ sections + media-backed backgrounds).
pub async fn export_songs<F>(
    pool: &SqlitePool,
    media_dir: &Path,
    ids: &[String],
    out: &Path,
    on_progress: F,
) -> Result<ExportSummary, ArchiveError>
where
    F: Fn(ExportProgress) + Send + 'static,
{
    if ids.is_empty() {
        return Err(ArchiveError::InvalidArchive(
            "nenhuma música selecionada para exportar".to_string(),
        ));
    }

    let songs = fetch_rows_in(pool, SONG_JSON_OBJECT, "songs", "id", ids).await?;
    let sections = fetch_rows_in(pool, SECTION_JSON_OBJECT, "song_sections", "song_id", ids).await?;

    let bg_ids = background_media_ids(pool, ids).await?;
    let media = fetch_rows_in(pool, MEDIA_JSON_OBJECT, "media", "id", &bg_ids).await?;
    let media_file_names = scalar_in(pool, "file_name", "media", "id", &bg_ids).await?;

    let dump = build_dump(
        ArchiveKind::Songs,
        songs,
        sections,
        "[]".to_string(),
        "[]".to_string(),
        media,
        "[]".to_string(),
        media_file_names,
    );
    write_artifact(out, media_dir, dump, ArchiveKind::Songs, on_progress).await
}

/// SHARE-04/05 — export a set with every transitive dependency bundled.
pub async fn export_set<F>(
    pool: &SqlitePool,
    media_dir: &Path,
    set_id: &str,
    out: &Path,
    on_progress: F,
) -> Result<ExportSummary, ArchiveError>
where
    F: Fn(ExportProgress) + Send + 'static,
{
    let set_ids = vec![set_id.to_string()];
    let sets = fetch_rows_in(pool, SET_JSON_OBJECT, "sets", "id", &set_ids).await?;
    if count(&sets) == 0 {
        return Err(ArchiveError::InvalidArchive("conjunto não encontrado".to_string()));
    }

    let item_rows =
        parse_json_array(&fetch_rows_in(pool, SET_ITEM_JSON_OBJECT, "set_items", "set_id", &set_ids).await?)
            .unwrap_or_default();

    // Referenced songs (only the existing ones); flag dangling refs.
    let referenced_song_ids: Vec<String> =
        item_rows.iter().filter_map(|r| str_val(r, "song_id")).collect();
    let existing_songs: HashSet<String> = scalar_in(pool, "id", "songs", "id", &referenced_song_ids)
        .await?
        .into_iter()
        .collect();

    let mut warnings = Vec::new();
    let mut kept_items: Vec<JsonRow> = Vec::new();
    let mut direct_media_ids: Vec<String> = Vec::new();
    for row in &item_rows {
        if let Some(sid) = str_val(row, "song_id") {
            if !existing_songs.contains(&sid) {
                warnings.push(format!("Item de conjunto ignorado: música ausente ({sid})"));
                continue;
            }
        }
        if let Some(mid) = str_val(row, "media_id") {
            direct_media_ids.push(mid);
        }
        kept_items.push(row.clone());
    }
    let set_items = serde_json::to_string(&kept_items)?;

    let valid_song_ids: Vec<String> = existing_songs.iter().cloned().collect();
    let songs = fetch_rows_in(pool, SONG_JSON_OBJECT, "songs", "id", &valid_song_ids).await?;
    let sections =
        fetch_rows_in(pool, SECTION_JSON_OBJECT, "song_sections", "song_id", &valid_song_ids).await?;

    // De-dup media by id (SHARE-05): direct set-item media + song backgrounds.
    let bg_ids = background_media_ids(pool, &valid_song_ids).await?;
    let mut all_media: Vec<String> = Vec::new();
    let mut seen = HashSet::new();
    for id in direct_media_ids.into_iter().chain(bg_ids) {
        if seen.insert(id.clone()) {
            all_media.push(id);
        }
    }
    let media = fetch_rows_in(pool, MEDIA_JSON_OBJECT, "media", "id", &all_media).await?;
    let media_file_names = scalar_in(pool, "file_name", "media", "id", &all_media).await?;

    let dump = build_dump(
        ArchiveKind::Set,
        songs,
        sections,
        sets,
        set_items,
        media,
        "[]".to_string(),
        media_file_names,
    );
    let mut summary = write_artifact(out, media_dir, dump, ArchiveKind::Set, on_progress).await?;
    summary.warnings = warnings;
    Ok(summary)
}

/// SHARE-06 — export the settings profile (incl. the `key_bindings` row, D-19).
pub async fn export_settings(pool: &SqlitePool, out: &Path) -> Result<ExportSummary, ArchiveError> {
    let settings: Option<String> = sqlx::query_scalar(&format!(
        "SELECT COALESCE(json_group_array({SETTINGS_JSON_OBJECT}), '[]') FROM settings"
    ))
    .fetch_optional(pool)
    .await?;
    let settings = settings.unwrap_or_else(|| "[]".to_string());

    let dump = build_dump(
        ArchiveKind::Settings,
        "[]".to_string(),
        "[]".to_string(),
        "[]".to_string(),
        "[]".to_string(),
        "[]".to_string(),
        settings,
        Vec::new(),
    );
    // No media dir needed — settings carry no binaries.
    write_artifact(out, Path::new("."), dump, ArchiveKind::Settings, |_| {}).await
}

// ── Import: plan (T3, read-only) ─────────────────────────────────────────────────

async fn id_exists(pool: &SqlitePool, table: &str, id: &str) -> Result<bool, ArchiveError> {
    let sql = format!("SELECT 1 FROM {table} WHERE id = ? LIMIT 1");
    Ok(sqlx::query_scalar::<_, i64>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .is_some())
}

/// SHARE-07 — inspect a `.tlz` and flag every collision. Performs NO writes.
pub async fn plan_import(pool: &SqlitePool, path: &Path) -> Result<ImportPlan, ArchiveError> {
    let p = path.to_path_buf();
    let manifest = tokio::task::spawn_blocking(move || read_archive_manifest(&p))
        .await
        .map_err(|e| ArchiveError::JoinError(e.to_string()))??;

    // Legacy / full-library archives are routed to the existing restore flow by
    // the caller (SHARE-09); no per-item plan is produced here.
    if manifest.kind == ArchiveKind::Library {
        return Ok(ImportPlan {
            kind: ArchiveKind::Library,
            schema_version: manifest.schema_version,
            counts: manifest.counts,
            items: Vec::new(),
        });
    }

    let p = path.to_path_buf();
    let (data, _media) = tokio::task::spawn_blocking(move || read_archive_data(&p))
        .await
        .map_err(|e| ArchiveError::JoinError(e.to_string()))??;

    let mut items = Vec::new();

    for row in parse_json_array(&data.songs).unwrap_or_default() {
        let id = str_val(&row, "id").unwrap_or_default();
        let title = str_val(&row, "title").unwrap_or_default();
        let artist = str_val(&row, "artist").unwrap_or_default();
        let (conflict, default_action) = song_conflict(pool, &id, &title, &artist).await?;
        items.push(ImportPlanItem {
            artifact_type: "song".to_string(),
            id,
            title,
            conflict,
            default_action,
        });
    }

    for row in parse_json_array(&data.media).unwrap_or_default() {
        let id = str_val(&row, "id").unwrap_or_default();
        let title = str_val(&row, "display_name")
            .or_else(|| str_val(&row, "file_name"))
            .unwrap_or_default();
        let (conflict, default_action) = simple_id_conflict(pool, "media", &id).await?;
        items.push(ImportPlanItem {
            artifact_type: "media".to_string(),
            id,
            title,
            conflict,
            default_action,
        });
    }

    for row in parse_json_array(&data.sets).unwrap_or_default() {
        let id = str_val(&row, "id").unwrap_or_default();
        let title = str_val(&row, "name").unwrap_or_default();
        let (conflict, default_action) = simple_id_conflict(pool, "sets", &id).await?;
        items.push(ImportPlanItem {
            artifact_type: "set".to_string(),
            id,
            title,
            conflict,
            default_action,
        });
    }

    Ok(ImportPlan {
        kind: manifest.kind,
        schema_version: manifest.schema_version,
        counts: manifest.counts,
        items,
    })
}

async fn simple_id_conflict(
    pool: &SqlitePool,
    table: &str,
    id: &str,
) -> Result<(Option<ConflictKind>, ResolutionAction), ArchiveError> {
    if id_exists(pool, table, id).await? {
        // Default: keep the existing item (skip) — operator can change.
        Ok((Some(ConflictKind::SameId), ResolutionAction::Skip))
    } else {
        // No collision → insert as-is (keeps ids so internal references stay valid).
        Ok((None, ResolutionAction::Overwrite))
    }
}

async fn song_conflict(
    pool: &SqlitePool,
    id: &str,
    title: &str,
    artist: &str,
) -> Result<(Option<ConflictKind>, ResolutionAction), ArchiveError> {
    if id_exists(pool, "songs", id).await? {
        return Ok((Some(ConflictKind::SameId), ResolutionAction::Skip));
    }
    // Same normalized title+artist but a new id → "possible duplicate"; default
    // to copy so a genuinely different song is never silently dropped.
    let norm_title = normalize_title(title);
    let norm_artist = normalize_title(artist);
    let dup: Option<i64> = sqlx::query_scalar(
        "SELECT 1 FROM songs WHERE deleted_at IS NULL \
         AND lower(trim(title)) = ? AND lower(trim(COALESCE(artist,''))) = ? LIMIT 1",
    )
    .bind(&norm_title)
    .bind(&norm_artist)
    .fetch_optional(pool)
    .await?;
    if dup.is_some() {
        Ok((Some(ConflictKind::SameTitleArtist), ResolutionAction::Copy))
    } else {
        Ok((None, ResolutionAction::Overwrite))
    }
}

// ── Import: apply (T3, transactional) ────────────────────────────────────────────

async fn row_exists(
    conn: &mut SqliteConnection,
    table: &str,
    id: &str,
) -> Result<bool, ArchiveError> {
    let sql = format!("SELECT 1 FROM {table} WHERE id = ? LIMIT 1");
    Ok(sqlx::query_scalar::<_, i64>(&sql)
        .bind(id)
        .fetch_optional(conn)
        .await?
        .is_some())
}

fn set_str(row: &mut JsonRow, key: &str, val: &str) {
    row.insert(key.to_string(), serde_json::Value::String(val.to_string()));
}

/// Rewrite an FK column through the re-id map, if its current value was remapped.
fn remap_fk(row: &mut JsonRow, key: &str, remap: &HashMap<String, String>) {
    if let Some(old) = str_val(row, key) {
        if let Some(new) = remap.get(&old) {
            set_str(row, key, new);
        }
    }
}

/// Fresh UUID file name keeping the original extension (SHARE-15).
fn rename_file(old: &str) -> String {
    let uuid = new_id();
    match old.rsplit_once('.') {
        Some((_, ext)) if !ext.is_empty() => format!("{uuid}.{ext}"),
        _ => uuid,
    }
}

/// SHARE-07/08/10/11 — apply an artifact import under the operator's resolutions.
/// All DB work runs in one transaction (rollback on any error); media files are
/// written only after a successful commit. Never wipes the target library.
pub async fn apply_import(
    pool: &SqlitePool,
    media_dir: &Path,
    path: &Path,
    resolutions: &[Resolution],
) -> Result<ImportSummary, ArchiveError> {
    let p = path.to_path_buf();
    let manifest = tokio::task::spawn_blocking({
        let p = p.clone();
        move || read_archive_manifest(&p)
    })
    .await
    .map_err(|e| ArchiveError::JoinError(e.to_string()))??;

    // SHARE-08/09: a full-library archive must NEVER be applied through the
    // selective (never-wipe) path. The caller routes it to restore_library.
    if manifest.kind == ArchiveKind::Library {
        return Err(ArchiveError::InvalidArchive(
            "arquivo de biblioteca completa deve ser restaurado pelo fluxo de backup".to_string(),
        ));
    }

    let (data, media_entries) = tokio::task::spawn_blocking({
        let p = p.clone();
        move || read_archive_data(&p)
    })
    .await
    .map_err(|e| ArchiveError::JoinError(e.to_string()))??;

    let res_map: HashMap<String, ResolutionAction> =
        resolutions.iter().map(|r| (r.id.clone(), r.action)).collect();
    // Items with no explicit resolution default to insert-as-is (overwrite).
    let action_for = |id: &str| res_map.get(id).copied().unwrap_or(ResolutionAction::Overwrite);

    let media_rows = parse_json_array(&data.media).unwrap_or_default();
    let song_rows = parse_json_array(&data.songs).unwrap_or_default();
    let set_rows = parse_json_array(&data.sets).unwrap_or_default();
    let settings_rows = parse_json_array(&data.settings).unwrap_or_default();

    // Children grouped by parent (driven by the parent's resolution).
    let mut sections_by_song: HashMap<String, Vec<JsonRow>> = HashMap::new();
    for r in parse_json_array(&data.sections).unwrap_or_default() {
        if let Some(sid) = str_val(&r, "song_id") {
            sections_by_song.entry(sid).or_default().push(r);
        }
    }
    let mut items_by_set: HashMap<String, Vec<JsonRow>> = HashMap::new();
    for r in parse_json_array(&data.set_items).unwrap_or_default() {
        if let Some(sid) = str_val(&r, "set_id") {
            items_by_set.entry(sid).or_default().push(r);
        }
    }

    let mut summary = ImportSummary::default();
    let mut remap: HashMap<String, String> = HashMap::new();
    // old file_name -> final file_name (only for media we will actually write).
    let mut media_out: HashMap<String, String> = HashMap::new();

    let mut tx = pool.begin().await?;
    // Defer FK checks to commit so re-id remaps and INSERT OR REPLACE overwrites
    // (which transiently delete+reinsert referenced parents) stay valid.
    sqlx::query("PRAGMA defer_foreign_keys = ON")
        .execute(&mut *tx)
        .await?;

    // ── Media (parents of song backgrounds + set media items) ──
    for mut row in media_rows {
        let id = str_val(&row, "id").unwrap_or_default();
        let file_name = str_val(&row, "file_name").unwrap_or_default();
        match action_for(&id) {
            ResolutionAction::Skip => {
                summary.media_skipped += 1;
            }
            ResolutionAction::Copy => {
                let new = new_id();
                let new_file = rename_file(&file_name);
                set_str(&mut row, "id", &new);
                set_str(&mut row, "file_name", &new_file);
                row.remove("thumbnail_file"); // thumbnails regenerate; never bundled
                remap.insert(id, new);
                if !file_name.is_empty() {
                    media_out.insert(file_name, new_file);
                }
                bind_media(sqlx::query(&media_insert_sql("INSERT")), &row)
                    .execute(&mut *tx)
                    .await?;
                summary.media_copied += 1;
            }
            ResolutionAction::Overwrite => {
                let exists = row_exists(&mut tx, "media", &id).await?;
                let mut final_name = file_name.clone();
                if exists {
                    summary.media_overwritten += 1;
                } else {
                    // New id but the file name already exists on disk → store under a
                    // fresh name so an unrelated file is never clobbered (SHARE-15).
                    if !file_name.is_empty() && media_dir.join(&file_name).exists() {
                        final_name = rename_file(&file_name);
                        set_str(&mut row, "file_name", &final_name);
                    }
                    summary.media_imported += 1;
                }
                if !file_name.is_empty() {
                    media_out.insert(file_name, final_name);
                }
                bind_media(sqlx::query(&media_insert_sql("INSERT OR REPLACE")), &row)
                    .execute(&mut *tx)
                    .await?;
            }
        }
    }

    // ── Songs (+ their sections) ──
    for mut row in song_rows {
        let id = str_val(&row, "id").unwrap_or_default();
        remap_fk(&mut row, "background_id", &remap);
        let sections = sections_by_song.remove(&id).unwrap_or_default();
        match action_for(&id) {
            ResolutionAction::Skip => {
                summary.songs_skipped += 1;
            }
            ResolutionAction::Copy => {
                let new = new_id();
                set_str(&mut row, "id", &new);
                remap.insert(id, new.clone());
                bind_song(sqlx::query(&song_insert_sql("INSERT")), &row)
                    .execute(&mut *tx)
                    .await?;
                for mut s in sections {
                    set_str(&mut s, "id", &new_id());
                    set_str(&mut s, "song_id", &new);
                    bind_section(sqlx::query(&section_insert_sql("INSERT")), &s)
                        .execute(&mut *tx)
                        .await?;
                    summary.sections_imported += 1;
                }
                summary.songs_copied += 1;
            }
            ResolutionAction::Overwrite => {
                if row_exists(&mut tx, "songs", &id).await? {
                    summary.songs_overwritten += 1;
                } else {
                    summary.songs_imported += 1;
                }
                // INSERT OR REPLACE deletes the old song (cascade-clearing its old
                // sections) then re-inserts; the new sections are written below.
                bind_song(sqlx::query(&song_insert_sql("INSERT OR REPLACE")), &row)
                    .execute(&mut *tx)
                    .await?;
                for s in sections {
                    bind_section(sqlx::query(&section_insert_sql("INSERT OR REPLACE")), &s)
                        .execute(&mut *tx)
                        .await?;
                    summary.sections_imported += 1;
                }
            }
        }
    }

    // ── Sets (+ their items) ──
    for mut row in set_rows {
        let id = str_val(&row, "id").unwrap_or_default();
        let items = items_by_set.remove(&id).unwrap_or_default();
        match action_for(&id) {
            ResolutionAction::Skip => {
                summary.sets_skipped += 1;
            }
            ResolutionAction::Copy => {
                let new = new_id();
                set_str(&mut row, "id", &new);
                bind_set(sqlx::query(&set_insert_sql("INSERT")), &row)
                    .execute(&mut *tx)
                    .await?;
                for mut it in items {
                    set_str(&mut it, "id", &new_id());
                    set_str(&mut it, "set_id", &new);
                    remap_fk(&mut it, "song_id", &remap);
                    remap_fk(&mut it, "media_id", &remap);
                    bind_set_item(sqlx::query(&set_item_insert_sql("INSERT")), &it)
                        .execute(&mut *tx)
                        .await?;
                    summary.set_items_imported += 1;
                }
                summary.sets_copied += 1;
            }
            ResolutionAction::Overwrite => {
                if row_exists(&mut tx, "sets", &id).await? {
                    summary.sets_overwritten += 1;
                } else {
                    summary.sets_imported += 1;
                }
                bind_set(sqlx::query(&set_insert_sql("INSERT OR REPLACE")), &row)
                    .execute(&mut *tx)
                    .await?;
                for mut it in items {
                    remap_fk(&mut it, "song_id", &remap);
                    remap_fk(&mut it, "media_id", &remap);
                    bind_set_item(sqlx::query(&set_item_insert_sql("INSERT OR REPLACE")), &it)
                        .execute(&mut *tx)
                        .await?;
                    summary.set_items_imported += 1;
                }
            }
        }
    }

    // ── Settings (always applied; profile semantics, SHARE-06) ──
    for row in settings_rows {
        if let (Some(k), Some(v)) = (str_val(&row, "key"), str_val(&row, "value")) {
            sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
                .bind(k)
                .bind(v)
                .execute(&mut *tx)
                .await?;
            summary.settings_imported += 1;
        }
    }

    // Rebuild FTS so search reflects overwritten/imported songs.
    sqlx::query("INSERT INTO songs_fts(songs_fts) VALUES('rebuild')")
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    // Media files — only after a clean commit. Write only files whose media row
    // was actually inserted/overwritten (skipped media leave no orphan files).
    for (file_name, bytes) in media_entries {
        if let Some(dest_name) = media_out.get(&file_name) {
            let dest = media_dir.join(dest_name);
            if std::fs::write(&dest, &bytes).is_err() {
                summary.media_failed += 1;
            }
        }
    }

    Ok(summary)
}

// ── Tests ────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqliteConnectOptions;
    use std::fs;
    use std::str::FromStr;
    use tempfile::TempDir;

    async fn make_pool() -> (SqlitePool, TempDir) {
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

    fn media_dir(dir: &TempDir) -> std::path::PathBuf {
        let m = dir.path().join("media");
        fs::create_dir_all(&m).unwrap();
        m
    }

    async fn insert_song(pool: &SqlitePool, id: &str, title: &str, bg: Option<&str>) {
        let now = now_ms();
        sqlx::query(
            "INSERT INTO songs (id, title, artist, language, background_id, created_at, updated_at) \
             VALUES (?, ?, 'A', 'pt', ?, ?, ?)",
        )
        .bind(id)
        .bind(title)
        .bind(bg)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO song_sections (id, song_id, label, type, body, sort_order) \
             VALUES (?, ?, 'V1', 'verse', 'line', 0)",
        )
        .bind(format!("{id}-sec"))
        .bind(id)
        .execute(pool)
        .await
        .unwrap();
    }

    async fn insert_media(pool: &SqlitePool, mdir: &Path, id: &str, file: &str) {
        let now = now_ms();
        sqlx::query(
            "INSERT INTO media (id, file_path, file_name, kind, created_at, byte_size, updated_at) \
             VALUES (?, ?, ?, 'image', ?, 3, ?)",
        )
        .bind(id)
        .bind(file)
        .bind(file)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .unwrap();
        fs::write(mdir.join(file), b"img").unwrap();
    }

    #[tokio::test]
    async fn export_songs_round_trips_with_background_media() {
        let (pool, dir) = make_pool().await;
        let mdir = media_dir(&dir);
        insert_media(&pool, &mdir, "m1", "m1.png").await;
        insert_song(&pool, "s1", "Song One", Some("m1")).await;
        insert_song(&pool, "s2", "Song Two", None).await;

        let out = dir.path().join("songs.tlz");
        let summary = export_songs(&pool, &mdir, &["s1".into(), "s2".into()], &out, |_| {})
            .await
            .unwrap();
        assert_eq!(summary.counts.songs, 2);
        assert_eq!(summary.counts.media, 1);

        // Import into a clean library.
        let (pool2, dir2) = make_pool().await;
        let mdir2 = media_dir(&dir2);
        let plan = plan_import(&pool2, &out).await.unwrap();
        assert_eq!(plan.kind, ArchiveKind::Songs);
        assert!(plan.items.iter().all(|i| i.conflict.is_none()));
        apply_import(&pool2, &mdir2, &out, &[]).await.unwrap();

        let songs: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM songs")
            .fetch_one(&pool2)
            .await
            .unwrap();
        assert_eq!(songs, 2);
        let bg: Option<String> =
            sqlx::query_scalar("SELECT background_id FROM songs WHERE id = 's1'")
                .fetch_one(&pool2)
                .await
                .unwrap();
        assert_eq!(bg.as_deref(), Some("m1"));
        assert!(mdir2.join("m1.png").exists());
    }

    #[tokio::test]
    async fn export_set_bundles_deps_and_dedups_media() {
        let (pool, dir) = make_pool().await;
        let mdir = media_dir(&dir);
        insert_media(&pool, &mdir, "bg", "bg.png").await;
        insert_media(&pool, &mdir, "img", "img.png").await;
        // Two songs share the same background media (must be bundled once).
        insert_song(&pool, "s1", "S1", Some("bg")).await;
        insert_song(&pool, "s2", "S2", Some("bg")).await;
        let now = now_ms();
        sqlx::query("INSERT INTO sets (id, name, created_at, updated_at) VALUES ('set1','Sun',?,?)")
            .bind(now)
            .bind(now)
            .execute(&pool)
            .await
            .unwrap();
        for (i, (ty, song, media)) in [
            ("song", Some("s1"), None),
            ("song", Some("s2"), None),
            ("media", None, Some("img")),
        ]
        .iter()
        .enumerate()
        {
            sqlx::query(
                "INSERT INTO set_items (id, set_id, item_type, song_id, media_id, sort_order) \
                 VALUES (?, 'set1', ?, ?, ?, ?)",
            )
            .bind(format!("it{i}"))
            .bind(ty)
            .bind(*song)
            .bind(*media)
            .bind(i as i64)
            .execute(&pool)
            .await
            .unwrap();
        }

        let out = dir.path().join("set.tlz");
        let summary = export_set(&pool, &mdir, "set1", &out, |_| {}).await.unwrap();
        assert_eq!(summary.counts.songs, 2);
        assert_eq!(summary.counts.set_items, 3);
        // bg (shared by 2 songs) de-duped + img = 2 media total.
        assert_eq!(summary.counts.media, 2);

        let (pool2, dir2) = make_pool().await;
        let mdir2 = media_dir(&dir2);
        apply_import(&pool2, &mdir2, &out, &[]).await.unwrap();
        let items: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM set_items")
            .fetch_one(&pool2)
            .await
            .unwrap();
        assert_eq!(items, 3);
        assert!(mdir2.join("bg.png").exists() && mdir2.join("img.png").exists());
    }

    #[tokio::test]
    async fn export_set_skips_dangling_song_ref() {
        let (pool, dir) = make_pool().await;
        let mdir = media_dir(&dir);
        let now = now_ms();
        sqlx::query("INSERT INTO sets (id, name, created_at, updated_at) VALUES ('set1','S',?,?)")
            .bind(now)
            .bind(now)
            .execute(&pool)
            .await
            .unwrap();
        // A truly-dangling set item can only exist if the referenced song was hard
        // deleted while FK enforcement was off; simulate that legacy state here.
        // PRAGMA is per-connection, so pin one connection for all three statements.
        let mut conn = pool.acquire().await.unwrap();
        sqlx::query("PRAGMA foreign_keys = OFF").execute(&mut *conn).await.unwrap();
        sqlx::query(
            "INSERT INTO set_items (id, set_id, item_type, song_id, sort_order) \
             VALUES ('it0','set1','song','ghost',0)",
        )
        .execute(&mut *conn)
        .await
        .unwrap();
        sqlx::query("PRAGMA foreign_keys = ON").execute(&mut *conn).await.unwrap();
        drop(conn);

        let out = dir.path().join("set.tlz");
        let summary = export_set(&pool, &mdir, "set1", &out, |_| {}).await.unwrap();
        assert_eq!(summary.counts.set_items, 0);
        assert_eq!(summary.warnings.len(), 1);
    }

    #[tokio::test]
    async fn export_settings_only() {
        let (pool, dir) = make_pool().await;
        sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('theme','dark')")
            .execute(&pool)
            .await
            .unwrap();
        let out = dir.path().join("settings.tlz");
        let summary = export_settings(&pool, &out).await.unwrap();
        assert!(summary.counts.settings >= 1);
        assert_eq!(summary.counts.songs, 0);
        assert_eq!(summary.counts.media, 0);

        let (pool2, _dir2) = make_pool().await;
        let mdir2 = media_dir(&_dir2);
        let plan = plan_import(&pool2, &out).await.unwrap();
        assert_eq!(plan.kind, ArchiveKind::Settings);
        apply_import(&pool2, &mdir2, &out, &[]).await.unwrap();
        let v: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'theme'")
            .fetch_one(&pool2)
            .await
            .unwrap();
        assert_eq!(v, "dark");
    }

    #[tokio::test]
    async fn import_resolutions_skip_overwrite_copy() {
        let (pool, dir) = make_pool().await;
        let mdir = media_dir(&dir);
        insert_song(&pool, "s1", "Title", None).await;
        let out = dir.path().join("song.tlz");
        export_songs(&pool, &mdir, &["s1".into()], &out, |_| {})
            .await
            .unwrap();

        // Target already has s1 with a different title.
        let (pool2, dir2) = make_pool().await;
        let mdir2 = media_dir(&dir2);
        insert_song(&pool2, "s1", "Existing", None).await;

        // Plan flags a sameId conflict, default skip.
        let plan = plan_import(&pool2, &out).await.unwrap();
        let item = plan.items.iter().find(|i| i.id == "s1").unwrap();
        assert_eq!(item.conflict, Some(ConflictKind::SameId));
        assert_eq!(item.default_action, ResolutionAction::Skip);

        // skip → existing untouched, still one song.
        apply_import(
            &pool2,
            &mdir2,
            &out,
            &[Resolution { id: "s1".into(), action: ResolutionAction::Skip }],
        )
        .await
        .unwrap();
        let title: String = sqlx::query_scalar("SELECT title FROM songs WHERE id = 's1'")
            .fetch_one(&pool2)
            .await
            .unwrap();
        assert_eq!(title, "Existing");
        let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM songs").fetch_one(&pool2).await.unwrap();
        assert_eq!(n, 1);

        // overwrite → replaced in place, still one song.
        apply_import(
            &pool2,
            &mdir2,
            &out,
            &[Resolution { id: "s1".into(), action: ResolutionAction::Overwrite }],
        )
        .await
        .unwrap();
        let title: String = sqlx::query_scalar("SELECT title FROM songs WHERE id = 's1'")
            .fetch_one(&pool2)
            .await
            .unwrap();
        assert_eq!(title, "Title");
        let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM songs").fetch_one(&pool2).await.unwrap();
        assert_eq!(n, 1);

        // copy → fresh id, now two songs, existing intact.
        apply_import(
            &pool2,
            &mdir2,
            &out,
            &[Resolution { id: "s1".into(), action: ResolutionAction::Copy }],
        )
        .await
        .unwrap();
        let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM songs").fetch_one(&pool2).await.unwrap();
        assert_eq!(n, 2);
        // Each song still owns exactly one section (copy re-id kept children coherent).
        let secs: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM song_sections")
            .fetch_one(&pool2)
            .await
            .unwrap();
        assert_eq!(secs, 2);
    }

    #[tokio::test]
    async fn copy_set_is_internally_coherent() {
        let (pool, dir) = make_pool().await;
        let mdir = media_dir(&dir);
        insert_media(&pool, &mdir, "bg", "bg.png").await;
        insert_song(&pool, "s1", "S1", Some("bg")).await;
        let now = now_ms();
        sqlx::query("INSERT INTO sets (id, name, created_at, updated_at) VALUES ('set1','S',?,?)")
            .bind(now)
            .bind(now)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO set_items (id, set_id, item_type, song_id, sort_order) \
             VALUES ('it0','set1','song','s1',0)",
        )
        .execute(&pool)
        .await
        .unwrap();
        let out = dir.path().join("set.tlz");
        export_set(&pool, &mdir, "set1", &out, |_| {}).await.unwrap();

        // Target already contains the same set + song + media → copy everything.
        let (pool2, dir2) = make_pool().await;
        let mdir2 = media_dir(&dir2);
        insert_media(&pool2, &mdir2, "bg", "bg.png").await;
        insert_song(&pool2, "s1", "S1", Some("bg")).await;
        sqlx::query("INSERT INTO sets (id, name, created_at, updated_at) VALUES ('set1','S',?,?)")
            .bind(now)
            .bind(now)
            .execute(&pool2)
            .await
            .unwrap();

        let res = vec![
            Resolution { id: "set1".into(), action: ResolutionAction::Copy },
            Resolution { id: "s1".into(), action: ResolutionAction::Copy },
            Resolution { id: "bg".into(), action: ResolutionAction::Copy },
        ];
        apply_import(&pool2, &mdir2, &out, &res).await.unwrap();

        // Two sets now. The copied set's item must point at the copied song, and
        // the copied song at the copied media — no references back to originals.
        let sets: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sets").fetch_one(&pool2).await.unwrap();
        assert_eq!(sets, 2);
        let new_song: String = sqlx::query_scalar(
            "SELECT si.song_id FROM set_items si JOIN sets s ON s.id = si.set_id \
             WHERE s.id != 'set1'",
        )
        .fetch_one(&pool2)
        .await
        .unwrap();
        assert_ne!(new_song, "s1");
        let new_bg: String =
            sqlx::query_scalar("SELECT background_id FROM songs WHERE id = ?")
                .bind(&new_song)
                .fetch_one(&pool2)
                .await
                .unwrap();
        assert_ne!(new_bg, "bg");
        let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM media WHERE id = ?")
            .bind(&new_bg)
            .fetch_one(&pool2)
            .await
            .unwrap();
        assert_eq!(exists, 1);
    }

    #[tokio::test]
    async fn library_archive_is_refused_by_selective_import() {
        // A full-library backup must route to restore, never the selective path.
        let (pool, dir) = make_pool().await;
        let mdir = media_dir(&dir);
        let out = dir.path().join("lib.tlz");
        archive::export(&pool, &mdir, &out, |_| {}).await.unwrap();

        let plan = plan_import(&pool, &out).await.unwrap();
        assert_eq!(plan.kind, ArchiveKind::Library);
        assert!(plan.items.is_empty());

        let err = apply_import(&pool, &mdir, &out, &[]).await;
        assert!(err.is_err());
    }

    #[tokio::test]
    async fn import_does_not_reduce_unrelated_rows() {
        let (pool, dir) = make_pool().await;
        let mdir = media_dir(&dir);
        insert_song(&pool, "incoming", "Incoming", None).await;
        let out = dir.path().join("song.tlz");
        export_songs(&pool, &mdir, &["incoming".into()], &out, |_| {})
            .await
            .unwrap();

        let (pool2, dir2) = make_pool().await;
        let mdir2 = media_dir(&dir2);
        insert_song(&pool2, "keep1", "Keep1", None).await;
        insert_song(&pool2, "keep2", "Keep2", None).await;

        apply_import(&pool2, &mdir2, &out, &[]).await.unwrap();
        let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM songs").fetch_one(&pool2).await.unwrap();
        assert_eq!(n, 3); // 2 kept + 1 imported, none lost
    }
}
