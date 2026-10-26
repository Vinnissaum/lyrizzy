use serde::{Deserialize, Serialize};

use super::set::{ServiceSet, SetItem};
use super::slide::Slide;

// Re-export BackgroundInfo from the background domain module so existing callers
// that import `domain::presentation::BackgroundInfo` continue to work unchanged.
pub use super::background::BackgroundInfo;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PresentationMode {
    Idle,
    Live,
    Blank,
    Frozen,
}

/// Active overlay layer rendered on top of the primary slide.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum OverlayState {
    Announcement { text: String },
    // `rename_all = "camelCase"` on the enum renames only the variants, not the
    // fields inside struct variants — so `media_id` would serialize as
    // `media_id`, while the frontend reads `mediaId`. Rename it explicitly.
    Media {
        #[serde(rename = "mediaId")]
        media_id: String,
    },
    WebView { url: String },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PresentationState {
    pub set: Option<ServiceSet>,
    pub current_item_index: usize,
    pub current_slide_index: usize,
    pub mode: PresentationMode,
    /// Stores (item_index, slide_index) at the moment Freeze was activated.
    /// Presentation window renders this snapshot while the operator navigates freely.
    pub frozen_at: Option<(usize, usize)>,
    /// Resolved slide for the presentation window to render.
    /// None when mode is Idle or Blank.
    pub current_slide: Option<Slide>,
    /// The slide that will be shown after the next advance from the current navigation
    /// position (current_item_index / current_slide_index).
    /// None when there is no next slide (end of set or no set loaded).
    pub next_slide: Option<Slide>,
    /// How many slides each set item generates (parallel to set.items).
    /// Used by the operator for "Slide N/M" display without re-sending all slides.
    pub item_slide_counts: Vec<usize>,
    /// Resolved per-song background for the current item, or None for solid black.
    pub background: Option<BackgroundInfo>,
    /// Active overlay layer rendered on top of the primary slide.
    /// None when no overlay is active.
    pub overlay: Option<OverlayState>,
    /// All slides for every set item, parallel to set.items.
    /// Populated by load_set_for_presentation; used by PresentationNavigator.
    /// Field absent in legacy payloads → defaults to empty vec.
    #[serde(default)]
    pub all_slides_per_item: Vec<Vec<Slide>>,
}

/// Produce an emit-ready `PresentationState` carrying every slide body for
/// every set item, without mutating the (slim) stored state.
///
/// The stored `AppState.presentation` never holds `all_slides_per_item` for
/// live-edit refreshes — only the emitted payload does, so the presentation
/// window can re-render the regenerated song without a second round trip.
pub fn with_full_slides(state: &PresentationState, all: &[Vec<Slide>]) -> PresentationState {
    PresentationState {
        all_slides_per_item: all.to_vec(),
        ..state.clone()
    }
}

/// Ids of the set items this output has on the wall: none while idle,
/// otherwise its current item and, while frozen, the frozen one. A live set
/// edit must never remove these (D-88).
pub fn on_screen_item_ids(state: &PresentationState) -> Vec<&str> {
    if state.mode == PresentationMode::Idle {
        return Vec::new();
    }
    let Some(set) = state.set.as_ref() else {
        return Vec::new();
    };
    let mut indices = vec![state.current_item_index];
    if state.mode == PresentationMode::Frozen {
        if let Some((frozen_item, _)) = state.frozen_at {
            indices.push(frozen_item);
        }
    }
    indices
        .into_iter()
        .filter_map(|i| set.items.get(i).map(|item| item.id.as_str()))
        .collect()
}

/// Insert `item` and its `slides` at `index` of a loaded presentation, keeping
/// every stored position on the item it pointed at: positions at or after
/// `index` move up by one. `current_slide`/`next_slide` are left to the caller.
pub fn splice_insert(
    state: &mut PresentationState,
    all: &mut Vec<Vec<Slide>>,
    index: usize,
    item: SetItem,
    slides: Vec<Slide>,
) {
    let Some(set) = state.set.as_mut() else {
        return;
    };
    let index = index.min(set.items.len());
    set.items.insert(index, item);
    // Into an empty set, position 0 already points at the new (only) item.
    let was_empty = set.items.len() == 1;
    let count = slides.len();
    all.insert(index.min(all.len()), slides);
    let counts = &mut state.item_slide_counts;
    counts.insert(index.min(counts.len()), count);

    if !was_empty && state.current_item_index >= index {
        state.current_item_index += 1;
    }
    if let Some((frozen_item, slide)) = state.frozen_at {
        if frozen_item >= index {
            state.frozen_at = Some((frozen_item + 1, slide));
        }
    }
}

/// Remove the item at `index` of a loaded presentation, keeping every stored
/// position on the item it pointed at: positions after `index` move down by
/// one. A position on the removed item itself (only possible on an output that
/// is not presenting) stays at the same index, clamped to the last item, slide 0.
pub fn splice_remove(state: &mut PresentationState, all: &mut Vec<Vec<Slide>>, index: usize) {
    let Some(set) = state.set.as_mut() else {
        return;
    };
    if index >= set.items.len() {
        return;
    }
    set.items.remove(index);
    let remaining = set.items.len();
    if index < all.len() {
        all.remove(index);
    }
    if index < state.item_slide_counts.len() {
        state.item_slide_counts.remove(index);
    }

    if state.current_item_index > index {
        state.current_item_index -= 1;
    } else if state.current_item_index == index {
        state.current_item_index = index.min(remaining.saturating_sub(1));
        state.current_slide_index = 0;
    }
    state.frozen_at = match state.frozen_at {
        Some((frozen_item, slide)) if frozen_item > index => Some((frozen_item - 1, slide)),
        Some((frozen_item, _)) if frozen_item == index => None,
        other => other,
    };
}

impl Default for PresentationState {
    fn default() -> Self {
        Self {
            set: None,
            current_item_index: 0,
            current_slide_index: 0,
            mode: PresentationMode::Idle,
            frozen_at: None,
            current_slide: None,
            next_slide: None,
            item_slide_counts: vec![],
            background: None,
            overlay: None,
            all_slides_per_item: vec![],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presentation_state_round_trips_with_camel_case() {
        let state = PresentationState::default();
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("\"currentItemIndex\""), "expected camelCase: {json}");
        assert!(json.contains("\"currentSlideIndex\""), "expected camelCase: {json}");
        assert!(json.contains("\"mode\":\"idle\""), "expected snake_case enum: {json}");
        assert!(json.contains("\"currentSlide\""), "expected currentSlide field: {json}");
        assert!(json.contains("\"nextSlide\""), "expected nextSlide field: {json}");
        assert!(json.contains("\"itemSlideCounts\""), "expected itemSlideCounts field: {json}");
        assert!(json.contains("\"background\""), "expected background field: {json}");
        assert!(json.contains("\"overlay\""), "expected overlay field: {json}");
        let back: PresentationState = serde_json::from_str(&json).unwrap();
        assert_eq!(back, state);
    }

    #[test]
    fn media_overlay_serializes_media_id_as_camel_case() {
        // Regression: the enum-level `rename_all` renames only variants, not the
        // fields inside struct variants. Without an explicit field rename the
        // frontend (which reads `mediaId`) gets `undefined` and shows a black
        // screen instead of the image overlay.
        let overlay = OverlayState::Media {
            media_id: "abc".into(),
        };
        let json = serde_json::to_string(&overlay).unwrap();
        assert!(json.contains("\"type\":\"media\""), "{json}");
        assert!(json.contains("\"mediaId\":\"abc\""), "{json}");
        let back: OverlayState = serde_json::from_str(&json).unwrap();
        assert_eq!(back, overlay);
    }

    #[test]
    fn presentation_mode_serializes_snake_case() {
        assert_eq!(serde_json::to_string(&PresentationMode::Idle).unwrap(), "\"idle\"");
        assert_eq!(serde_json::to_string(&PresentationMode::Live).unwrap(), "\"live\"");
        assert_eq!(serde_json::to_string(&PresentationMode::Blank).unwrap(), "\"blank\"");
        assert_eq!(serde_json::to_string(&PresentationMode::Frozen).unwrap(), "\"frozen\"");
    }

    #[test]
    fn overlay_state_announcement_round_trips() {
        let o = OverlayState::Announcement { text: "Oferta".to_string() };
        let json = serde_json::to_string(&o).unwrap();
        assert!(json.contains("\"type\":\"announcement\""), "tag missing: {json}");
        assert!(json.contains("\"text\":\"Oferta\""), "text missing: {json}");
        let back: OverlayState = serde_json::from_str(&json).unwrap();
        assert_eq!(back, o);
    }

    #[test]
    fn overlay_state_media_round_trips() {
        let o = OverlayState::Media { media_id: "m-123".to_string() };
        let json = serde_json::to_string(&o).unwrap();
        assert!(json.contains("\"type\":\"media\""), "tag missing: {json}");
        let back: OverlayState = serde_json::from_str(&json).unwrap();
        assert_eq!(back, o);
    }

    #[test]
    fn overlay_state_webview_round_trips() {
        let o = OverlayState::WebView { url: "https://example.com".to_string() };
        let json = serde_json::to_string(&o).unwrap();
        assert!(json.contains("\"type\":\"webView\""), "tag missing: {json}");
        let back: OverlayState = serde_json::from_str(&json).unwrap();
        assert_eq!(back, o);
    }

    #[test]
    fn all_slides_per_item_serde_round_trip() {
        let state = PresentationState {
            all_slides_per_item: vec![
                vec![Slide { lines: vec!["line".into()], section_label: "Verse".into(), section_id: "s1".into() }],
                vec![Slide { lines: vec![], section_label: String::new(), section_id: "countdown".into() }],
            ],
            ..Default::default()
        };
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("allSlidesPerItem"), "camelCase field missing: {json}");
        let back: PresentationState = serde_json::from_str(&json).unwrap();
        assert_eq!(back.all_slides_per_item.len(), 2);
        assert_eq!(back.all_slides_per_item[0][0].section_id, "s1");
    }

    #[test]
    fn all_slides_per_item_missing_field_defaults_to_empty() {
        // Legacy payload without allSlidesPerItem — must deserialize without error.
        let json = r#"{"set":null,"currentItemIndex":0,"currentSlideIndex":0,"mode":"idle","frozenAt":null,"currentSlide":null,"nextSlide":null,"itemSlideCounts":[],"background":null,"overlay":null}"#;
        let state: PresentationState = serde_json::from_str(json).unwrap();
        assert!(state.all_slides_per_item.is_empty(), "should default to empty vec");
    }

    #[test]
    fn with_full_slides_carries_every_slide_of_every_item() {
        let state = PresentationState::default();
        let all = vec![
            vec![Slide { lines: vec!["a".into()], section_label: "Verse".into(), section_id: "s1".into() }],
            vec![
                Slide { lines: vec!["b".into()], section_label: "Chorus".into(), section_id: "s2".into() },
                Slide { lines: vec!["c".into()], section_label: "Chorus".into(), section_id: "s3".into() },
            ],
        ];
        let payload = with_full_slides(&state, &all);
        assert_eq!(payload.all_slides_per_item, all);
    }

    #[test]
    fn with_full_slides_does_not_mutate_input_state() {
        let state = PresentationState::default();
        let all = vec![vec![Slide {
            lines: vec!["a".into()],
            section_label: "Verse".into(),
            section_id: "s1".into(),
        }]];
        let _payload = with_full_slides(&state, &all);
        assert!(state.all_slides_per_item.is_empty());
    }

    #[test]
    fn with_full_slides_empty_all_yields_empty_payload() {
        let state = PresentationState::default();
        let payload = with_full_slides(&state, &[]);
        assert!(payload.all_slides_per_item.is_empty());
    }

    #[test]
    fn with_full_slides_copies_other_fields_untouched() {
        let state = PresentationState {
            mode: PresentationMode::Frozen,
            frozen_at: Some((1, 2)),
            overlay: Some(OverlayState::Announcement { text: "Oferta".into() }),
            current_slide: Some(Slide {
                lines: vec!["x".into()],
                section_label: "Verse".into(),
                section_id: "cs".into(),
            }),
            item_slide_counts: vec![3, 5],
            ..Default::default()
        };
        let all = vec![vec![Slide {
            lines: vec!["y".into()],
            section_label: "Verse".into(),
            section_id: "s1".into(),
        }]];
        let payload = with_full_slides(&state, &all);
        assert_eq!(payload.mode, PresentationMode::Frozen);
        assert_eq!(payload.frozen_at, Some((1, 2)));
        assert_eq!(payload.overlay, Some(OverlayState::Announcement { text: "Oferta".into() }));
        assert_eq!(payload.current_slide, state.current_slide);
        assert_eq!(payload.item_slide_counts, vec![3, 5]);
    }

    #[test]
    fn exit_clears_overlay() {
        let mut state = PresentationState {
            mode: PresentationMode::Live,
            overlay: Some(OverlayState::Announcement { text: "Oferta".into() }),
            ..Default::default()
        };
        // Simulate what exit_presentation does to state.
        state.mode = PresentationMode::Idle;
        state.frozen_at = None;
        state.overlay = None;
        assert_eq!(state.mode, PresentationMode::Idle);
        assert!(state.overlay.is_none());
        assert!(state.frozen_at.is_none());
    }

    #[test]
    fn exit_when_already_idle_is_noop() {
        // Start already idle (the default), then apply the reset again.
        let mut state = PresentationState {
            mode: PresentationMode::Idle,
            frozen_at: None,
            overlay: None,
            ..Default::default()
        };
        // Applying the same reset again must not panic and keep state consistent.
        state.mode = PresentationMode::Idle;
        state.frozen_at = None;
        state.overlay = None;
        assert_eq!(state.mode, PresentationMode::Idle);
        assert!(state.overlay.is_none());
    }

    // ─── Live set splice (P21) ───────────────────────────────────────────────

    use crate::domain::set::SetItemType;

    fn item(id: &str) -> SetItem {
        SetItem {
            id: id.into(),
            set_id: "set-1".into(),
            item_type: SetItemType::Song,
            song_id: Some(format!("song-{id}")),
            media_id: None,
            media_kind: None,
            media_options: None,
            countdown_config: None,
            webview_config: None,
            sort_order: 0,
            notes: None,
        }
    }

    fn slides_of(id: &str, n: usize) -> Vec<Slide> {
        (0..n)
            .map(|k| Slide {
                lines: vec![format!("{id}{k}")],
                section_label: String::new(),
                section_id: format!("{id}-{k}"),
            })
            .collect()
    }

    fn loaded(ids: &[&str], current: usize, mode: PresentationMode) -> (PresentationState, Vec<Vec<Slide>>) {
        let all: Vec<Vec<Slide>> = ids.iter().map(|id| slides_of(id, 2)).collect();
        let state = PresentationState {
            set: Some(ServiceSet {
                id: "set-1".into(),
                name: "Culto".into(),
                service_date: None,
                notes: None,
                created_at: 0,
                updated_at: 0,
                items: ids.iter().map(|id| item(id)).collect(),
            }),
            current_item_index: current,
            mode,
            item_slide_counts: vec![2; ids.len()],
            ..Default::default()
        };
        (state, all)
    }

    fn ids(state: &PresentationState) -> Vec<String> {
        state.set.as_ref().unwrap().items.iter().map(|i| i.id.clone()).collect()
    }

    #[test]
    fn splice_insert_after_current_keeps_current() {
        let (mut s, mut all) = loaded(&["A", "B", "C"], 1, PresentationMode::Live);
        splice_insert(&mut s, &mut all, 2, item("D"), slides_of("D", 3));
        assert_eq!(ids(&s), ["A", "B", "D", "C"]);
        assert_eq!(s.current_item_index, 1);
        assert_eq!(s.item_slide_counts, vec![2, 2, 3, 2]);
        assert_eq!(all[2], slides_of("D", 3));
        assert_eq!(all[3], slides_of("C", 2));
    }

    #[test]
    fn splice_insert_at_end() {
        let (mut s, mut all) = loaded(&["A", "B", "C"], 2, PresentationMode::Live);
        splice_insert(&mut s, &mut all, 3, item("D"), slides_of("D", 1));
        assert_eq!(ids(&s), ["A", "B", "C", "D"]);
        assert_eq!(s.current_item_index, 2);
        assert_eq!(all.len(), 4);
        assert_eq!(s.item_slide_counts, vec![2, 2, 2, 1]);
    }

    #[test]
    fn splice_insert_before_frozen_shifts_it() {
        let (mut s, mut all) = loaded(&["A", "B", "C"], 0, PresentationMode::Frozen);
        s.frozen_at = Some((2, 1));
        splice_insert(&mut s, &mut all, 1, item("D"), slides_of("D", 1));
        assert_eq!(ids(&s), ["A", "D", "B", "C"]);
        assert_eq!(s.current_item_index, 0);
        assert_eq!(s.frozen_at, Some((3, 1)));
        assert_eq!(all[3], slides_of("C", 2));
    }

    #[test]
    fn splice_insert_before_another_outputs_current_shifts_it() {
        let (mut s, mut all) = loaded(&["A", "B", "C"], 2, PresentationMode::Live);
        splice_insert(&mut s, &mut all, 1, item("D"), slides_of("D", 1));
        assert_eq!(s.current_item_index, 3);
        assert_eq!(ids(&s)[s.current_item_index], "C");

        // At the current index itself: the current item moves up one.
        let (mut s, mut all) = loaded(&["A", "B", "C"], 1, PresentationMode::Live);
        splice_insert(&mut s, &mut all, 1, item("D"), slides_of("D", 1));
        assert_eq!(ids(&s)[s.current_item_index], "B");
    }

    #[test]
    fn splice_insert_into_an_empty_set_points_at_it() {
        let (mut s, mut all) = loaded(&[], 0, PresentationMode::Idle);
        splice_insert(&mut s, &mut all, 0, item("D"), slides_of("D", 1));
        assert_eq!(ids(&s), ["D"]);
        assert_eq!(s.current_item_index, 0);
    }

    #[test]
    fn splice_remove_before_current_shifts_down() {
        let (mut s, mut all) = loaded(&["A", "B", "C", "D"], 2, PresentationMode::Live);
        s.current_slide_index = 1;
        splice_remove(&mut s, &mut all, 0);
        assert_eq!(ids(&s), ["B", "C", "D"]);
        assert_eq!(s.current_item_index, 1);
        assert_eq!(s.current_slide_index, 1);
        assert_eq!(s.item_slide_counts.len(), 3);
        assert_eq!(all[1], slides_of("C", 2));
    }

    #[test]
    fn splice_remove_after_current_keeps_it() {
        let (mut s, mut all) = loaded(&["A", "B", "C", "D"], 1, PresentationMode::Live);
        splice_remove(&mut s, &mut all, 3);
        assert_eq!(ids(&s), ["A", "B", "C"]);
        assert_eq!(s.current_item_index, 1);
        assert_eq!(all.len(), 3);
    }

    #[test]
    fn splice_remove_before_frozen_shifts_it() {
        let (mut s, mut all) = loaded(&["A", "B", "C", "D"], 0, PresentationMode::Frozen);
        s.frozen_at = Some((3, 1));
        splice_remove(&mut s, &mut all, 1);
        assert_eq!(s.frozen_at, Some((2, 1)));
        assert_eq!(s.current_item_index, 0);
        assert_eq!(ids(&s)[2], "D");
    }

    #[test]
    fn splice_remove_an_idle_outputs_current_clamps() {
        let (mut s, mut all) = loaded(&["A", "B", "C"], 2, PresentationMode::Idle);
        s.current_slide_index = 1;
        splice_remove(&mut s, &mut all, 2);
        assert_eq!(s.current_item_index, 1);
        assert_eq!(s.current_slide_index, 0);

        let (mut s, mut all) = loaded(&["A", "B", "C"], 1, PresentationMode::Idle);
        splice_remove(&mut s, &mut all, 1);
        assert_eq!(ids(&s)[s.current_item_index], "C");
        assert_eq!(s.current_slide_index, 0);
    }

    #[test]
    fn on_screen_item_ids_follow_the_mode() {
        let (live, _) = loaded(&["A", "B", "C"], 1, PresentationMode::Live);
        assert_eq!(on_screen_item_ids(&live), ["B"]);

        let (blank, _) = loaded(&["A", "B", "C"], 1, PresentationMode::Blank);
        assert_eq!(on_screen_item_ids(&blank), ["B"]);

        let (mut frozen, _) = loaded(&["A", "B", "C"], 0, PresentationMode::Frozen);
        frozen.frozen_at = Some((2, 0));
        assert_eq!(on_screen_item_ids(&frozen), ["A", "C"]);

        let (idle, _) = loaded(&["A", "B", "C"], 1, PresentationMode::Idle);
        assert!(on_screen_item_ids(&idle).is_empty());

        let none = PresentationState { mode: PresentationMode::Live, ..Default::default() };
        assert!(on_screen_item_ids(&none).is_empty());
    }
}
