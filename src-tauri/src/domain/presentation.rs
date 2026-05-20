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
    /// position (current_item_index / current_slide_index). Used by the stage display.
    /// None when there is no next slide (end of set or no set loaded).
    pub next_slide: Option<Slide>,
    /// How many slides each set item generates (parallel to set.items).
    /// Used by the operator for "Slide N/M" display without re-sending all slides.
    pub item_slide_counts: Vec<usize>,
    /// Resolved per-song background for the current item, or None for solid black.
    pub background: Option<BackgroundInfo>,
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
}
