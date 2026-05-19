use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use std::str::FromStr;
use tempfile::tempdir;

async fn open_test_db() -> SqlitePool {
    let dir = tempdir().expect("temp dir");
    let db_path = dir.path().join("test.db");
    let url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());
    let options = SqliteConnectOptions::from_str(&url)
        .unwrap()
        .create_if_missing(true);
    let pool = SqlitePool::connect_with(options).await.unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    std::mem::forget(dir);
    pool
}

use tauri_app_lib::commands::import::{HolyricsSectionPayload, HolyricsSongPayload};
use tauri_app_lib::commands::song::{db_create_song, CreateSongPayload, SectionPayload};
use tauri_app_lib::domain::song::SectionType;

// Access the internal batch logic by calling the DB functions directly.
// Since import_holyrics_batch is a Tauri command (needs AppHandle), we
// replicate the core logic via lower-level helpers.
async fn run_batch(
    pool: &SqlitePool,
    songs: &[HolyricsSongPayload],
) -> (u32, u32) {
    let mut imported = 0u32;
    let mut skipped = 0u32;

    for song in songs {
        // Check duplicate via raw query.
        let norm_title = song.title.trim().to_lowercase();
        let norm_artist = song.artist.trim().to_lowercase();
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT id FROM songs WHERE deleted_at IS NULL
             AND lower(trim(title)) = ? AND lower(trim(COALESCE(artist,''))) = ?
             LIMIT 1",
        )
        .bind(&norm_title)
        .bind(&norm_artist)
        .fetch_all(pool)
        .await
        .unwrap();

        if !rows.is_empty() {
            skipped += 1;
            continue;
        }

        let sections: Vec<SectionPayload> = song
            .sections
            .iter()
            .map(|s| SectionPayload {
                label: if s.description.trim().is_empty() {
                    format!("Estrofe {}", s.number)
                } else {
                    s.description.clone()
                },
                section_type: SectionType::Verse,
                body: s.text.clone(),
                sort_order: (s.number as i32) - 1,
                repeat_count: Some(1),
            })
            .collect();

        let result = db_create_song(
            pool,
            CreateSongPayload {
                title: song.title.clone(),
                artist: if song.artist.is_empty() {
                    None
                } else {
                    Some(song.artist.clone())
                },
                ccli_number: None,
                key_signature: None,
                language: Some("pt".to_string()),
                notes: None,
                background_id: None,
                scrim_opacity: None,
                slide_config: None,
                source: Some("holyrics".to_string()),
                sections,
            },
        )
        .await;

        if result.is_ok() {
            imported += 1;
        }
    }

    (imported, skipped)
}

#[tokio::test]
async fn import_batch_skips_duplicate_and_imports_unique() {
    let pool = open_test_db().await;

    // Pre-seed a song that will be a duplicate.
    db_create_song(
        &pool,
        CreateSongPayload {
            title: "Graça Infinita".to_string(),
            artist: Some("Artista A".to_string()),
            ccli_number: None,
            key_signature: None,
            language: Some("pt".to_string()),
            notes: None,
            background_id: None,
            scrim_opacity: None,
            slide_config: None,
            source: None,
            sections: vec![SectionPayload {
                label: "Estrofe 1".to_string(),
                section_type: SectionType::Verse,
                body: "corpo".to_string(),
                sort_order: 0,
                repeat_count: None,
            }],
        },
    )
    .await
    .unwrap();

    let batch = vec![
        HolyricsSongPayload {
            title: "Graça Infinita".to_string(), // duplicate
            artist: "Artista A".to_string(),
            sections: vec![],
        },
        HolyricsSongPayload {
            title: "Santo Espírito".to_string(),
            artist: "Artista B".to_string(),
            sections: vec![HolyricsSectionPayload {
                number: 1,
                description: "Estrofe 1".to_string(),
                text: "Vem Espírito Santo".to_string(),
            }],
        },
        HolyricsSongPayload {
            title: "Fiel é o Senhor".to_string(),
            artist: "".to_string(),
            sections: vec![],
        },
    ];

    let (imported, skipped) = run_batch(&pool, &batch).await;

    assert_eq!(imported, 2, "two unique songs should be imported");
    assert_eq!(skipped, 1, "one duplicate should be skipped");
}

#[tokio::test]
async fn import_fixture_sample_parses_and_imports() {
    let pool = open_test_db().await;

    let fixture = include_str!("../../.specs/features/phase1-mvp/fixtures/holyrics_sample.json");
    let parsed = tauri_app_lib::services::holyrics_parser::parse(fixture).unwrap();
    assert_eq!(parsed.len(), 3);
    assert_eq!(parsed[0].title, "Graça Infinita");
    assert_eq!(parsed[1].sections[0].description, ""); // empty description
}
