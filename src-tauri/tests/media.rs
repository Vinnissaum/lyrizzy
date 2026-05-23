use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use std::str::FromStr;
use tauri_app_lib::db::media::{
    db_count_references, db_get_references, db_insert_media, db_list_media, db_rename_media,
    db_soft_delete_media, unique_display_name, ListMediaParams,
};
use tauri_app_lib::domain::media::{Media, MediaKind};
use tempfile::tempdir;

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

fn make_media(id: &str, file_name: &str, kind: MediaKind) -> Media {
    Media {
        id: id.to_string(),
        file_name: file_name.to_string(),
        display_name: file_name.to_string(),
        kind,
        mime_type: "image/png".to_string(),
        width: Some(1920),
        height: Some(1080),
        duration_ms: None,
        thumbnail_file: None,
        byte_size: 1024,
        created_at: 1_000_000,
        updated_at: 1_000_000,
        deleted_at: None,
        slide_count: None,
    }
}

#[tokio::test]
async fn insert_and_list_media_happy_path() {
    let (pool, _dir) = open_test_db().await;

    let m = make_media("m1", "bg.png", MediaKind::Image);
    db_insert_media(&pool, &m).await.unwrap();

    let rows = db_list_media(
        &pool,
        &ListMediaParams {
            kind: None,
            search: None,
            limit: None,
            offset: None,
        },
    )
    .await
    .unwrap();

    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].id, "m1");
    assert_eq!(rows[0].display_name, "bg.png");
    assert!(matches!(rows[0].kind, MediaKind::Image));
}

#[tokio::test]
async fn list_media_kind_filter() {
    let (pool, _dir) = open_test_db().await;

    db_insert_media(&pool, &make_media("img1", "photo.png", MediaKind::Image))
        .await
        .unwrap();
    db_insert_media(&pool, &make_media("vid1", "clip.mp4", MediaKind::Video))
        .await
        .unwrap();

    let images = db_list_media(
        &pool,
        &ListMediaParams {
            kind: Some(MediaKind::Image),
            search: None,
            limit: None,
            offset: None,
        },
    )
    .await
    .unwrap();
    assert_eq!(images.len(), 1, "filter by Image should return 1 row");
    assert_eq!(images[0].id, "img1");

    let videos = db_list_media(
        &pool,
        &ListMediaParams {
            kind: Some(MediaKind::Video),
            search: None,
            limit: None,
            offset: None,
        },
    )
    .await
    .unwrap();
    assert_eq!(videos.len(), 1, "filter by Video should return 1 row");
    assert_eq!(videos[0].id, "vid1");
}

#[tokio::test]
async fn rename_media_updates_display_name() {
    let (pool, _dir) = open_test_db().await;

    db_insert_media(&pool, &make_media("m2", "old.png", MediaKind::Image))
        .await
        .unwrap();

    let updated = db_rename_media(&pool, "m2", "new name.png", 2_000_000)
        .await
        .unwrap()
        .expect("row must exist after rename");

    assert_eq!(updated.display_name, "new name.png");
    assert_eq!(updated.updated_at, 2_000_000);
}

#[tokio::test]
async fn rename_media_nonexistent_returns_none() {
    let (pool, _dir) = open_test_db().await;
    let result = db_rename_media(&pool, "does-not-exist", "name", 1_000_000)
        .await
        .unwrap();
    assert!(result.is_none());
}

#[tokio::test]
async fn soft_delete_excludes_from_list() {
    let (pool, _dir) = open_test_db().await;

    db_insert_media(&pool, &make_media("m3", "file.png", MediaKind::Image))
        .await
        .unwrap();
    db_soft_delete_media(&pool, "m3", 9_999_999).await.unwrap();

    let rows = db_list_media(
        &pool,
        &ListMediaParams {
            kind: None,
            search: None,
            limit: None,
            offset: None,
        },
    )
    .await
    .unwrap();

    assert!(
        rows.iter().all(|r| r.id != "m3"),
        "deleted row must not appear in list"
    );
}

#[tokio::test]
async fn count_references_with_song() {
    let (pool, _dir) = open_test_db().await;

    db_insert_media(&pool, &make_media("m4", "bg.png", MediaKind::Image))
        .await
        .unwrap();

    // Insert a song referencing m4 as background
    sqlx::query(
        "INSERT INTO songs (id, title, language, background_id, created_at, updated_at) \
         VALUES ('s1', 'Test', 'pt', 'm4', 1000000, 1000000)",
    )
    .execute(&pool)
    .await
    .unwrap();

    let (song_count, set_item_count, section_count) = db_count_references(&pool, "m4").await.unwrap();
    assert_eq!(song_count, 1);
    assert_eq!(set_item_count, 0);
    assert_eq!(section_count, 0);
}

#[tokio::test]
async fn count_references_zero_when_no_refs() {
    let (pool, _dir) = open_test_db().await;
    db_insert_media(&pool, &make_media("m5", "alone.png", MediaKind::Image))
        .await
        .unwrap();

    let (songs, items, sections) = db_count_references(&pool, "m5").await.unwrap();
    assert_eq!(songs, 0);
    assert_eq!(items, 0);
    assert_eq!(sections, 0);
}

#[tokio::test]
async fn get_references_returns_song_details() {
    let (pool, _dir) = open_test_db().await;

    db_insert_media(&pool, &make_media("m6", "bg.png", MediaKind::Image))
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO songs (id, title, language, background_id, created_at, updated_at) \
         VALUES ('s2', 'Hallelujah', 'pt', 'm6', 1000000, 1000000)",
    )
    .execute(&pool)
    .await
    .unwrap();

    let refs = db_get_references(&pool, "m6").await.unwrap();
    assert_eq!(refs.songs.len(), 1);
    assert_eq!(refs.songs[0].title, "Hallelujah");
    assert!(refs.set_items.is_empty());
    assert!(refs.sections.is_empty());
}

#[tokio::test]
async fn count_and_get_references_includes_sections() {
    let (pool, _dir) = open_test_db().await;

    db_insert_media(&pool, &make_media("bg-sec", "sec-bg.png", MediaKind::Image))
        .await
        .unwrap();

    // Insert a song + section referencing the media as section background
    sqlx::query(
        "INSERT INTO songs (id, title, language, created_at, updated_at) \
         VALUES ('song-sec', 'My Song', 'pt', 1, 1)",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO song_sections (id, song_id, label, type, body, sort_order, repeat_count, background_id) \
         VALUES ('sec-1', 'song-sec', 'Verse 1', 'verse', 'Line', 0, 1, 'bg-sec')",
    )
    .execute(&pool)
    .await
    .unwrap();

    // Section reference blocks delete
    let (song_count, item_count, section_count) = db_count_references(&pool, "bg-sec").await.unwrap();
    assert_eq!(song_count, 0);
    assert_eq!(item_count, 0);
    assert_eq!(section_count, 1);

    let refs = db_get_references(&pool, "bg-sec").await.unwrap();
    assert!(refs.songs.is_empty());
    assert!(refs.set_items.is_empty());
    assert_eq!(refs.sections.len(), 1);
    assert_eq!(refs.sections[0].song_title, "My Song");
    assert_eq!(refs.sections[0].section_label, "Verse 1");

    // Clear the section's background_id → delete should now succeed
    sqlx::query("UPDATE song_sections SET background_id = NULL WHERE id = 'sec-1'")
        .execute(&pool)
        .await
        .unwrap();

    let (_, _, section_count_after) = db_count_references(&pool, "bg-sec").await.unwrap();
    assert_eq!(section_count_after, 0);

    db_soft_delete_media(&pool, "bg-sec", 9999).await.unwrap();
    let after = db_list_media(&pool, &ListMediaParams {
        kind: None,
        search: None,
        limit: None,
        offset: None,
    }).await.unwrap();
    assert!(after.iter().all(|m| m.id != "bg-sec"), "deleted media should not appear in list");
}

#[tokio::test]
async fn unique_display_name_resolves_collision() {
    let (pool, _dir) = open_test_db().await;

    db_insert_media(&pool, &make_media("c1", "background.png", MediaKind::Image))
        .await
        .unwrap();

    let name = unique_display_name(&pool, "background.png")
        .await
        .unwrap();
    assert_eq!(name, "background (2).png");

    // Insert background (2).png and verify (3) is next
    let mut m2 = make_media("c2", "background (2).png", MediaKind::Image);
    m2.display_name = "background (2).png".to_string();
    db_insert_media(&pool, &m2).await.unwrap();

    let name3 = unique_display_name(&pool, "background.png")
        .await
        .unwrap();
    assert_eq!(name3, "background (3).png");
}

#[tokio::test]
async fn unique_display_name_no_collision_returns_original() {
    let (pool, _dir) = open_test_db().await;
    let name = unique_display_name(&pool, "fresh.png").await.unwrap();
    assert_eq!(name, "fresh.png");
}
