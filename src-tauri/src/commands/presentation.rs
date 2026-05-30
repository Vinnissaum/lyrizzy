use crate::commands::set::db_load_set;
use crate::commands::song::load_sections;
use crate::domain::error::ErrorPayload;
use crate::domain::presentation::{PresentationMode, PresentationState};
use crate::domain::set::{SetItem, SetItemType};
use crate::domain::slide::{RepeatMode, Slide, SlideConfig};
use crate::services::{background, play_counter, slide_splitter};
use crate::state::AppState;
use sqlx::SqlitePool;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::RwLock;

fn blank_slide() -> Slide {
    Slide {
        lines: vec![],
        section_label: String::new(),
        section_id: String::new(),
    }
}

fn sections_to_slides(
    sections: &[crate::domain::song::SongSection],
    config: &SlideConfig,
    casing: crate::domain::song::TextCasing,
    repeat_mode: RepeatMode,
) -> Vec<Slide> {
    sections
        .iter()
        .flat_map(|s| slide_splitter::split_with_casing(s, config, casing, repeat_mode))
        .collect()
}

/// Synthetic section label used to mark the song title/author intro slide.
/// The frontend detects this to render the title big and the author smaller.
pub const TITLE_SLIDE_LABEL: &str = "__title__";

/// Reads a boolean app setting, returning `default` when unset/unrecognized.
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

/// Reads a string app setting, returning `None` when unset.
async fn read_string_setting(pool: &SqlitePool, key: &str) -> Option<String> {
    sqlx::query_scalar("SELECT value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await
        .unwrap_or(None)
}

/// Resolves the credit line for the title slide. Most users fill the prominent
/// "Artist" field, so fall back to it when the (collapsed) "Author" field is
/// empty/blank.
fn resolve_title_credit<'a>(author: Option<&'a str>, artist: Option<&'a str>) -> Option<&'a str> {
    author
        .map(str::trim)
        .filter(|a| !a.is_empty())
        .or(artist)
}

/// Builds the optional title/author intro slide for a song.
fn build_title_slide(
    song_id: &str,
    title: &str,
    author: Option<&str>,
    author_in_parens: bool,
) -> Option<Slide> {
    if title.trim().is_empty() {
        return None;
    }
    let mut lines = vec![title.trim().to_string()];
    if let Some(a) = author.map(str::trim).filter(|a| !a.is_empty()) {
        lines.push(if author_in_parens {
            format!("({a})")
        } else {
            a.to_string()
        });
    }
    Some(Slide {
        lines,
        section_label: TITLE_SLIDE_LABEL.to_string(),
        section_id: format!("{song_id}__title"),
    })
}

fn resolve_next_slide(all_slides: &[Vec<Slide>], state: &PresentationState) -> Option<Slide> {
    if all_slides.is_empty() {
        return None;
    }
    let item_idx = state.current_item_index;
    let slide_idx = state.current_slide_index;
    let item_len = all_slides.get(item_idx).map(|s| s.len()).unwrap_or(0);
    if slide_idx + 1 < item_len {
        all_slides.get(item_idx).and_then(|s| s.get(slide_idx + 1)).cloned()
    } else if item_idx + 1 < all_slides.len() {
        all_slides.get(item_idx + 1).and_then(|s| s.first()).cloned()
    } else {
        None
    }
}

/// Operator-initiated navigation should re-light the screen. If we are blacked
/// out (Blank — e.g. a countdown ended with the Blackout behavior), waking to
/// Live ensures the freshly selected slide renders instead of staying black.
/// Without this, `resolve_current_slide` returns `None` for `Blank` and the
/// presentation appears frozen after a blackout.
fn wake_to_live(state: &mut PresentationState) {
    if state.mode == PresentationMode::Blank {
        state.mode = PresentationMode::Live;
        state.frozen_at = None;
    }
}

fn resolve_current_slide(
    all_slides: &[Vec<Slide>],
    state: &PresentationState,
) -> Option<Slide> {
    match state.mode {
        PresentationMode::Idle | PresentationMode::Blank => None,
        PresentationMode::Live => all_slides
            .get(state.current_item_index)
            .and_then(|s| s.get(state.current_slide_index))
            .cloned(),
        PresentationMode::Frozen => {
            let (ii, si) = state
                .frozen_at
                .unwrap_or((state.current_item_index, state.current_slide_index));
            all_slides
                .get(ii)
                .and_then(|s| s.get(si))
                .cloned()
        }
    }
}

/// Resolves the effective background for a set item + current section.
/// Non-song items always return `None`.
/// Uses the section → song → None fallback chain via `services::background`.
async fn resolve_background_for_item(
    pool: &SqlitePool,
    item: &SetItem,
    section_id: &str,
) -> Option<crate::domain::background::BackgroundInfo> {
    if item.item_type != SetItemType::Song {
        return None;
    }
    let song_id = item.song_id.as_deref()?;
    background::resolve_for_slide(pool, song_id, section_id)
        .await
        .ok()
        .flatten()
}

async fn emit_state(app: &AppHandle, state: &PresentationState) -> Result<(), ErrorPayload> {
    tracing::info!(
        item = state.current_item_index,
        slide = state.current_slide_index,
        mode = ?state.mode,
        overlay = state.overlay.is_some(),
        "emit state_changed"
    );
    app.emit("state_changed", state)
        .map_err(|e| ErrorPayload::from(e.to_string()))
}

/// Shared next-slide logic — callable from commands and the countdown ticker task.
pub async fn do_next_slide(
    pool: &SqlitePool,
    presentation: &Arc<RwLock<PresentationState>>,
    presentation_slides: &Arc<RwLock<Vec<Vec<Slide>>>>,
    app: &AppHandle,
) -> Result<PresentationState, ErrorPayload> {
    let slides = presentation_slides.read().await;
    let mut pres = presentation.write().await;
    wake_to_live(&mut pres);
    let prev_item_idx = pres.current_item_index;
    let prev_section_id = pres.current_slide.as_ref().map(|s| s.section_id.clone());

    if !slides.is_empty() {
        let item_idx = pres.current_item_index;
        let slide_idx = pres.current_slide_index;
        let item_len = slides.get(item_idx).map(|s| s.len()).unwrap_or(0);
        if slide_idx + 1 < item_len {
            pres.current_slide_index = slide_idx + 1;
        } else if item_idx + 1 < slides.len() {
            pres.current_item_index = item_idx + 1;
            pres.current_slide_index = 0;
        }
    }

    pres.current_slide = resolve_current_slide(&slides, &pres);
    pres.next_slide = resolve_next_slide(&slides, &pres);

    let new_section_id = pres.current_slide.as_ref().map(|s| s.section_id.clone());
    if pres.current_item_index != prev_item_idx || new_section_id != prev_section_id {
        let item = pres.set.as_ref().and_then(|s| s.items.get(pres.current_item_index)).cloned();
        let sid = new_section_id.as_deref().unwrap_or("");
        pres.background = if let Some(ref item) = item {
            resolve_background_for_item(pool, item, sid).await
        } else {
            None
        };
    }

    let new_state = pres.clone();
    drop(pres);
    drop(slides);
    emit_state(app, &new_state).await?;
    Ok(new_state)
}

/// Set presentation mode to Blank — callable from commands and the countdown ticker.
pub async fn do_blank_presentation(
    presentation: &Arc<RwLock<PresentationState>>,
    presentation_slides: &Arc<RwLock<Vec<Vec<Slide>>>>,
    app: &AppHandle,
) -> Result<(), ErrorPayload> {
    let slides = presentation_slides.read().await;
    let mut pres = presentation.write().await;
    pres.frozen_at = None;
    pres.mode = PresentationMode::Blank;
    pres.current_slide = resolve_current_slide(&slides, &pres);
    pres.next_slide = resolve_next_slide(&slides, &pres);
    let new_state = pres.clone();
    drop(pres);
    drop(slides);
    emit_state(app, &new_state).await
}

// ─── Tauri commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn load_set_for_presentation(
    state: State<'_, AppState>,
    app: AppHandle,
    set_id: String,
) -> Result<PresentationState, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");
    let service_set = db_load_set(pool, &set_id).await?;
    let config = SlideConfig::default();

    let show_title_slide = read_bool_setting(pool, "presentation.show_title_slide", true).await;
    let author_in_parens = read_bool_setting(pool, "presentation.author_in_parens", true).await;
    let repeat_mode =
        RepeatMode::from_opt(read_string_setting(pool, "presentation.repeat_mode").await.as_deref());

    let mut computed_slides: Vec<Vec<Slide>> = Vec::new();
    for item in &service_set.items {
        let slides = match item.item_type {
            SetItemType::Song => {
                if let Some(song_id) = &item.song_id {
                    let meta: Option<(String, Option<String>, Option<String>, Option<String>)> =
                        sqlx::query_as(
                            "SELECT title, author, artist, text_casing FROM songs WHERE id = ? AND deleted_at IS NULL",
                        )
                        .bind(song_id)
                        .fetch_optional(pool)
                        .await
                        .unwrap_or(None);
                    let (title, author, artist, casing_str) = match meta {
                        Some((t, au, ar, c)) => (t, au, ar, c),
                        None => (String::new(), None, None, None),
                    };
                    let casing = crate::domain::song::TextCasing::from_opt(casing_str.as_deref());
                    let sections = load_sections(pool, song_id).await?;
                    let mut s = sections_to_slides(&sections, &config, casing, repeat_mode);
                    if s.is_empty() {
                        s = vec![blank_slide()];
                    }
                    if show_title_slide {
                        // Most users fill the prominent "Artist" field; fall back
                        // to it when the (collapsed) "Author" field is empty.
                        let credit = resolve_title_credit(author.as_deref(), artist.as_deref());
                        if let Some(title_slide) =
                            build_title_slide(song_id, &title, credit, author_in_parens)
                        {
                            s.insert(0, title_slide);
                        }
                    }
                    s
                } else {
                    vec![blank_slide()]
                }
            }
            SetItemType::Media => vec![Slide::pseudo("media")],
            SetItemType::Countdown => vec![Slide::pseudo("countdown")],
            SetItemType::WebView => vec![Slide::pseudo("webview")],
            SetItemType::Blank => vec![blank_slide()],
            SetItemType::SlideShow => {
                if let Some(media_id) = &item.media_id {
                    let n: Option<i64> = sqlx::query_scalar(
                        "SELECT slide_count FROM media WHERE id = ? AND deleted_at IS NULL",
                    )
                    .bind(media_id)
                    .fetch_optional(pool)
                    .await
                    .unwrap_or(None)
                    .flatten();
                    let count = n.unwrap_or(1).max(1) as usize;
                    (0..count).map(Slide::pseudo_slideshow).collect()
                } else {
                    vec![blank_slide()]
                }
            }
        };
        computed_slides.push(slides);
    }

    let all_slides_per_item = computed_slides.clone();
    let item_slide_counts: Vec<usize> = computed_slides.iter().map(|s| s.len()).collect();
    let first_slide = computed_slides.first().and_then(|s| s.first()).cloned();
    // Next slide = second slide of the first item, or first slide of the second item.
    let second_slide = computed_slides
        .first()
        .and_then(|s| s.get(1))
        .or_else(|| computed_slides.get(1).and_then(|s| s.first()))
        .cloned();

    let first_section_id = first_slide.as_ref().map(|s| s.section_id.as_str()).unwrap_or("");
    let background = if let Some(item) = service_set.items.first() {
        resolve_background_for_item(pool, item, first_section_id).await
    } else {
        None
    };

    let new_state = PresentationState {
        set: Some(service_set),
        current_item_index: 0,
        current_slide_index: 0,
        mode: PresentationMode::Live,
        frozen_at: None,
        current_slide: first_slide,
        next_slide: second_slide,
        item_slide_counts,
        background,
        overlay: None,
        all_slides_per_item,
    };

    {
        let mut slides = state.presentation_slides.write().await;
        *slides = computed_slides;
    }
    {
        let mut pres = state.presentation.write().await;
        *pres = new_state.clone();
    }

    // Record a play row for every song in this set (idempotent per day).
    if let Err(e) = play_counter::record_set_start(pool, &set_id).await {
        eprintln!("[trinity] WARN: play_counter::record_set_start failed: {e}");
    }

    emit_state(&app, &new_state).await?;
    Ok(new_state)
}

#[tauri::command]
pub async fn next_slide(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<PresentationState, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");
    do_next_slide(pool, &state.presentation, &state.presentation_slides, &app).await
}

#[tauri::command]
pub async fn prev_slide(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<PresentationState, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");
    let slides = state.presentation_slides.read().await;
    let mut pres = state.presentation.write().await;
    wake_to_live(&mut pres);

    let prev_item_idx = pres.current_item_index;
    let prev_section_id = pres.current_slide.as_ref().map(|s| s.section_id.clone());

    if !slides.is_empty() {
        let item_idx = pres.current_item_index;
        let slide_idx = pres.current_slide_index;

        if slide_idx > 0 {
            pres.current_slide_index = slide_idx - 1;
        } else if item_idx > 0 {
            pres.current_item_index = item_idx - 1;
            let prev_len = slides.get(item_idx - 1).map(|s| s.len()).unwrap_or(1);
            pres.current_slide_index = prev_len.saturating_sub(1);
        }
    }

    pres.current_slide = resolve_current_slide(&slides, &pres);
    pres.next_slide = resolve_next_slide(&slides, &pres);

    let new_section_id = pres.current_slide.as_ref().map(|s| s.section_id.clone());
    if pres.current_item_index != prev_item_idx || new_section_id != prev_section_id {
        let item = pres.set.as_ref().and_then(|s| s.items.get(pres.current_item_index)).cloned();
        let sid = new_section_id.as_deref().unwrap_or("");
        pres.background = if let Some(ref item) = item {
            resolve_background_for_item(pool, item, sid).await
        } else {
            None
        };
    }

    let new_state = pres.clone();
    drop(pres);
    drop(slides);

    emit_state(&app, &new_state).await?;
    Ok(new_state)
}

#[tauri::command]
pub async fn go_to_item(
    state: State<'_, AppState>,
    app: AppHandle,
    item_index: usize,
    slide_index: Option<usize>,
) -> Result<PresentationState, ErrorPayload> {
    let pool = state.db.get().expect("db initialized");
    let slides = state.presentation_slides.read().await;
    let mut pres = state.presentation.write().await;

    if item_index >= slides.len() {
        return Err(ErrorPayload::new("presentation.index_out_of_bounds")
            .with_param("index", item_index.to_string()));
    }

    wake_to_live(&mut pres);
    pres.current_item_index = item_index;
    pres.current_slide_index = slide_index.unwrap_or(0);

    pres.current_slide = resolve_current_slide(&slides, &pres);
    pres.next_slide = resolve_next_slide(&slides, &pres);

    let section_id = pres.current_slide.as_ref().map(|s| s.section_id.as_str()).unwrap_or("").to_string();
    let item = pres.set.as_ref().and_then(|s| s.items.get(item_index)).cloned();
    pres.background = if let Some(ref item) = item {
        resolve_background_for_item(pool, item, &section_id).await
    } else {
        None
    };
    let new_state = pres.clone();
    drop(pres);
    drop(slides);

    emit_state(&app, &new_state).await?;
    Ok(new_state)
}

#[tauri::command]
pub async fn set_presentation_mode(
    state: State<'_, AppState>,
    app: AppHandle,
    mode: PresentationMode,
) -> Result<PresentationState, ErrorPayload> {
    let slides = state.presentation_slides.read().await;
    let mut pres = state.presentation.write().await;

    match mode {
        PresentationMode::Frozen => {
            if pres.mode != PresentationMode::Frozen {
                pres.frozen_at = Some((pres.current_item_index, pres.current_slide_index));
            }
        }
        _ => {
            pres.frozen_at = None;
        }
    }

    pres.mode = mode;
    pres.current_slide = resolve_current_slide(&slides, &pres);
    pres.next_slide = resolve_next_slide(&slides, &pres);
    let new_state = pres.clone();
    drop(pres);
    drop(slides);

    emit_state(&app, &new_state).await?;
    Ok(new_state)
}

#[tauri::command]
pub async fn get_presentation_state(
    state: State<'_, AppState>,
) -> Result<PresentationState, ErrorPayload> {
    Ok(state.presentation.read().await.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn title_slide_wraps_author_in_parens_by_default() {
        let s = build_title_slide("song1", "Amazing Grace", Some("John Newton"), true).unwrap();
        assert_eq!(s.section_label, TITLE_SLIDE_LABEL);
        assert_eq!(s.lines, vec!["Amazing Grace", "(John Newton)"]);
    }

    #[test]
    fn title_slide_author_without_parens_when_disabled() {
        let s = build_title_slide("song1", "Amazing Grace", Some("John Newton"), false).unwrap();
        assert_eq!(s.lines, vec!["Amazing Grace", "John Newton"]);
    }

    #[test]
    fn title_slide_omits_blank_author() {
        let s = build_title_slide("song1", "Amazing Grace", Some("  "), true).unwrap();
        assert_eq!(s.lines, vec!["Amazing Grace"]);
    }

    #[test]
    fn title_credit_falls_back_to_artist_when_author_blank() {
        // Author empty → use artist (the field most users actually fill).
        assert_eq!(resolve_title_credit(None, Some("Hillsong")), Some("Hillsong"));
        assert_eq!(resolve_title_credit(Some("  "), Some("Hillsong")), Some("Hillsong"));
        // Author present → author wins.
        assert_eq!(
            resolve_title_credit(Some("John Newton"), Some("Hillsong")),
            Some("John Newton")
        );
        // Neither → no credit line.
        assert_eq!(resolve_title_credit(None, None), None);
    }

    #[test]
    fn title_slide_skipped_when_title_empty() {
        assert!(build_title_slide("song1", "   ", Some("John Newton"), true).is_none());
    }

    #[test]
    fn wake_to_live_lights_screen_after_blackout() {
        let mut state = PresentationState {
            mode: PresentationMode::Blank,
            ..Default::default()
        };
        wake_to_live(&mut state);
        assert_eq!(state.mode, PresentationMode::Live);

        // Live navigation should be left untouched.
        state.mode = PresentationMode::Live;
        wake_to_live(&mut state);
        assert_eq!(state.mode, PresentationMode::Live);
    }
}
