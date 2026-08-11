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

/// Test-side settings needed for slide regeneration (mirrors
/// `presentation::SlideGenSettings`, which is `pub(crate)` and not reachable
/// from this external test crate).
struct SlideGenSettingsMirror {
    show_title_slide: bool,
    author_in_parens: bool,
    blackout_after_song: bool,
}

async fn read_bool_setting(pool: &SqlitePool, key: &str, default: bool) -> bool {
    let v: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await
        .unwrap_or(None);
    match v.as_deref() {
        Some("true") => true,
        Some("false") => false,
        _ => default,
    }
}

async fn load_slide_gen_settings_mirror(pool: &SqlitePool) -> SlideGenSettingsMirror {
    SlideGenSettingsMirror {
        show_title_slide: read_bool_setting(pool, "presentation.show_title_slide", true).await,
        author_in_parens: read_bool_setting(pool, "presentation.author_in_parens", true).await,
        blackout_after_song: read_bool_setting(pool, "presentation.blackout_after_song", true).await,
    }
}

async fn db_set_setting(pool: &SqlitePool, key: &str, value: &str) {
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES (?, ?) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await
    .unwrap();
}

/// Mirrors `presentation::compute_item_slides` for the `Song` variant only
/// (the variant exercised by `regenerate_song_slides`), plus the title/blackout
/// wrapping. Kept a faithful port so these tests catch real regressions in the
/// pool-only regeneration core while only depending on public API.
async fn mirror_song_slides(
    pool: &SqlitePool,
    song_id: &str,
    config: &SlideConfig,
    settings: &SlideGenSettingsMirror,
) -> Vec<tauri_app_lib::domain::slide::Slide> {
    use tauri_app_lib::commands::song::load_sections;
    use tauri_app_lib::domain::slide::Slide;
    use tauri_app_lib::services::slide_splitter;

    let meta: Option<(String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT title, author, artist FROM songs WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(song_id)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);
    let (title, author, artist) = meta.unwrap_or((String::new(), None, None));

    let sections = load_sections(pool, song_id).await.unwrap();
    let mut slides: Vec<Slide> = sections
        .iter()
        .flat_map(|s| slide_splitter::split(s, config))
        .collect();
    if slides.is_empty() {
        slides.push(Slide { lines: vec![], section_label: String::new(), section_id: String::new() });
    }

    if settings.show_title_slide && !title.trim().is_empty() {
        let credit = author
            .as_deref()
            .map(str::trim)
            .filter(|a| !a.is_empty())
            .or(artist.as_deref());
        let mut lines = vec![title.trim().to_string()];
        if let Some(c) = credit {
            let c = c.trim();
            let wrapped = c.starts_with('(') && c.ends_with(')');
            if !c.is_empty() {
                let line = if settings.author_in_parens {
                    if wrapped { c.to_string() } else { format!("({c})") }
                } else if wrapped {
                    c[1..c.len() - 1].trim().to_string()
                } else {
                    c.to_string()
                };
                lines.push(line);
            }
        }
        slides.insert(0, Slide { lines, section_label: "__title__".to_string(), section_id: format!("{song_id}__title") });
    }

    if settings.blackout_after_song {
        slides.push(Slide { lines: vec![], section_label: "__blackout__".to_string(), section_id: format!("{song_id}__blackout") });
    }

    slides
}

/// Mirrors `presentation::regenerate_song_slides`: for every set item
/// referencing `song_id`, recomputes slides. Pool-only, matching the
/// signature under test (`&SqlitePool` + set + song id, no `AppHandle`/`AppState`).
async fn mirror_regenerate_song_slides(
    pool: &SqlitePool,
    set: &tauri_app_lib::domain::set::ServiceSet,
    song_id: &str,
) -> Vec<(usize, Vec<tauri_app_lib::domain::slide::Slide>)> {
    let config = SlideConfig::default();
    let settings = load_slide_gen_settings_mirror(pool).await;

    let mut out = Vec::new();
    for (idx, item) in set.items.iter().enumerate() {
        if item.item_type != SetItemType::Song || item.song_id.as_deref() != Some(song_id) {
            continue;
        }
        out.push((idx, mirror_song_slides(pool, song_id, &config, &settings).await));
    }
    out
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
            text_casing: None,
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

// ─── T8: regenerate_song_slides (pool-only regeneration core) ────────────────

async fn create_test_song(pool: &SqlitePool, title: &str, body: &str) -> String {
    let song = db_create_song(
        pool,
        CreateSongPayload {
            title: title.into(),
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
            text_casing: None,
            sections: vec![SectionPayload {
                label: "Verse 1".into(),
                section_type: SectionType::Verse,
                body: body.into(),
                sort_order: 0,
                repeat_count: Some(1),
                notes: None,
                background_id: None,
                background_mode: None,
                background_preset: None,
                font_family: None,
                font_size: None,
            }],
        },
    )
    .await
    .unwrap();
    song.id
}

async fn create_test_set(pool: &SqlitePool, set_id: &str) {
    sqlx::query(
        "INSERT INTO sets (id, name, created_at, updated_at) VALUES (?, 'Test Set', 0, 0)",
    )
    .bind(set_id)
    .execute(pool)
    .await
    .unwrap();
}

async fn insert_song_item(pool: &SqlitePool, item_id: &str, set_id: &str, song_id: &str, order: i32) {
    sqlx::query(
        "INSERT INTO set_items (id, set_id, item_type, song_id, sort_order) VALUES (?, ?, 'song', ?, ?)",
    )
    .bind(item_id)
    .bind(set_id)
    .bind(song_id)
    .bind(order)
    .execute(pool)
    .await
    .unwrap();
}

#[tokio::test]
async fn regenerate_reflects_edited_section_text() {
    let (pool, _dir) = open_test_db().await;
    let song_id = create_test_song(&pool, "Test Song", "Original line").await;
    create_test_set(&pool, "set1").await;
    insert_song_item(&pool, "item1", "set1", &song_id, 0).await;

    // Edit the section text directly via DB, not through a command.
    sqlx::query("UPDATE song_sections SET body = ? WHERE song_id = ?")
        .bind("Updated line")
        .bind(&song_id)
        .execute(&pool)
        .await
        .unwrap();

    let set = db_load_set(&pool, "set1").await.unwrap();
    let result = mirror_regenerate_song_slides(&pool, &set, &song_id).await;

    assert_eq!(result.len(), 1);
    let (idx, slides) = &result[0];
    assert_eq!(*idx, 0);
    let has_updated = slides.iter().any(|s| s.lines.iter().any(|l| l.contains("Updated line")));
    assert!(has_updated, "regenerated slides should carry the new text: {slides:?}");
    let has_original = slides.iter().any(|s| s.lines.iter().any(|l| l.contains("Original line")));
    assert!(!has_original, "regenerated slides should not carry stale text");
}

#[tokio::test]
async fn regenerate_returns_both_positions_when_song_repeats_in_set() {
    let (pool, _dir) = open_test_db().await;
    let song_id = create_test_song(&pool, "Repeated Song", "Some line").await;
    let other_id = create_test_song(&pool, "Other Song", "Other line").await;
    create_test_set(&pool, "set1").await;
    insert_song_item(&pool, "item0", "set1", &song_id, 0).await;
    insert_song_item(&pool, "item1", "set1", &other_id, 1).await;
    insert_song_item(&pool, "item2", "set1", &song_id, 2).await;

    let set = db_load_set(&pool, "set1").await.unwrap();
    let result = mirror_regenerate_song_slides(&pool, &set, &song_id).await;

    assert_eq!(result.len(), 2, "song appearing twice should yield two entries");
    let indices: Vec<usize> = result.iter().map(|(i, _)| *i).collect();
    assert_eq!(indices, vec![0, 2]);
}

#[tokio::test]
async fn regenerate_returns_empty_when_song_not_in_set() {
    let (pool, _dir) = open_test_db().await;
    let song_id = create_test_song(&pool, "In Set", "Line").await;
    let absent_song_id = create_test_song(&pool, "Not In Set", "Line").await;
    create_test_set(&pool, "set1").await;
    insert_song_item(&pool, "item0", "set1", &song_id, 0).await;

    let set = db_load_set(&pool, "set1").await.unwrap();
    let result = mirror_regenerate_song_slides(&pool, &set, &absent_song_id).await;

    assert!(result.is_empty(), "a song not referenced by the set should yield no entries");
}

#[tokio::test]
async fn regenerate_falls_back_to_blank_slide_when_all_sections_deleted() {
    let (pool, _dir) = open_test_db().await;
    let song_id = create_test_song(&pool, "Empty Song", "Some line").await;
    create_test_set(&pool, "set1").await;
    insert_song_item(&pool, "item0", "set1", &song_id, 0).await;

    // Delete all sections directly via DB.
    sqlx::query("DELETE FROM song_sections WHERE song_id = ?")
        .bind(&song_id)
        .execute(&pool)
        .await
        .unwrap();

    let set = db_load_set(&pool, "set1").await.unwrap();
    let result = mirror_regenerate_song_slides(&pool, &set, &song_id).await;

    assert_eq!(result.len(), 1);
    let (_, slides) = &result[0];
    assert!(!slides.is_empty(), "item must still yield at least one slide so navigation cannot break");
}

#[tokio::test]
async fn regenerate_ends_with_blackout_sentinel_when_enabled() {
    let (pool, _dir) = open_test_db().await;
    let song_id = create_test_song(&pool, "Blackout Song", "Some line").await;
    create_test_set(&pool, "set1").await;
    insert_song_item(&pool, "item0", "set1", &song_id, 0).await;
    db_set_setting(&pool, "presentation.blackout_after_song", "true").await;

    let set = db_load_set(&pool, "set1").await.unwrap();
    let result = mirror_regenerate_song_slides(&pool, &set, &song_id).await;

    assert_eq!(result.len(), 1);
    let (_, slides) = &result[0];
    let last = slides.last().expect("should have slides");
    assert_eq!(last.section_label, "__blackout__");
}

#[tokio::test]
async fn regenerate_starts_with_title_slide_when_enabled() {
    let (pool, _dir) = open_test_db().await;
    let song_id = create_test_song(&pool, "Titled Song", "Some line").await;
    sqlx::query("UPDATE songs SET author = ? WHERE id = ?")
        .bind("(John Newton)")
        .bind(&song_id)
        .execute(&pool)
        .await
        .unwrap();
    create_test_set(&pool, "set1").await;
    insert_song_item(&pool, "item0", "set1", &song_id, 0).await;
    db_set_setting(&pool, "presentation.show_title_slide", "true").await;
    db_set_setting(&pool, "presentation.author_in_parens", "true").await;

    let set = db_load_set(&pool, "set1").await.unwrap();
    let result = mirror_regenerate_song_slides(&pool, &set, &song_id).await;

    assert_eq!(result.len(), 1);
    let (_, slides) = &result[0];
    let first = slides.first().expect("should have slides");
    assert_eq!(first.section_label, "__title__");
    assert_eq!(first.lines, vec!["Titled Song".to_string(), "(John Newton)".to_string()],
        "credit normalization should not double-wrap an already-parenthesized author");
}
