use serde::{Deserialize, Deserializer, Serialize};

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

/// The countdown target — either a fixed duration or a wall-clock time.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CountdownTarget {
    Duration {
        #[serde(rename = "durationMs")]
        duration_ms: u64,
    },
    FixedTime { hour: u8, minute: u8 },
}

/// Where the countdown digits are anchored on the presentation screen.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, Default, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum CountdownPosition {
    TopLeft,
    TopCenter,
    TopRight,
    CenterLeft,
    #[default]
    Center,
    CenterRight,
    BottomLeft,
    BottomCenter,
    BottomRight,
}

/// Configuration for a countdown set item.
///
/// Custom Deserialize provides backward compatibility with the old flat shape
/// `{"durationMs": N, ...}` — it maps to `target: Duration { duration_ms: N }`.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CountdownConfig {
    pub target: CountdownTarget,
    pub message: Option<String>,
    pub end_behavior: CountdownEndBehavior,
    /// Optional media ID for a looped video background behind the digits.
    pub background_media_id: Option<String>,
    /// Where the digits are anchored on screen. Defaults to center for configs
    /// saved before this field existed.
    #[serde(default)]
    pub position: CountdownPosition,
}

impl<'de> Deserialize<'de> for CountdownConfig {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        use serde::de::Error;
        let value = serde_json::Value::deserialize(deserializer)?;

        let message = value
            .get("message")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let end_behavior: CountdownEndBehavior = value
            .get("endBehavior")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or(CountdownEndBehavior::HoldZero);

        let background_media_id = value
            .get("backgroundMediaId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let position: CountdownPosition = value
            .get("position")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        // New format: has a "target" field.
        let target = if let Some(target_val) = value.get("target") {
            serde_json::from_value(target_val.clone())
                .map_err(|e| D::Error::custom(format!("invalid target: {e}")))?
        } else if let Some(duration_ms) = value.get("durationMs").and_then(|v| v.as_u64()) {
            // Legacy format: flat durationMs field.
            CountdownTarget::Duration { duration_ms }
        } else {
            return Err(D::Error::missing_field("target or durationMs"));
        };

        Ok(CountdownConfig {
            target,
            message,
            end_behavior,
            background_media_id,
            position,
        })
    }
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
    fn countdown_config_new_duration_round_trips() {
        let config = CountdownConfig {
            target: CountdownTarget::Duration { duration_ms: 600_000 },
            message: Some("O culto começa em…".into()),
            end_behavior: CountdownEndBehavior::AdvanceSet,
            background_media_id: Some("media-uuid-123".into()),
            position: CountdownPosition::BottomRight,
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"position\":\"bottom-right\""), "{json}");
        assert!(json.contains("\"target\""), "{json}");
        assert!(json.contains("\"kind\":\"duration\""), "{json}");
        assert!(json.contains("\"durationMs\":600000"), "{json}");
        let back: CountdownConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(back, config);
    }

    #[test]
    fn countdown_config_fixed_time_round_trips() {
        let config = CountdownConfig {
            target: CountdownTarget::FixedTime { hour: 9, minute: 30 },
            message: None,
            end_behavior: CountdownEndBehavior::HoldZero,
            background_media_id: None,
            position: CountdownPosition::Center,
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"kind\":\"fixedTime\""), "{json}");
        assert!(json.contains("\"hour\":9"), "{json}");
        assert!(json.contains("\"minute\":30"), "{json}");
        let back: CountdownConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(back, config);
    }

    #[test]
    fn countdown_config_legacy_duration_ms_deserializes() {
        let legacy = r#"{"durationMs":600000,"message":null,"endBehavior":"advanceSet","backgroundMediaId":"media-uuid-123"}"#;
        let config: CountdownConfig = serde_json::from_str(legacy).unwrap();
        assert_eq!(
            config.target,
            CountdownTarget::Duration { duration_ms: 600_000 }
        );
        assert_eq!(config.end_behavior, CountdownEndBehavior::AdvanceSet);
        // Legacy configs (no "position" field) default to center.
        assert_eq!(config.position, CountdownPosition::Center);
    }

    #[test]
    fn countdown_config_position_round_trips() {
        let json = r#"{"target":{"kind":"duration","durationMs":1000},"message":null,"endBehavior":"holdZero","backgroundMediaId":null,"position":"top-left"}"#;
        let config: CountdownConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.position, CountdownPosition::TopLeft);
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
