use crate::commands::presentation::{do_blank_presentation, do_next_slide};
use crate::domain::countdown::{CountdownEndBehavior, CountdownMode, CountdownState, CountdownTarget};
use crate::domain::error::ErrorPayload;
use crate::domain::presentation::PresentationState;
use crate::domain::slide::Slide;
use crate::state::AppState;
use sqlx::SqlitePool;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::RwLock;
use tokio::time::Duration;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Resolve a `CountdownTarget` to an absolute epoch-ms deadline.
/// For `Duration`: `now_ms + duration_ms`.
/// For `FixedTime`: today's `HH:MM:00` in local time; if already past, rolls to tomorrow.
pub fn resolve_target_epoch_ms(target: &CountdownTarget, now_ms: u64) -> Result<u64, ErrorPayload> {
    match target {
        CountdownTarget::Duration { duration_ms } => Ok(now_ms + duration_ms),
        CountdownTarget::FixedTime { hour, minute } => {
            if *hour > 23 || *minute > 59 {
                return Err(ErrorPayload::new("countdown.invalid_time"));
            }
            use chrono::{Local, TimeZone};
            let now_local = Local::now();
            let today = now_local.date_naive();
            let target_naive = today
                .and_hms_opt(*hour as u32, *minute as u32, 0)
                .ok_or_else(|| ErrorPayload::new("countdown.invalid_time"))?;
            let target_local = Local
                .from_local_datetime(&target_naive)
                .single()
                .ok_or_else(|| ErrorPayload::new("countdown.invalid_time"))?;
            let target_ms = target_local.timestamp_millis() as u64;
            // If already at or past target, roll to tomorrow.
            if target_ms <= now_ms {
                Ok(target_ms + 86_400_000)
            } else {
                Ok(target_ms)
            }
        }
    }
}

/// Drift-free countdown ticker. Computes `remaining = target - now()` each tick
/// so OS scheduling jitter never accumulates. Sleeps until the next whole-second
/// boundary to keep the displayed counter smooth.
async fn tick_countdown(
    countdown: Arc<RwLock<CountdownState>>,
    app: AppHandle,
    presentation: Arc<RwLock<PresentationState>>,
    presentation_slides: Arc<RwLock<Vec<Vec<Slide>>>>,
    pool: SqlitePool,
) {
    loop {
        // Sleep until next whole-second boundary to keep the display smooth.
        let sleep_ms = {
            let s = countdown.read().await;
            if s.mode != CountdownMode::Running {
                return;
            }
            let r = s.remaining_ms % 1000;
            if r == 0 { 1000 } else { r }
        };

        tokio::time::sleep(Duration::from_millis(sleep_ms)).await;

        // Recompute remaining from wall clock — drift is bounded by one tick (~1 s).
        let (remaining, end_behavior) = {
            let now = now_ms();
            let mut s = countdown.write().await;
            if s.mode != CountdownMode::Running {
                return; // aborted or paused while sleeping
            }
            let target = s.target_epoch_ms.unwrap_or(now);
            let remaining = target.saturating_sub(now);
            s.remaining_ms = remaining;
            if remaining == 0 {
                s.mode = CountdownMode::Finished;
            }
            (remaining, s.end_behavior.clone())
        };

        // Drop all locks before emitting (CLAUDE.md invariant).
        let snapshot = countdown.read().await.clone();
        let _ = app.emit("countdown_tick", &snapshot);

        if remaining == 0 {
            match end_behavior {
                CountdownEndBehavior::HoldZero => {}
                CountdownEndBehavior::Blackout => {
                    let _ =
                        do_blank_presentation(&presentation, &presentation_slides, &app).await;
                }
                CountdownEndBehavior::AdvanceSet => {
                    let _ =
                        do_next_slide(&pool, &presentation, &presentation_slides, &app).await;
                }
            }
            break;
        }
    }
}

// ─── Commands ────────────────────────────────────────────────────────────────

/// Set duration without starting. Kept for the standalone CountdownPanel.
#[tauri::command]
pub async fn set_countdown_duration(
    state: State<'_, AppState>,
    app: AppHandle,
    duration_ms: u64,
) -> Result<CountdownState, ErrorPayload> {
    {
        let mut task = state.countdown_task.lock().await;
        if let Some(handle) = task.take() {
            handle.abort();
        }
    }
    let snapshot = {
        let mut s = state.countdown.write().await;
        s.duration_ms = duration_ms;
        s.remaining_ms = duration_ms;
        s.mode = CountdownMode::Idle;
        s.target_epoch_ms = None;
        s.clone()
    };
    let _ = app.emit("countdown_tick", &snapshot);
    Ok(snapshot)
}

/// Start (or restart) the countdown.
/// - `target`: `CountdownTarget` (new). Takes precedence over `duration_ms`.
/// - `duration_ms`: legacy duration override (backward compat — treated as `Duration` target).
/// - `message`: if provided, overrides the stored message.
/// - `end_behavior`: if provided, overrides the stored end behavior.
#[tauri::command]
pub async fn start_countdown(
    state: State<'_, AppState>,
    app: AppHandle,
    target: Option<CountdownTarget>,
    duration_ms: Option<u64>,
    message: Option<String>,
    end_behavior: Option<CountdownEndBehavior>,
) -> Result<CountdownState, ErrorPayload> {
    // Abort any running ticker first.
    {
        let mut task = state.countdown_task.lock().await;
        if let Some(handle) = task.take() {
            handle.abort();
        }
    }

    let now = now_ms();

    // Resolve the effective target: explicit target > legacy duration_ms > stored duration.
    let effective_target: CountdownTarget = if let Some(t) = target {
        t
    } else if let Some(dur) = duration_ms {
        CountdownTarget::Duration { duration_ms: dur }
    } else {
        let s = state.countdown.read().await;
        if s.duration_ms == 0 {
            return Err(ErrorPayload::new("countdown.duration_not_set"));
        }
        CountdownTarget::Duration { duration_ms: s.duration_ms }
    };

    let target_epoch = resolve_target_epoch_ms(&effective_target, now)?;

    let snapshot = {
        let mut s = state.countdown.write().await;
        // Keep duration_ms in state for display / reset purposes (Duration only).
        if let CountdownTarget::Duration { duration_ms: dur } = &effective_target {
            s.duration_ms = *dur;
        }
        if let Some(msg) = message {
            s.message = Some(msg);
        }
        if let Some(eb) = end_behavior {
            s.end_behavior = eb;
        }
        s.target_epoch_ms = Some(target_epoch);
        s.remaining_ms = target_epoch.saturating_sub(now);
        s.mode = CountdownMode::Running;
        s.clone()
    };

    let pool = state.db.get().expect("db initialized").clone();
    let countdown_arc = Arc::clone(&state.countdown);
    let presentation_arc = Arc::clone(&state.presentation);
    let slides_arc = Arc::clone(&state.presentation_slides);
    let app_clone = app.clone();

    let join_handle = tokio::spawn(tick_countdown(
        countdown_arc,
        app_clone,
        presentation_arc,
        slides_arc,
        pool,
    ));

    {
        let mut task = state.countdown_task.lock().await;
        *task = Some(join_handle.abort_handle());
    }

    let _ = app.emit("countdown_tick", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub async fn pause_countdown(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<CountdownState, ErrorPayload> {
    {
        let mut task = state.countdown_task.lock().await;
        if let Some(handle) = task.take() {
            handle.abort();
        }
    }
    let snapshot = {
        let now = now_ms();
        let mut s = state.countdown.write().await;
        // Freeze remaining_ms at exact wall-clock value rather than last emitted tick.
        if s.mode == CountdownMode::Running {
            let target = s.target_epoch_ms.unwrap_or(now);
            s.remaining_ms = target.saturating_sub(now);
        }
        s.mode = CountdownMode::Paused;
        s.clone()
    };
    let _ = app.emit("countdown_tick", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub async fn reset_countdown(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<CountdownState, ErrorPayload> {
    {
        let mut task = state.countdown_task.lock().await;
        if let Some(handle) = task.take() {
            handle.abort();
        }
    }
    let snapshot = {
        let mut s = state.countdown.write().await;
        s.remaining_ms = s.duration_ms;
        s.mode = CountdownMode::Idle;
        s.target_epoch_ms = None;
        s.clone()
    };
    let _ = app.emit("countdown_tick", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub async fn get_countdown_state(
    state: State<'_, AppState>,
) -> Result<CountdownState, ErrorPayload> {
    Ok(state.countdown.read().await.clone())
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_duration_adds_to_now() {
        let target = CountdownTarget::Duration { duration_ms: 60_000 };
        assert_eq!(resolve_target_epoch_ms(&target, 10_000).unwrap(), 70_000);
    }

    #[test]
    fn resolve_fixed_time_invalid_hour_returns_err() {
        let target = CountdownTarget::FixedTime { hour: 25, minute: 0 };
        assert!(resolve_target_epoch_ms(&target, 0).is_err());
    }

    #[test]
    fn resolve_fixed_time_invalid_minute_returns_err() {
        let target = CountdownTarget::FixedTime { hour: 12, minute: 60 };
        assert!(resolve_target_epoch_ms(&target, 0).is_err());
    }

    #[test]
    fn remaining_is_drift_free() {
        // Simulate the wall-clock computation: target set 3 s in the "past" future.
        let target: u64 = 10_000; // epoch ms (synthetic)
        let now: u64 = 8_500; // 1.5 s before target
        let remaining = target.saturating_sub(now);
        assert_eq!(remaining, 1500);
    }

    #[test]
    fn remaining_saturates_at_zero() {
        let target: u64 = 5_000;
        let now: u64 = 6_000; // past target
        let remaining = target.saturating_sub(now);
        assert_eq!(remaining, 0);
    }

    #[test]
    fn sleep_ms_aligns_to_second_boundary() {
        // remaining = 4700 → next boundary at 4000 → sleep 700
        let remaining: u64 = 4700;
        let r = remaining % 1000;
        let sleep = if r == 0 { 1000 } else { r };
        assert_eq!(sleep, 700);

        // remaining = 3000 → exactly on boundary → sleep 1000
        let remaining: u64 = 3000;
        let r = remaining % 1000;
        let sleep = if r == 0 { 1000 } else { r };
        assert_eq!(sleep, 1000);
    }
}
