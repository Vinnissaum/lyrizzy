use serde::{Deserialize, Serialize};

use super::set::ServiceSet;

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
}

impl Default for PresentationState {
    fn default() -> Self {
        Self {
            set: None,
            current_item_index: 0,
            current_slide_index: 0,
            mode: PresentationMode::Idle,
            frozen_at: None,
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
