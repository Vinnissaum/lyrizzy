use serde::{Deserialize, Serialize};

use super::set::ServiceSet;
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
    Media { media_id: String },
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
        let mut state = PresentationState::default();
        state.all_slides_per_item = vec![
            vec![Slide { lines: vec!["line".into()], section_label: "Verse".into(), section_id: "s1".into() }],
            vec![Slide { lines: vec![], section_label: String::new(), section_id: "countdown".into() }],
        ];
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
    fn exit_clears_overlay() {
        let mut state = PresentationState::default();
        state.mode = PresentationMode::Live;
        state.overlay = Some(OverlayState::Announcement { text: "Oferta".into() });
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
        let mut state = PresentationState::default(); // already Idle, no overlay
        // Applying the same reset again must not panic and keep state consistent.
        state.mode = PresentationMode::Idle;
        state.frozen_at = None;
        state.overlay = None;
        assert_eq!(state.mode, PresentationMode::Idle);
        assert!(state.overlay.is_none());
    }
}
