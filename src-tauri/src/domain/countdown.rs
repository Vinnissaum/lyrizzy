use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum CountdownMode {
    Idle,
    Running,
    Paused,
    Finished,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum CountdownEndBehavior {
    HoldZero,
    Blackout,
    AdvanceSet,
}

/// Configuration for a countdown set item.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CountdownConfig {
    pub duration_ms: u64,
    pub message: Option<String>,
    pub end_behavior: CountdownEndBehavior,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CountdownState {
    pub mode: CountdownMode,
    pub duration_ms: u64,
    pub remaining_ms: u64,
    /// Wall-clock target (epoch ms). Set when mode = Running; None otherwise.
    pub target_epoch_ms: Option<u64>,
    pub message: Option<String>,
    pub end_behavior: CountdownEndBehavior,
}

impl Default for CountdownState {
    fn default() -> Self {
        Self {
            mode: CountdownMode::Idle,
            duration_ms: 0,
            remaining_ms: 0,
            target_epoch_ms: None,
            message: None,
            end_behavior: CountdownEndBehavior::HoldZero,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn countdown_state_round_trips_camel_case() {
        let state = CountdownState::default();
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("\"mode\":\"idle\""), "expected camelCase mode: {json}");
        assert!(json.contains("\"durationMs\""), "expected camelCase: {json}");
        assert!(json.contains("\"remainingMs\""), "expected camelCase: {json}");
        assert!(json.contains("\"targetEpochMs\""), "expected camelCase: {json}");
        assert!(
            json.contains("\"endBehavior\":\"holdZero\""),
            "expected camelCase: {json}"
        );
        let back: CountdownState = serde_json::from_str(&json).unwrap();
        assert_eq!(back.mode, CountdownMode::Idle);
        assert_eq!(back.duration_ms, 0);
        assert_eq!(back.remaining_ms, 0);
    }

    #[test]
    fn countdown_config_round_trips() {
        let config = CountdownConfig {
            duration_ms: 600_000,
            message: Some("O culto começa em…".into()),
            end_behavior: CountdownEndBehavior::AdvanceSet,
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"durationMs\""), "{json}");
        assert!(json.contains("\"advanceSet\""), "{json}");
        let back: CountdownConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(back, config);
    }

    #[test]
    fn countdown_mode_variants_serialize() {
        assert_eq!(
            serde_json::to_string(&CountdownMode::Running).unwrap(),
            "\"running\""
        );
        assert_eq!(
            serde_json::to_string(&CountdownMode::Paused).unwrap(),
            "\"paused\""
        );
        assert_eq!(
            serde_json::to_string(&CountdownMode::Finished).unwrap(),
            "\"finished\""
        );
    }
}
