use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use std::str::FromStr;
use tempfile::tempdir;

use tauri_app_lib::commands::set::db_load_set;
use tauri_app_lib::commands::song::{db_create_song, CreateSongPayload, SectionPayload};
use tauri_app_lib::domain::set::SetItemType;
use tauri_app_lib::domain::slide::SlideConfig;
use tauri_app_lib::domain::song::SectionType;

async fn open_test_db() -> (SqlitePool, tempfile::TempDir) {
    let dir = tempdir().expect("temp dir");
    let db_path = dir.path().join("test.db");
    let url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());
    let options = SqliteConnectOptions::from_str(&url)
        .unwrap()
        .create_if_missing(true);
    let pool = SqlitePool::connect_with(options).await.unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    (pool, dir)
}

/// Build slide groups from a loaded set (mirrors presentation.rs core logic, testable without Tauri).
async fn build_slide_groups(
    pool: &SqlitePool,
    set_id: &str,
) -> (Vec<Vec<tauri_app_lib::domain::slide::Slide>>, Vec<usize>) {
    use tauri_app_lib::domain::slide::Slide;
    use tauri_app_lib::services::slide_splitter;

    let service_set = db_load_set(pool, set_id).await.unwrap();
    let config = SlideConfig::default();
    let mut computed: Vec<Vec<Slide>> = Vec::new();

    for item in &service_set.items {
        let slides = match item.item_type {
            SetItemType::Song => {
                if let Some(song_id) = &item.song_id {
                    use tauri_app_lib::commands::song::load_sections;
                    let sections = load_sections(pool, song_id).await.unwrap();
                    let s: Vec<Slide> = sections
                        .iter()
                        .flat_map(|sec| slide_splitter::split(sec, &config))
                        .collect();
                    if s.is_empty() {
                        vec![Slide { lines: vec![], section_label: String::new(), section_id: String::new() }]
                    } else {
                        s
                    }
                } else {
                    vec![Slide { lines: vec![], section_label: String::new(), section_id: String::new() }]
                }
            }
            SetItemType::Media => vec![Slide::pseudo("media")],
            SetItemType::Countdown => vec![Slide::pseudo("countdown")],
            SetItemType::WebView => vec![Slide::pseudo("webview")],
            SetItemType::Blank => vec![Slide { lines: vec![], section_label: String::new(), section_id: String::new() }],
            SetItemType::SlideShow => vec![Slide::pseudo_slideshow(0)],
        };
        computed.push(slides);
    }

    let counts: Vec<usize> = computed.iter().map(|s| s.len()).collect();
    (computed, counts)
}

#[tokio::test]
async fn five_variant_set_produces_correct_slide_counts() {
    let (pool, _dir) = open_test_db().await;

    // Create a song with two sections (should produce 2+ slides)
    let song = db_create_song(
        &pool,
        CreateSongPayload {
            title: "Test Song".into(),
            artist: None,
            author: None,
            copyright: None,
            ccli_number: None,
            key_signature: None,
            language: Some("pt".into()),
            notes: None,
            background_id: None,
            scrim_opacity: None,
            slide_config: None,
            source: None,
            background_mode: None,
            background_preset: None,
            font_family: None,
            font_size: None,
            sections: vec![
                SectionPayload {
                    label: "Verse 1".into(),
                    section_type: SectionType::Verse,
                    body: "Line one\nLine two\nLine three\nLine four".into(),
                    sort_order: 0,
                    repeat_count: Some(1),
                    notes: None,
                    background_id: None,
                    background_mode: None,
                    background_preset: None,
                    font_family: None,
                    font_size: None,
                },
                SectionPayload {
                    label: "Chorus".into(),
                    section_type: SectionType::Chorus,
                    body: "Chorus line one\nChorus line two".into(),
                    sort_order: 1,
                    repeat_count: Some(1),
                    notes: None,
                    background_id: None,
                    background_mode: None,
                    background_preset: None,
                    font_family: None,
                    font_size: None,
                },
            ],
        },
    )
    .await
    .unwrap();

    // Create a set with one item of each type: Song, Media, Countdown, WebView, Blank
    sqlx::query(
        "INSERT INTO sets (id, name, created_at, updated_at) VALUES ('set1', 'Test Set', 0, 0)",
    )
    .execute(&pool)
    .await
    .unwrap();

    let items_sql = [
        ("item-song", "song", Some(song.id.as_str()), 0),
        ("item-media", "media", None, 1),
        ("item-countdown", "countdown", None, 2),
        ("item-webview", "web_view", None, 3),
        ("item-blank", "blank", None, 4),
    ];
    for (id, item_type, song_id, order) in items_sql {
        sqlx::query(
            "INSERT INTO set_items (id, set_id, item_type, song_id, sort_order) VALUES (?, 'set1', ?, ?, ?)",
        )
        .bind(id)
        .bind(item_type)
        .bind(song_id)
        .bind(order)
        .execute(&pool)
        .await
        .unwrap();
    }

    let (_, counts) = build_slide_groups(&pool, "set1").await;

    // Song with 2 sections = 2 slides; all other types = 1 pseudo-slide each
    assert_eq!(counts.len(), 5, "should have 5 items");
    assert_eq!(counts[0], 2, "song should have 2 slides (one per section)");
    assert_eq!(counts[1], 1, "media pseudo-slide");
    assert_eq!(counts[2], 1, "countdown pseudo-slide");
    assert_eq!(counts[3], 1, "webview pseudo-slide");
    assert_eq!(counts[4], 1, "blank pseudo-slide");
}
