use crate::domain::song::{Song, SongSection, SectionType};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

pub fn new_id() -> String {
    Uuid::now_v7().to_string()
}

pub fn section_type_to_db(st: &SectionType) -> &'static str {
    match st {
        SectionType::Verse => "verse",
        SectionType::Chorus => "chorus",
        SectionType::Bridge => "bridge",
        SectionType::PreChorus => "pre_chorus",
        SectionType::Outro => "outro",
        SectionType::Interlude => "interlude",
        SectionType::Tag => "tag",
    }
}

pub fn section_type_from_db(s: &str) -> SectionType {
    match s {
        "chorus" => SectionType::Chorus,
        "bridge" => SectionType::Bridge,
        "pre_chorus" => SectionType::PreChorus,
        "outro" => SectionType::Outro,
        "interlude" => SectionType::Interlude,
        "tag" => SectionType::Tag,
        _ => SectionType::Verse,
    }
}

pub async fn load_sections(
    pool: &SqlitePool,
    song_id: &str,
) -> Result<Vec<SongSection>, String> {
    let rows = sqlx::query(
        "SELECT id, song_id, label, type, body, sort_order, repeat_count
         FROM song_sections WHERE song_id = ? ORDER BY sort_order ASC",
    )
    .bind(song_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Falha ao buscar seções: {e}"))?;

    Ok(rows
        .iter()
        .map(|row| {
            let type_str: String = row.get("type");
            SongSection {
                id: row.get("id"),
                song_id: row.get("song_id"),
                label: row.get("label"),
                section_type: section_type_from_db(&type_str),
                body: row.get("body"),
                sort_order: row.get("sort_order"),
                repeat_count: row.get("repeat_count"),
            }
        })
        .collect())
}

// ─── Payload types ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SectionPayload {
    pub label: String,
    #[serde(rename = "type")]
    pub section_type: SectionType,
    pub body: String,
    pub sort_order: i32,
    pub repeat_count: Option<i32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSongPayload {
    pub title: String,
    pub artist: Option<String>,
    pub ccli_number: Option<String>,
    pub key_signature: Option<String>,
    pub language: Option<String>,
    pub notes: Option<String>,
    pub background_id: Option<String>,
    pub slide_config: Option<String>,
    pub source: Option<String>,
    pub sections: Vec<SectionPayload>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSongPayload {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub ccli_number: Option<String>,
    pub key_signature: Option<String>,
    pub language: Option<String>,
    pub notes: Option<String>,
    pub background_id: Option<String>,
    pub slide_config: Option<String>,
    pub source: Option<String>,
    pub sections: Vec<SectionPayload>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ListSongsParams {
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
struct SongsChangedEvent;

// ─── Core DB functions (testable without Tauri runtime) ──────────────────────

pub async fn db_create_song(
    pool: &SqlitePool,
    payload: CreateSongPayload,
) -> Result<Song, String> {
    let id = new_id();
    let now = now_ms();
    let language = payload.language.unwrap_or_else(|| "pt".to_string());

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("Falha ao iniciar transação: {e}"))?;

    sqlx::query(
        "INSERT INTO songs (id, title, artist, ccli_number, key_signature, language, notes,
                            background_id, slide_config, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&payload.title)
    .bind(&payload.artist)
    .bind(&payload.ccli_number)
    .bind(&payload.key_signature)
    .bind(&language)
    .bind(&payload.notes)
    .bind(&payload.background_id)
    .bind(&payload.slide_config)
    .bind(&payload.source)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Falha ao salvar música: {e}"))?;

    let mut sections = Vec::new();
    for (i, sec) in payload.sections.iter().enumerate() {
        let sec_id = new_id();
        let repeat_count = sec.repeat_count.unwrap_or(1);
        sqlx::query(
            "INSERT INTO song_sections (id, song_id, label, type, body, sort_order, repeat_count)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&sec_id)
        .bind(&id)
        .bind(&sec.label)
        .bind(section_type_to_db(&sec.section_type))
        .bind(&sec.body)
        .bind(sec.sort_order)
        .bind(repeat_count)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Falha ao salvar seção {}: {e}", i + 1))?;

        sections.push(SongSection {
            id: sec_id,
            song_id: id.clone(),
            label: sec.label.clone(),
            section_type: sec.section_type.clone(),
            body: sec.body.clone(),
            sort_order: sec.sort_order,
            repeat_count,
        });
    }

    tx.commit()
        .await
        .map_err(|e| format!("Falha ao confirmar transação: {e}"))?;

    Ok(Song {
        id,
        title: payload.title,
        artist: payload.artist,
        ccli_number: payload.ccli_number,
        key_signature: payload.key_signature,
        language,
        notes: payload.notes,
        background_id: payload.background_id,
        slide_config: payload.slide_config,
        source: payload.source,
        created_at: now,
        updated_at: now,
        deleted_at: None,
        sections,
    })
}

pub async fn db_update_song(
    pool: &SqlitePool,
    payload: UpdateSongPayload,
) -> Result<Song, String> {
    let row = sqlx::query("SELECT created_at FROM songs WHERE id = ? AND deleted_at IS NULL")
        .bind(&payload.id)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Falha ao buscar música: {e}"))?
        .ok_or_else(|| "Música não encontrada".to_string())?;
    let created_at: i64 = row.get("created_at");
    let now = now_ms();
    let language = payload.language.unwrap_or_else(|| "pt".to_string());

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| format!("Falha ao iniciar transação: {e}"))?;

    sqlx::query(
        "UPDATE songs SET title=?, artist=?, ccli_number=?, key_signature=?, language=?,
                          notes=?, background_id=?, slide_config=?, source=?, updated_at=?
         WHERE id=?",
    )
    .bind(&payload.title)
    .bind(&payload.artist)
    .bind(&payload.ccli_number)
    .bind(&payload.key_signature)
    .bind(&language)
    .bind(&payload.notes)
    .bind(&payload.background_id)
    .bind(&payload.slide_config)
    .bind(&payload.source)
    .bind(now)
    .bind(&payload.id)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Falha ao atualizar música: {e}"))?;

    sqlx::query("DELETE FROM song_sections WHERE song_id = ?")
        .bind(&payload.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Falha ao remover seções antigas: {e}"))?;

    let mut sections = Vec::new();
    for (i, sec) in payload.sections.iter().enumerate() {
        let sec_id = new_id();
        let repeat_count = sec.repeat_count.unwrap_or(1);
        sqlx::query(
            "INSERT INTO song_sections (id, song_id, label, type, body, sort_order, repeat_count)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&sec_id)
        .bind(&payload.id)
        .bind(&sec.label)
        .bind(section_type_to_db(&sec.section_type))
        .bind(&sec.body)
        .bind(sec.sort_order)
        .bind(repeat_count)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Falha ao salvar seção {}: {e}", i + 1))?;

        sections.push(SongSection {
            id: sec_id,
            song_id: payload.id.clone(),
            label: sec.label.clone(),
            section_type: sec.section_type.clone(),
            body: sec.body.clone(),
            sort_order: sec.sort_order,
            repeat_count,
        });
    }

    tx.commit()
        .await
        .map_err(|e| format!("Falha ao confirmar transação: {e}"))?;

    Ok(Song {
        id: payload.id,
        title: payload.title,
        artist: payload.artist,
        ccli_number: payload.ccli_number,
        key_signature: payload.key_signature,
        language,
        notes: payload.notes,
        background_id: payload.background_id,
        slide_config: payload.slide_config,
        source: payload.source,
        created_at,
        updated_at: now,
        deleted_at: None,
        sections,
    })
}

pub async fn db_delete_song(pool: &SqlitePool, id: &str) -> Result<(), String> {
    let now = now_ms();
    let result =
        sqlx::query("UPDATE songs SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL")
            .bind(now)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| format!("Falha ao excluir música: {e}"))?;

    if result.rows_affected() == 0 {
        return Err("Música não encontrada".to_string());
    }
    Ok(())
}

pub async fn db_list_songs(
    pool: &SqlitePool,
    params: ListSongsParams,
) -> Result<Vec<Song>, String> {
    let limit = params.limit.unwrap_or(200);
    let offset = params.offset.unwrap_or(0);

    let song_rows = match params.search.as_deref() {
        Some(s) if !s.trim().is_empty() => {
            let pattern = format!("%{}%", s.trim());
            sqlx::query(
                "SELECT id, title, artist, ccli_number, key_signature, language, notes,
                         background_id, slide_config, source, created_at, updated_at, deleted_at
                 FROM songs WHERE deleted_at IS NULL AND title LIKE ?
                 ORDER BY title ASC LIMIT ? OFFSET ?",
            )
            .bind(pattern)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Falha ao listar músicas: {e}"))?
        }
        _ => sqlx::query(
            "SELECT id, title, artist, ccli_number, key_signature, language, notes,
                     background_id, slide_config, source, created_at, updated_at, deleted_at
             FROM songs WHERE deleted_at IS NULL ORDER BY title ASC LIMIT ? OFFSET ?",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Falha ao listar músicas: {e}"))?,
    };

    let mut songs = Vec::new();
    for row in &song_rows {
        let song_id: String = row.get("id");
        let sections = load_sections(pool, &song_id).await?;
        songs.push(Song {
            id: song_id,
            title: row.get("title"),
            artist: row.get("artist"),
            ccli_number: row.get("ccli_number"),
            key_signature: row.get("key_signature"),
            language: row.get("language"),
            notes: row.get("notes"),
            background_id: row.get("background_id"),
            slide_config: row.get("slide_config"),
            source: row.get("source"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            deleted_at: row.get("deleted_at"),
            sections,
        });
    }
    Ok(songs)
}

pub async fn db_get_song(pool: &SqlitePool, id: &str) -> Result<Song, String> {
    let row = sqlx::query(
        "SELECT id, title, artist, ccli_number, key_signature, language, notes,
                background_id, slide_config, source, created_at, updated_at, deleted_at
         FROM songs WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Falha ao buscar música: {e}"))?
    .ok_or_else(|| "Música não encontrada".to_string())?;

    let sections = load_sections(pool, id).await?;

    Ok(Song {
        id: row.get("id"),
        title: row.get("title"),
        artist: row.get("artist"),
        ccli_number: row.get("ccli_number"),
        key_signature: row.get("key_signature"),
        language: row.get("language"),
        notes: row.get("notes"),
        background_id: row.get("background_id"),
        slide_config: row.get("slide_config"),
        source: row.get("source"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        deleted_at: row.get("deleted_at"),
        sections,
    })
}

// ─── Tauri commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_song(
    state: State<'_, AppState>,
    app: AppHandle,
    payload: CreateSongPayload,
) -> Result<Song, String> {
    let pool = state.db.get().expect("db initialized");
    let song = db_create_song(pool, payload).await?;
    app.emit("songs_changed", SongsChangedEvent)
        .map_err(|e| e.to_string())?;
    Ok(song)
}

#[tauri::command]
pub async fn update_song(
    state: State<'_, AppState>,
    app: AppHandle,
    payload: UpdateSongPayload,
) -> Result<Song, String> {
    let pool = state.db.get().expect("db initialized");
    let song = db_update_song(pool, payload).await?;
    app.emit("songs_changed", SongsChangedEvent)
        .map_err(|e| e.to_string())?;
    Ok(song)
}

#[tauri::command]
pub async fn delete_song(
    state: State<'_, AppState>,
    app: AppHandle,
    id: String,
) -> Result<(), String> {
    let pool = state.db.get().expect("db initialized");
    db_delete_song(pool, &id).await?;
    app.emit("songs_changed", SongsChangedEvent)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn list_songs(
    state: State<'_, AppState>,
    params: Option<ListSongsParams>,
) -> Result<Vec<Song>, String> {
    let pool = state.db.get().expect("db initialized");
    db_list_songs(pool, params.unwrap_or_default()).await
}

#[tauri::command]
pub async fn get_song(state: State<'_, AppState>, id: String) -> Result<Song, String> {
    let pool = state.db.get().expect("db initialized");
    db_get_song(pool, &id).await
}
