use serde::{Deserialize, Deserializer, Serialize};

use super::error::ErrorPayload;
use super::set::ServiceSet;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum CountdownMode {
    Idle,
    /// Armed and waiting for a wall-clock start time. While in this mode
    /// `scheduled_start_epoch_ms` is set and `remaining_ms` ticks down toward 0.
    /// On reaching 0 the ticker auto-transitions to `Running`.
    Scheduled,
    Running,
    Paused,
    Finished,
}

/// Wall-clock HH:MM used as a scheduled-start trigger.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledStart {
    pub hour: u8,
    pub minute: u8,
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

/// Default scale for message/digits — 100 = the Phase 16 rendering exactly.
fn default_scale() -> u16 {
    100
}

/// Configuration for a countdown set item.
///
/// Custom Deserialize provides backward compatibility with the old flat shape
/// `{"durationMs": N, ...}` — it maps to `target: Duration { duration_ms: N }`.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CountdownConfig {
    pub target: CountdownTarget,
    /// Operator-supplied item name. `None` → the UI shows its localized default.
    pub name: Option<String>,
    pub message: Option<String>,
    pub end_behavior: CountdownEndBehavior,
    /// Optional media ID for a looped video background behind the digits.
    pub background_media_id: Option<String>,
    /// Where the digits are anchored on screen. Defaults to center for configs
    /// saved before this field existed.
    #[serde(default)]
    pub position: CountdownPosition,
    /// If set, the operator arming this item enters Scheduled mode until the
    /// wall-clock hits HH:MM, then auto-starts the countdown.
    pub scheduled_start: Option<ScheduledStart>,
    /// Percent of the built-in size. 100 = the Phase 16 rendering exactly.
    /// Clamped to 50..=300 on read; never rejected.
    #[serde(default = "default_scale")]
    pub message_scale: u16,
    #[serde(default = "default_scale")]
    pub digits_scale: u16,
}

impl<'de> Deserialize<'de> for CountdownConfig {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        use serde::de::Error;
        let value = serde_json::Value::deserialize(deserializer)?;

        let name = value
            .get("name")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

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

        let scheduled_start: Option<ScheduledStart> = value
            .get("scheduledStart")
            .and_then(|v| {
                if v.is_null() {
                    None
                } else {
                    serde_json::from_value::<ScheduledStart>(v.clone()).ok()
                }
            });

        // Clamp rather than reject: an out-of-range or missing scale falls back
        // to a safe value instead of failing the whole deserialize.
        let message_scale: u16 = value
            .get("messageScale")
            .and_then(|v| v.as_u64())
            .map(|n| n.clamp(50, 300) as u16)
            .unwrap_or(100);

        let digits_scale: u16 = value
            .get("digitsScale")
            .and_then(|v| v.as_u64())
            .map(|n| n.clamp(50, 300) as u16)
            .unwrap_or(100);

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
            name,
            message,
            end_behavior,
            background_media_id,
            position,
            scheduled_start,
            message_scale,
            digits_scale,
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
    /// Wall-clock start time (epoch ms). Set when mode = Scheduled; None otherwise.
    /// The frontend uses this to show "Começa em mm:ss" before auto-start.
    pub scheduled_start_epoch_ms: Option<u64>,
    pub message: Option<String>,
    pub end_behavior: CountdownEndBehavior,
    /// When true, the countdown overlays the presentation regardless of mode
    /// (live / blank / overlay) — a "takeover". Set by armed/started countdowns
    /// that should pre-empt whatever is on screen; cleared automatically when the
    /// countdown finishes so the underlying content returns.
    #[serde(default)]
    pub takeover: bool,
    /// On-screen anchor for the digits while running/taking over. Mirrors the
    /// source set item's `CountdownConfig.position` so the takeover renderer can
    /// honour it (the takeover path has no access to the set item).
    #[serde(default)]
    pub position: CountdownPosition,
    /// Optional looped-video background id, mirrored from the source item's
    /// `CountdownConfig.background_media_id` for the same reason as `position`.
    #[serde(default)]
    pub background_media_id: Option<String>,
    /// Mirrored from the source item's `CountdownConfig.message_scale`/`digits_scale`.
    /// Defaults to 100 (not `u16::default()`'s 0) for states serialized before
    /// this field existed.
    #[serde(default = "default_scale")]
    pub message_scale: u16,
    #[serde(default = "default_scale")]
    pub digits_scale: u16,
    /// Id of the set item whose landing started this countdown (manual-present
    /// path). Lets a presentation window landing on a countdown item tell "my
    /// own countdown, still running" from a leftover of another item or of an
    /// earlier presentation (P20-02/P20-03). `None` for armed/scheduled and
    /// reset countdowns.
    #[serde(default)]
    pub source_item_id: Option<String>,
}

impl Default for CountdownState {
    fn default() -> Self {
        Self {
            mode: CountdownMode::Idle,
            duration_ms: 0,
            remaining_ms: 0,
            target_epoch_ms: None,
            scheduled_start_epoch_ms: None,
            message: None,
            end_behavior: CountdownEndBehavior::HoldZero,
            takeover: false,
            position: CountdownPosition::Center,
            background_media_id: None,
            message_scale: 100,
            digits_scale: 100,
            source_item_id: None,
        }
    }
}

// ─── Live controls (P21) ─────────────────────────────────────────────────────
//
// Pure rules behind the operator's mid-presentation countdown controls. They
// are run-only (D-89): `duration_ms` keeps the configured duration, so Stop's
// reset and a restart still return to it, and nothing here touches the set item.

/// The countdown after the operator adds (`delta_ms > 0`) or takes off
/// (`delta_ms < 0`) time. A negative delta must leave strictly more than zero
/// on the clock, so it can never reach 00:00 and fire an end action early. A
/// finished countdown given more time counts down again from it.
pub fn adjusted(
    state: &CountdownState,
    delta_ms: i64,
    now_ms: u64,
) -> Result<CountdownState, ErrorPayload> {
    let remaining = match state.mode {
        CountdownMode::Idle | CountdownMode::Scheduled => {
            return Err(ErrorPayload::new("countdown.not_active"))
        }
        CountdownMode::Running => state
            .target_epoch_ms
            .unwrap_or(now_ms)
            .saturating_sub(now_ms),
        CountdownMode::Paused | CountdownMode::Finished => state.remaining_ms,
    };
    let magnitude = delta_ms.unsigned_abs();
    if delta_ms < 0 && remaining <= magnitude {
        return Err(ErrorPayload::new("countdown.below_minimum"));
    }
    if delta_ms == 0 {
        return Ok(state.clone());
    }
    let new_remaining = if delta_ms < 0 {
        remaining - magnitude
    } else {
        remaining.saturating_add(magnitude)
    };

    let mut next = state.clone();
    next.remaining_ms = new_remaining;
    if state.mode != CountdownMode::Paused {
        // The ticker reads the target every tick, so moving it is what makes
        // the adjustment stick.
        next.mode = CountdownMode::Running;
        next.target_epoch_ms = Some(now_ms.saturating_add(new_remaining));
    }
    Ok(next)
}

/// A paused countdown continuing from the time it was holding.
pub fn resumed(state: &CountdownState, now_ms: u64) -> Result<CountdownState, ErrorPayload> {
    if state.mode != CountdownMode::Paused {
        return Err(ErrorPayload::new("countdown.not_paused"));
    }
    let mut next = state.clone();
    next.mode = CountdownMode::Running;
    next.target_epoch_ms = Some(now_ms.saturating_add(state.remaining_ms));
    Ok(next)
}

/// What a restart counts down to: the configured target of the set item that
/// started this countdown, or — for a fired schedule, or a source item no longer
/// in the set — the countdown's own configured duration.
pub fn restart_target(state: &CountdownState, set: Option<&ServiceSet>) -> CountdownTarget {
    state
        .source_item_id
        .as_deref()
        .and_then(|id| set.and_then(|s| s.items.iter().find(|i| i.id == id)))
        .and_then(|item| item.countdown_config.as_ref())
        .map(|config| config.target.clone())
        .unwrap_or(CountdownTarget::Duration {
            duration_ms: state.duration_ms,
        })
}

/// The countdown counting again from `target` (resolved to `target_epoch_ms`),
/// dropping every adjustment. Its look and takeover are kept.
pub fn restarted(
    state: &CountdownState,
    target: &CountdownTarget,
    target_epoch_ms: u64,
    now_ms: u64,
) -> Result<CountdownState, ErrorPayload> {
    if matches!(state.mode, CountdownMode::Idle | CountdownMode::Scheduled) {
        return Err(ErrorPayload::new("countdown.not_active"));
    }
    let mut next = state.clone();
    if let CountdownTarget::Duration { duration_ms } = target {
        if *duration_ms == 0 {
            return Err(ErrorPayload::new("countdown.duration_not_set"));
        }
        next.duration_ms = *duration_ms;
    }
    next.mode = CountdownMode::Running;
    next.scheduled_start_epoch_ms = None;
    next.target_epoch_ms = Some(target_epoch_ms);
    next.remaining_ms = target_epoch_ms.saturating_sub(now_ms);
    Ok(next)
}

/// Whether a live control must start a ticker: only when the countdown begins
/// to run from a mode that has none (paused, finished). A running countdown
/// keeps its ticker, which picks up a moved target on its next tick.
pub fn ticker_needed(before: &CountdownMode, after: &CountdownMode) -> bool {
    *after == CountdownMode::Running && *before != CountdownMode::Running
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
        assert!(json.contains("\"takeover\":false"), "expected takeover: {json}");
        let back: CountdownState = serde_json::from_str(&json).unwrap();
        assert_eq!(back.mode, CountdownMode::Idle);
        assert!(!back.takeover);
        assert_eq!(back.duration_ms, 0);
        assert_eq!(back.remaining_ms, 0);
    }

    #[test]
    fn countdown_config_new_duration_round_trips() {
        let config = CountdownConfig {
            target: CountdownTarget::Duration { duration_ms: 600_000 },
            name: Some("Abertura".into()),
            message: Some("O culto começa em…".into()),
            end_behavior: CountdownEndBehavior::AdvanceSet,
            background_media_id: Some("media-uuid-123".into()),
            position: CountdownPosition::BottomRight,
            scheduled_start: None,
            message_scale: 150,
            digits_scale: 200,
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
            name: None,
            message: None,
            end_behavior: CountdownEndBehavior::HoldZero,
            background_media_id: None,
            position: CountdownPosition::Center,
            scheduled_start: None,
            message_scale: 100,
            digits_scale: 100,
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
        assert_eq!(
            serde_json::to_string(&CountdownMode::Scheduled).unwrap(),
            "\"scheduled\""
        );
    }

    #[test]
    fn countdown_config_scheduled_start_round_trips() {
        let json = r#"{"target":{"kind":"duration","durationMs":600000},"message":null,"endBehavior":"holdZero","backgroundMediaId":null,"position":"center","scheduledStart":{"hour":9,"minute":30}}"#;
        let config: CountdownConfig = serde_json::from_str(json).unwrap();
        assert_eq!(
            config.scheduled_start,
            Some(ScheduledStart { hour: 9, minute: 30 })
        );
        let back = serde_json::to_string(&config).unwrap();
        assert!(back.contains("\"scheduledStart\":{\"hour\":9,\"minute\":30}"), "{back}");
    }

    #[test]
    fn countdown_config_missing_scheduled_start_is_none() {
        let legacy = r#"{"target":{"kind":"duration","durationMs":1000},"message":null,"endBehavior":"holdZero","backgroundMediaId":null,"position":"center"}"#;
        let config: CountdownConfig = serde_json::from_str(legacy).unwrap();
        assert_eq!(config.scheduled_start, None);
    }

    #[test]
    fn countdown_state_default_has_no_scheduled_start() {
        let state = CountdownState::default();
        assert_eq!(state.scheduled_start_epoch_ms, None);
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("\"scheduledStartEpochMs\":null"), "{json}");
    }

    /// (a) A pre-Phase-17 config blob (no name/messageScale/digitsScale) still
    /// deserializes, with name absent and both scales defaulting to 100.
    #[test]
    fn countdown_config_pre_phase17_defaults_name_and_scales() {
        let legacy = r#"{"target":{"kind":"duration","durationMs":1000},"message":null,"endBehavior":"holdZero","backgroundMediaId":null,"position":"center"}"#;
        let config: CountdownConfig = serde_json::from_str(legacy).unwrap();
        assert_eq!(config.name, None);
        assert_eq!(config.message_scale, 100);
        assert_eq!(config.digits_scale, 100);
    }

    /// (b) Out-of-range scales are clamped rather than rejected.
    #[test]
    fn countdown_config_scale_clamps_to_range() {
        let too_big = r#"{"target":{"kind":"duration","durationMs":1000},"message":null,"endBehavior":"holdZero","backgroundMediaId":null,"messageScale":9999,"digitsScale":9999}"#;
        let config: CountdownConfig = serde_json::from_str(too_big).unwrap();
        assert_eq!(config.message_scale, 300);
        assert_eq!(config.digits_scale, 300);

        let too_small = r#"{"target":{"kind":"duration","durationMs":1000},"message":null,"endBehavior":"holdZero","backgroundMediaId":null,"messageScale":1,"digitsScale":1}"#;
        let config: CountdownConfig = serde_json::from_str(too_small).unwrap();
        assert_eq!(config.message_scale, 50);
        assert_eq!(config.digits_scale, 50);
    }

    /// (c) A fully-populated config round-trips through serialize/deserialize.
    #[test]
    fn countdown_config_full_round_trip_with_name_and_scales() {
        let config = CountdownConfig {
            target: CountdownTarget::Duration { duration_ms: 300_000 },
            name: Some("Contagem final".into()),
            message: Some("Voltamos em breve".into()),
            end_behavior: CountdownEndBehavior::Blackout,
            background_media_id: Some("media-xyz".into()),
            position: CountdownPosition::TopCenter,
            scheduled_start: Some(ScheduledStart { hour: 18, minute: 45 }),
            message_scale: 175,
            digits_scale: 225,
        };
        let json = serde_json::to_string(&config).unwrap();
        let back: CountdownConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(back, config);
    }

    /// (d) A pre-Phase-17 serialized CountdownState (no scale fields) still
    /// deserializes, defaulting both scales to 100 — not `u16::default()`'s 0.
    #[test]
    fn countdown_state_pre_phase17_defaults_scales_to_100() {
        let legacy = r#"{"mode":"idle","durationMs":0,"remainingMs":0,"targetEpochMs":null,"scheduledStartEpochMs":null,"message":null,"endBehavior":"holdZero","takeover":false,"position":"center","backgroundMediaId":null}"#;
        let state: CountdownState = serde_json::from_str(legacy).unwrap();
        assert_eq!(state.message_scale, 100);
        assert_eq!(state.digits_scale, 100);
    }

    // ─── Live controls (P21) ─────────────────────────────────────────────────

    const NOW: u64 = 1_000_000;

    fn running_with(remaining_ms: u64) -> CountdownState {
        CountdownState {
            mode: CountdownMode::Running,
            duration_ms: 600_000,
            remaining_ms,
            target_epoch_ms: Some(NOW + remaining_ms),
            ..CountdownState::default()
        }
    }

    fn held(mode: CountdownMode, remaining_ms: u64) -> CountdownState {
        CountdownState {
            mode,
            duration_ms: 600_000,
            remaining_ms,
            target_epoch_ms: None,
            ..CountdownState::default()
        }
    }

    fn code(r: Result<CountdownState, ErrorPayload>) -> String {
        r.expect_err("expected the control to be refused").code
    }

    #[test]
    fn live_adjust_adds_time() {
        let s = running_with(270_000); // 04:30
        let plus_one = adjusted(&s, 60_000, NOW).unwrap();
        assert_eq!(plus_one.remaining_ms, 330_000); // 05:30
        assert_eq!(plus_one.target_epoch_ms, Some(NOW + 330_000));
        assert_eq!(plus_one.mode, CountdownMode::Running);

        let plus_five = adjusted(&s, 300_000, NOW).unwrap();
        assert_eq!(plus_five.remaining_ms, 570_000); // 09:30
        assert_eq!(plus_five.target_epoch_ms, Some(NOW + 570_000));

        // A countdown to 19:00 seen at 18:55: +1 min moves the end to 19:01.
        let at_1900: u64 = 19 * 3_600_000;
        let at_1855 = at_1900 - 300_000;
        let fixed = CountdownState {
            mode: CountdownMode::Running,
            remaining_ms: 300_000,
            target_epoch_ms: Some(at_1900),
            ..CountdownState::default()
        };
        let moved = adjusted(&fixed, 60_000, at_1855).unwrap();
        assert_eq!(moved.target_epoch_ms, Some(at_1900 + 60_000));
        assert_eq!(moved.remaining_ms, 360_000); // 06:00

        // A huge delta saturates instead of overflowing.
        let huge = adjusted(&s, i64::MAX, NOW).unwrap();
        assert!(huge.remaining_ms > 270_000);
    }

    #[test]
    fn live_adjust_subtracts_a_minute() {
        let s = running_with(270_000);
        let minus = adjusted(&s, -60_000, NOW).unwrap();
        assert_eq!(minus.remaining_ms, 210_000); // 03:30
        assert_eq!(minus.target_epoch_ms, Some(NOW + 210_000));

        let edge = adjusted(&running_with(60_001), -60_000, NOW).unwrap();
        assert_eq!(edge.remaining_ms, 1);
        assert_eq!(edge.mode, CountdownMode::Running);
        assert_eq!(edge.target_epoch_ms, Some(NOW + 1));
    }

    #[test]
    fn live_adjust_refuses_below_minimum() {
        assert_eq!(code(adjusted(&running_with(60_000), -60_000, NOW)), "countdown.below_minimum");
        assert_eq!(code(adjusted(&running_with(40_000), -60_000, NOW)), "countdown.below_minimum");
        assert_eq!(
            code(adjusted(&held(CountdownMode::Finished, 0), -60_000, NOW)),
            "countdown.below_minimum"
        );
        assert_eq!(
            code(adjusted(&held(CountdownMode::Paused, 60_000), -60_000, NOW)),
            "countdown.below_minimum"
        );
    }

    #[test]
    fn live_adjust_moves_the_target() {
        let s = running_with(270_000);
        let after = adjusted(&s, 60_000, NOW).unwrap();
        // What the ticker computes two seconds later: target - now.
        let target = after.target_epoch_ms.expect("a running countdown has a target");
        assert_eq!(target.saturating_sub(NOW + 2_000), 328_000); // 05:28, not 04:28
    }

    #[test]
    fn live_resume_continues_from_held_time() {
        let paused = held(CountdownMode::Paused, 270_000);
        // Resumed 20 s after pausing: still 04:30, counting from now.
        let later = NOW + 20_000;
        let r = resumed(&paused, later).unwrap();
        assert_eq!(r.mode, CountdownMode::Running);
        assert_eq!(r.remaining_ms, 270_000);
        assert_eq!(r.target_epoch_ms, Some(later + 270_000));
    }

    #[test]
    fn live_adjust_while_paused_stays_paused() {
        let paused = held(CountdownMode::Paused, 270_000);
        let r = adjusted(&paused, 60_000, NOW).unwrap();
        assert_eq!(r.mode, CountdownMode::Paused);
        assert_eq!(r.remaining_ms, 330_000);
        assert_eq!(r.target_epoch_ms, None);
    }

    #[test]
    fn live_adjust_reruns_a_finished_countdown() {
        let finished = held(CountdownMode::Finished, 0);
        let one = adjusted(&finished, 60_000, NOW).unwrap();
        assert_eq!(one.mode, CountdownMode::Running);
        assert_eq!(one.remaining_ms, 60_000);
        assert_eq!(one.target_epoch_ms, Some(NOW + 60_000));

        let five = adjusted(&finished, 300_000, NOW).unwrap();
        assert_eq!(five.mode, CountdownMode::Running);
        assert_eq!(five.remaining_ms, 300_000);
        assert_eq!(five.target_epoch_ms, Some(NOW + 300_000));
    }

    #[test]
    fn live_ticker_needed_only_when_starting_to_run() {
        use CountdownMode::*;
        assert!(ticker_needed(&Paused, &Running));
        assert!(ticker_needed(&Finished, &Running));
        assert!(ticker_needed(&Idle, &Running));
        assert!(!ticker_needed(&Running, &Running));
        assert!(!ticker_needed(&Running, &Paused));
        assert!(!ticker_needed(&Paused, &Paused));
    }

    fn countdown_item(id: &str, target: CountdownTarget) -> crate::domain::set::SetItem {
        crate::domain::set::SetItem {
            id: id.into(),
            set_id: "set-1".into(),
            item_type: crate::domain::set::SetItemType::Countdown,
            song_id: None,
            media_id: None,
            media_kind: None,
            media_options: None,
            countdown_config: Some(CountdownConfig {
                target,
                name: None,
                message: None,
                end_behavior: CountdownEndBehavior::HoldZero,
                background_media_id: None,
                position: CountdownPosition::Center,
                scheduled_start: None,
                message_scale: 100,
                digits_scale: 100,
            }),
            webview_config: None,
            sort_order: 0,
            notes: None,
        }
    }

    fn set_with(items: Vec<crate::domain::set::SetItem>) -> ServiceSet {
        ServiceSet {
            id: "set-1".into(),
            name: "Culto".into(),
            service_date: None,
            notes: None,
            created_at: 0,
            updated_at: 0,
            items,
        }
    }

    #[test]
    fn live_restart_target_is_the_source_items_config() {
        let set = set_with(vec![
            countdown_item("cd-1", CountdownTarget::Duration { duration_ms: 600_000 }),
            countdown_item("cd-2", CountdownTarget::FixedTime { hour: 19, minute: 0 }),
        ]);
        let from_duration = CountdownState {
            source_item_id: Some("cd-1".into()),
            duration_ms: 900_000, // adjusted state must not win over the item
            ..running_with(30_000)
        };
        assert_eq!(
            restart_target(&from_duration, Some(&set)),
            CountdownTarget::Duration { duration_ms: 600_000 }
        );
        let from_fixed = CountdownState {
            source_item_id: Some("cd-2".into()),
            ..running_with(30_000)
        };
        assert_eq!(
            restart_target(&from_fixed, Some(&set)),
            CountdownTarget::FixedTime { hour: 19, minute: 0 }
        );
    }

    #[test]
    fn live_restart_target_falls_back_to_own_duration() {
        let set = set_with(vec![countdown_item(
            "cd-1",
            CountdownTarget::Duration { duration_ms: 600_000 },
        )]);
        // A fired schedule has no source item.
        let fired = CountdownState {
            takeover: true,
            duration_ms: 300_000,
            ..running_with(10_000)
        };
        assert_eq!(
            restart_target(&fired, Some(&set)),
            CountdownTarget::Duration { duration_ms: 300_000 }
        );
        // A source item no longer in the set.
        let orphan = CountdownState {
            source_item_id: Some("gone".into()),
            duration_ms: 300_000,
            ..running_with(10_000)
        };
        assert_eq!(
            restart_target(&orphan, Some(&set)),
            CountdownTarget::Duration { duration_ms: 300_000 }
        );
        assert_eq!(
            restart_target(&orphan, None),
            CountdownTarget::Duration { duration_ms: 300_000 }
        );
    }

    #[test]
    fn live_restart_runs_from_target() {
        let target = CountdownTarget::Duration { duration_ms: 600_000 };
        let adjusted_running = CountdownState {
            remaining_ms: 192_000 + 300_000, // 03:12 after +5 min
            target_epoch_ms: Some(NOW + 492_000),
            takeover: true,
            position: CountdownPosition::BottomRight,
            message_scale: 150,
            digits_scale: 200,
            ..running_with(0)
        };
        for start in [
            adjusted_running,
            held(CountdownMode::Paused, 100_000),
            held(CountdownMode::Finished, 0),
        ] {
            let r = restarted(&start, &target, NOW + 600_000, NOW).unwrap();
            assert_eq!(r.mode, CountdownMode::Running, "{:?}", start.mode);
            assert_eq!(r.remaining_ms, 600_000);
            assert_eq!(r.target_epoch_ms, Some(NOW + 600_000));
            assert_eq!(r.duration_ms, 600_000);
            assert_eq!(r.scheduled_start_epoch_ms, None);
            assert_eq!(r.takeover, start.takeover);
            assert_eq!(r.position, start.position);
            assert_eq!(r.message_scale, start.message_scale);
            assert_eq!(r.digits_scale, start.digits_scale);
        }
    }

    #[test]
    fn live_adjust_keeps_configured_duration() {
        let s = running_with(270_000);
        let a = adjusted(&s, 300_000, NOW).unwrap();
        assert_eq!(a.duration_ms, 600_000);
        let b = adjusted(&a, -60_000, NOW).unwrap();
        assert_eq!(b.duration_ms, 600_000);
        // pause_countdown only flips the mode and freezes remaining_ms.
        let paused = CountdownState {
            mode: CountdownMode::Paused,
            target_epoch_ms: None,
            ..b
        };
        let c = resumed(&paused, NOW).unwrap();
        assert_eq!(c.duration_ms, 600_000);
    }

    #[test]
    fn live_adjust_refuses_idle_and_scheduled() {
        assert_eq!(code(adjusted(&CountdownState::default(), 60_000, NOW)), "countdown.not_active");
        let scheduled = CountdownState {
            mode: CountdownMode::Scheduled,
            scheduled_start_epoch_ms: Some(NOW + 3_600_000),
            remaining_ms: 3_600_000,
            ..CountdownState::default()
        };
        assert_eq!(code(adjusted(&scheduled, 60_000, NOW)), "countdown.not_active");
        assert_eq!(code(adjusted(&scheduled, -60_000, NOW)), "countdown.not_active");
    }

    #[test]
    fn live_resume_refuses_when_not_paused() {
        for s in [
            running_with(270_000),
            CountdownState::default(),
            held(CountdownMode::Finished, 0),
            held(CountdownMode::Scheduled, 10_000),
        ] {
            assert_eq!(code(resumed(&s, NOW)), "countdown.not_paused", "{:?}", s.mode);
        }
    }

    #[test]
    fn live_restart_refuses_idle_and_scheduled() {
        let target = CountdownTarget::Duration { duration_ms: 600_000 };
        for s in [CountdownState::default(), held(CountdownMode::Scheduled, 10_000)] {
            assert_eq!(
                code(restarted(&s, &target, NOW + 600_000, NOW)),
                "countdown.not_active",
                "{:?}",
                s.mode
            );
        }
    }
}
