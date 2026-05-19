use crate::commands::set::db_load_set;
use crate::commands::song::load_sections;
use crate::domain::error::ErrorPayload;
use crate::domain::presentation::{PresentationMode, PresentationState};
use crate::domain::set::SetItemType;
use crate::domain::slide::{Slide, SlideConfig};
use crate::services::slide_splitter;
use crate::state::AppState;
use tauri::{AppHandle, Emitter, State};

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
) -> Vec<Slide> {
    sections
        .iter()
        .flat_map(|s| slide_splitter::split(s, config))
        .collect()
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

async fn emit_state(app: &AppHandle, state: &PresentationState) -> Result<(), ErrorPayload> {
    app.emit("state_changed", state)
        .map_err(|e| ErrorPayload::from(e.to_string()))
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

    let mut computed_slides: Vec<Vec<Slide>> = Vec::new();
    for item in &service_set.items {
        let slides = match item.item_type {
            SetItemType::Song => {
                if let Some(song_id) = &item.song_id {
                    let sections = load_sections(pool, song_id).await?;
                    let s = sections_to_slides(&sections, &config);
                    if s.is_empty() { vec![blank_slide()] } else { s }
                } else {
                    vec![blank_slide()]
                }
            }
            SetItemType::Blank => vec![blank_slide()],
        };
        computed_slides.push(slides);
    }

    let item_slide_counts: Vec<usize> = computed_slides.iter().map(|s| s.len()).collect();
    let first_slide = computed_slides.first().and_then(|s| s.first()).cloned();

    // Preserve the active background across set loads
    let existing_background = state.presentation.read().await.background_path.clone();

    let new_state = PresentationState {
        set: Some(service_set),
        current_item_index: 0,
        current_slide_index: 0,
        mode: PresentationMode::Live,
        frozen_at: None,
        current_slide: first_slide,
        item_slide_counts,
        background_path: existing_background,
    };

    {
        let mut slides = state.presentation_slides.write().await;
        *slides = computed_slides;
    }
    {
        let mut pres = state.presentation.write().await;
        *pres = new_state.clone();
    }

    emit_state(&app, &new_state).await?;
    Ok(new_state)
}

#[tauri::command]
pub async fn next_slide(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<PresentationState, ErrorPayload> {
    let slides = state.presentation_slides.read().await;
    let mut pres = state.presentation.write().await;

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
        // else: already at last slide of last item — stay
    }

    pres.current_slide = resolve_current_slide(&slides, &pres);
    let new_state = pres.clone();
    drop(pres);
    drop(slides);

    emit_state(&app, &new_state).await?;
    Ok(new_state)
}

#[tauri::command]
pub async fn prev_slide(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<PresentationState, ErrorPayload> {
    let slides = state.presentation_slides.read().await;
    let mut pres = state.presentation.write().await;

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
        // else: already at first slide of first item — stay
    }

    pres.current_slide = resolve_current_slide(&slides, &pres);
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
    let slides = state.presentation_slides.read().await;
    let mut pres = state.presentation.write().await;

    if item_index >= slides.len() {
        return Err(ErrorPayload::new("presentation.index_out_of_bounds")
            .with_param("index", item_index.to_string()));
    }

    pres.current_item_index = item_index;
    pres.current_slide_index = slide_index.unwrap_or(0);
    pres.current_slide = resolve_current_slide(&slides, &pres);
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
