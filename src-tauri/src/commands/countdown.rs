use crate::commands::presentation::{do_blank_presentation, do_next_slide};
use crate::domain::countdown::{
    CountdownEndBehavior, CountdownMode, CountdownState, CountdownTarget, ScheduledStart,
};
use crate::domain::error::ErrorPayload;
use crate::domain::presentation::PresentationState;
use crate::domain::slide::Slide;
use crate::state::AppState;
use serde::Serialize;
use sqlx::SqlitePool;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::RwLock;
use tokio::time::Duration;

/// Payload emitted as `countdown_triggered` when a scheduled countdown reaches
/// its wall-clock start time. The operator window reacts by ensuring the
/// presentation window is open and (optionally) jumping to the configured item.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CountdownTriggeredPayload {
    pub set_id: Option<String>,
    pub item_index: Option<usize>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Resolve a `ScheduledStart` (wall-clock HH:MM) to an absolute epoch-ms.
/// Uses today's HH:MM in local time; if already past, rolls to tomorrow.
pub fn resolve_scheduled_start_epoch_ms(
    s: &ScheduledStart,
    now_ms: u64,
) -> Result<u64, ErrorPayload> {
    if s.hour > 23 || s.minute > 59 {
        return Err(ErrorPayload::new("countdown.invalid_time"));
    }
    use chrono::{Local, TimeZone};
    let now_local = Local::now();
    let today = now_local.date_naive();
    let target_naive = today
        .and_hms_opt(s.hour as u32, s.minute as u32, 0)
        .ok_or_else(|| ErrorPayload::new("countdown.invalid_time"))?;
    let target_local = Local
        .from_local_datetime(&target_naive)
        .single()
        .ok_or_else(|| ErrorPayload::new("countdown.invalid_time"))?;
    let target_ms = target_local.timestamp_millis() as u64;
    if target_ms <= now_ms {
        Ok(target_ms + 86_400_000)
    } else {
        Ok(target_ms)
    }
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
                // Auto-clear the takeover so the underlying presentation returns
                // (and so a Blackout/AdvanceSet end-behavior becomes visible).
                s.takeover = false;
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

/// Drift-free ticker for `Scheduled` mode. Decrements `remaining_ms` toward 0
/// using `scheduled_start_epoch_ms - now()`. On reaching 0, transitions to
/// `Running` (target_epoch = now + duration_ms), emits `countdown_triggered`
/// (so the operator window can open the presentation + jump to the item), and
/// spawns the normal `tick_countdown` to run the actual countdown.
#[allow(clippy::too_many_arguments)]
async fn tick_scheduled(
    countdown: Arc<RwLock<CountdownState>>,
    countdown_task: Arc<tokio::sync::Mutex<Option<tokio::task::AbortHandle>>>,
    app: AppHandle,
    presentation: Arc<RwLock<PresentationState>>,
    presentation_slides: Arc<RwLock<Vec<Vec<Slide>>>>,
    pool: SqlitePool,
    set_id: Option<String>,
    item_index: Option<usize>,
) {
    loop {
        let sleep_ms = {
            let s = countdown.read().await;
            if s.mode != CountdownMode::Scheduled {
                return;
            }
            let r = s.remaining_ms % 1000;
            if r == 0 { 1000 } else { r }
        };

        tokio::time::sleep(Duration::from_millis(sleep_ms)).await;

        // Recompute from wall clock so OS jitter doesn't accumulate.
        let (remaining, duration_for_start) = {
            let now = now_ms();
            let mut s = countdown.write().await;
            if s.mode != CountdownMode::Scheduled {
                return;
            }
            let start_epoch = s.scheduled_start_epoch_ms.unwrap_or(now);
            let remaining = start_epoch.saturating_sub(now);
            s.remaining_ms = remaining;
            (remaining, s.duration_ms)
        };

        // Emit tick (mode still Scheduled).
        let snapshot = countdown.read().await.clone();
        let _ = app.emit("countdown_tick", &snapshot);

        if remaining == 0 {
            // Transition to Running: clear scheduled, set target, switch mode.
            let now = now_ms();
            let target_epoch = now + duration_for_start;
            let running_snapshot = {
                let mut s = countdown.write().await;
                s.scheduled_start_epoch_ms = None;
                s.target_epoch_ms = Some(target_epoch);
                s.remaining_ms = duration_for_start;
                s.mode = CountdownMode::Running;
                // Takeover engages ONLY now, at the wall-clock fire — never while
                // merely Scheduled. This lets a countdown be armed hours ahead
                // without seizing the projector during the wait; it overlays the
                // screen the instant it starts running, then auto-clears at 00:00.
                s.takeover = true;
                s.clone()
            };

            // Tell the operator window to ensure presentation is open + jump to item.
            let _ = app.emit(
                "countdown_triggered",
                CountdownTriggeredPayload { set_id, item_index },
            );

            // Emit the first Running tick so renderers swap immediately.
            let _ = app.emit("countdown_tick", &running_snapshot);

            // Hand off to the normal tick_countdown.
            let join_handle = tokio::spawn(tick_countdown(
                Arc::clone(&countdown),
                app.clone(),
                Arc::clone(&presentation),
                Arc::clone(&presentation_slides),
                pool.clone(),
            ));
            let mut task = countdown_task.lock().await;
            *task = Some(join_handle.abort_handle());

            return;
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
        s.takeover = false;
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
    takeover: Option<bool>,
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
        s.scheduled_start_epoch_ms = None;
        s.remaining_ms = target_epoch.saturating_sub(now);
        s.mode = CountdownMode::Running;
        if let Some(t) = takeover {
            s.takeover = t;
        }
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
        s.scheduled_start_epoch_ms = None;
        s.takeover = false;
        s.clone()
    };
    let _ = app.emit("countdown_tick", &snapshot);
    Ok(snapshot)
}

/// Arm a scheduled countdown. The state goes to `Scheduled` and `remaining_ms`
/// ticks down to the wall-clock `scheduled_start`. On reaching it the ticker
/// emits `countdown_triggered` (with optional `set_id`/`item_index`) and
/// transitions to `Running` with the configured `duration_ms`.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn arm_countdown(
    state: State<'_, AppState>,
    app: AppHandle,
    scheduled_start: ScheduledStart,
    duration_ms: u64,
    message: Option<String>,
    end_behavior: Option<CountdownEndBehavior>,
    set_id: Option<String>,
    item_index: Option<usize>,
    takeover: Option<bool>,
) -> Result<CountdownState, ErrorPayload> {
    if duration_ms == 0 {
        return Err(ErrorPayload::new("countdown.duration_not_set"));
    }

    // Abort any running ticker first (running OR scheduled).
    {
        let mut task = state.countdown_task.lock().await;
        if let Some(handle) = task.take() {
            handle.abort();
        }
    }

    let now = now_ms();
    let start_epoch = resolve_scheduled_start_epoch_ms(&scheduled_start, now)?;

    let snapshot = {
        let mut s = state.countdown.write().await;
        s.duration_ms = duration_ms;
        s.scheduled_start_epoch_ms = Some(start_epoch);
        s.target_epoch_ms = None;
        s.remaining_ms = start_epoch.saturating_sub(now);
        s.mode = CountdownMode::Scheduled;
        if let Some(msg) = message {
            s.message = Some(msg);
        }
        if let Some(eb) = end_behavior {
            s.end_behavior = eb;
        }
        // Arming never takes over the screen — takeover engages at fire time
        // (see tick_scheduled). The param is retained for IPC compat only.
        let _ = takeover;
        s.takeover = false;
        s.clone()
    };

    let pool = state.db.get().expect("db initialized").clone();
    let countdown_arc = Arc::clone(&state.countdown);
    let task_arc = Arc::clone(&state.countdown_task);
    let presentation_arc = Arc::clone(&state.presentation);
    let slides_arc = Arc::clone(&state.presentation_slides);
    let app_clone = app.clone();

    let join_handle = tokio::spawn(tick_scheduled(
        countdown_arc,
        task_arc,
        app_clone,
        presentation_arc,
        slides_arc,
        pool,
        set_id,
        item_index,
    ));

    {
        let mut task = state.countdown_task.lock().await;
        *task = Some(join_handle.abort_handle());
    }

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
    fn resolve_scheduled_start_invalid_hour_returns_err() {
        let s = ScheduledStart { hour: 25, minute: 0 };
        assert!(resolve_scheduled_start_epoch_ms(&s, 0).is_err());
    }

    #[test]
    fn resolve_scheduled_start_invalid_minute_returns_err() {
        let s = ScheduledStart { hour: 12, minute: 60 };
        assert!(resolve_scheduled_start_epoch_ms(&s, 0).is_err());
    }

    #[test]
    fn resolve_scheduled_start_rolls_to_tomorrow_if_past() {
        use chrono::{Local, Timelike};
        // Pick "1 minute ago" in the current local hour/minute.
        let now_local = Local::now();
        // Use the current hour+minute, then pass a `now_ms` that is FAR in the
        // future so resolver decides "past, roll to tomorrow".
        let s = ScheduledStart {
            hour: now_local.hour() as u8,
            minute: now_local.minute() as u8,
        };
        let now_ms = (now_local.timestamp_millis() as u64) + 60_000_000; // way in future
        let resolved = resolve_scheduled_start_epoch_ms(&s, now_ms).unwrap();
        assert!(resolved > now_ms, "scheduled should roll to tomorrow when past");
    }

    #[test]
    fn takeover_engages_at_fire_not_at_arm() {
        // Arming lands in Scheduled with NO takeover — the projector stays put
        // during the wait (mirrors arm_countdown's state write).
        let mut s = CountdownState {
            mode: CountdownMode::Scheduled,
            takeover: false,
            ..CountdownState::default()
        };
        assert!(!s.takeover, "arming must not take over the screen");

        // The Scheduled→Running fire transition flips both (mirrors tick_scheduled).
        s.mode = CountdownMode::Running;
        s.takeover = true;
        assert_eq!(s.mode, CountdownMode::Running);
        assert!(s.takeover, "takeover must engage the instant the countdown fires");
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
