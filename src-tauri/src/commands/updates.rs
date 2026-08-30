use crate::domain::error::ErrorPayload;
use crate::domain::update::{persists_last_check, UpdateCheckResult, UpdateInfo, UpdateProgress};
use crate::state::AppState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

const SETTING_LAST_CHECK: &str = "last_update_check";
const CHECK_INTERVAL_SECS: i64 = 24 * 60 * 60;
const CHECK_TIMEOUT_SECS: u64 = 30;
const PROGRESS_THROTTLE_MS: u64 = 250;

/// Returns true if we should query the updater endpoint.
pub fn should_check(last_check_str: &str, force: bool, now_secs: i64) -> bool {
    if force {
        return true;
    }
    let last: i64 = last_check_str.parse().unwrap_or(0);
    now_secs - last >= CHECK_INTERVAL_SECS
}

fn now_unix() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

async fn touch_last_check(pool: &sqlx::SqlitePool, now_secs: i64) {
    let _ = sqlx::query(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(SETTING_LAST_CHECK)
    .bind(now_secs.to_string())
    .execute(pool)
    .await;
}

async fn read_last_check(pool: &sqlx::SqlitePool) -> String {
    sqlx::query_scalar::<_, String>("SELECT value FROM settings WHERE key = ?")
        .bind(SETTING_LAST_CHECK)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .unwrap_or_default()
}

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Classifies a `download_and_install` failure by message content — the
/// plugin's `Error` enum is `#[non_exhaustive]`, so callers can't match on
/// its variants and must classify by call site / message instead.
pub fn classify_install_error(msg: &str) -> &'static str {
    let lower = msg.to_lowercase();
    if lower.contains("signature") || lower.contains("public key") {
        "update.signature_invalid"
    } else {
        "update.download_failed"
    }
}

/// Attempts to acquire a single-flight flag: `true` once, `false` while
/// already held.
pub fn try_acquire(flag: &AtomicBool) -> bool {
    flag.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_ok()
}

/// RAII guard pairing with [`try_acquire`]: releases the flag on drop, so
/// every early `?` return in the command frees it for the next attempt.
struct InProgressGuard(Arc<AtomicBool>);

impl InProgressGuard {
    fn acquire(flag: Arc<AtomicBool>) -> Option<Self> {
        try_acquire(&flag).then(|| InProgressGuard(flag))
    }
}

impl Drop for InProgressGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

/// Decides whether a progress event should be emitted now: the first chunk
/// always emits, a finished download always emits, and everything else is
/// throttled to at most once per [`PROGRESS_THROTTLE_MS`].
pub fn should_emit_progress(last_emit_ms: Option<u64>, now_ms: u64, finished: bool) -> bool {
    if finished {
        return true;
    }
    match last_emit_ms {
        None => true,
        Some(last) => now_ms.saturating_sub(last) >= PROGRESS_THROTTLE_MS,
    }
}

#[tauri::command]
pub async fn check_for_updates(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    force: bool,
) -> Result<UpdateCheckResult, ErrorPayload> {
    let pool = state.db.get().ok_or_else(|| ErrorPayload::new("update.db_not_initialized"))?;
    let now = now_unix();
    let last_check = read_last_check(pool).await;

    if !should_check(&last_check, force, now) {
        tracing::info!(status = "skipped", "update check skipped (debounce window)");
        return Ok(UpdateCheckResult::Skipped);
    }

    let updater = app
        .updater_builder()
        .timeout(Duration::from_secs(CHECK_TIMEOUT_SECS))
        .build()
        .map_err(|e| {
            ErrorPayload::new("update.not_configured").with_param("detail", e.to_string())
        })?;

    let checked = updater
        .check()
        .await
        .map_err(|e| ErrorPayload::new("update.check_failed").with_param("detail", e.to_string()))?;

    let result = match checked {
        Some(update) => {
            tracing::info!(status = "updateAvailable", version = %update.version, "update check completed");
            let info = UpdateInfo {
                version: update.version.clone(),
                current_version: update.current_version.clone(),
                notes: update.body.clone(),
                pub_date: update.date.map(|d| d.to_string()),
            };
            *state.pending_update.lock().await = Some(update);
            UpdateCheckResult::UpdateAvailable { info }
        }
        None => {
            tracing::info!(status = "upToDate", "update check completed");
            *state.pending_update.lock().await = None;
            UpdateCheckResult::UpToDate
        }
    };

    if persists_last_check(&result) {
        touch_last_check(pool, now).await;
    }

    Ok(result)
}

#[tauri::command]
pub async fn apply_update_and_restart(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), ErrorPayload> {
    let _pool = state.db.get().ok_or_else(|| ErrorPayload::new("update.db_not_initialized"))?;

    let _guard = InProgressGuard::acquire(state.update_in_progress.clone())
        .ok_or_else(|| ErrorPayload::new("update.already_in_progress"))?;

    let cached = state.pending_update.lock().await.take();
    let update = match cached {
        Some(update) => update,
        None => {
            let updater = app
                .updater_builder()
                .timeout(Duration::from_secs(CHECK_TIMEOUT_SECS))
                .build()
                .map_err(|e| {
                    ErrorPayload::new("update.not_configured").with_param("detail", e.to_string())
                })?;
            updater
                .check()
                .await
                .map_err(|e| {
                    ErrorPayload::new("update.check_failed").with_param("detail", e.to_string())
                })?
                .ok_or_else(|| ErrorPayload::new("update.no_update_available"))?
        }
    };

    let progress = Arc::new(std::sync::Mutex::new(UpdateProgress { downloaded: 0, total: None }));
    let progress_for_chunk = progress.clone();
    let app_for_chunk = app.clone();
    let mut last_emit_ms: Option<u64> = None;

    let progress_for_finish = progress.clone();
    let app_for_finish = app.clone();

    update
        .download_and_install(
            move |chunk, total| {
                let snapshot = {
                    let mut p = progress_for_chunk.lock().unwrap();
                    p.downloaded += chunk as u64;
                    p.total = total;
                    p.clone()
                };
                let now = now_millis();
                if should_emit_progress(last_emit_ms, now, false) {
                    last_emit_ms = Some(now);
                    let _ = app_for_chunk.emit("update_progress", snapshot);
                }
            },
            move || {
                let snapshot = progress_for_finish.lock().unwrap().clone();
                let _ = app_for_finish.emit("update_progress", snapshot);
            },
        )
        .await
        .map_err(|e| {
            let msg = e.to_string();
            let code = classify_install_error(&msg);
            tracing::error!(code = %code, "update install failed");
            ErrorPayload::new(code).with_param("detail", msg)
        })?;

    app.restart();
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqliteConnectOptions;
    use std::str::FromStr;
    use tempfile::tempdir;

    async fn open_db() -> (sqlx::SqlitePool, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let path = dir.path().join("updates_test.db");
        let url = format!("sqlite://{}?mode=rwc", path.to_string_lossy());
        let opts = SqliteConnectOptions::from_str(&url)
            .unwrap()
            .create_if_missing(true);
        let pool = sqlx::SqlitePool::connect_with(opts).await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        (pool, dir)
    }

    #[test]
    fn debounce_no_force_within_24h() {
        let now = 1_000_000i64;
        let last = (now - 3600).to_string(); // 1 hour ago
        assert!(!should_check(&last, false, now));
    }

    #[test]
    fn debounce_no_force_older_than_24h() {
        let now = 1_000_000i64;
        let last = (now - CHECK_INTERVAL_SECS - 1).to_string();
        assert!(should_check(&last, false, now));
    }

    #[test]
    fn debounce_force_bypasses_window() {
        let now = 1_000_000i64;
        let last = (now - 10).to_string(); // 10 seconds ago
        assert!(should_check(&last, true, now));
    }

    #[test]
    fn debounce_empty_last_check_triggers() {
        assert!(should_check("", false, 1_000_000));
    }

    #[tokio::test]
    async fn read_last_check_returns_empty_string_when_no_row() {
        let (pool, _dir) = open_db().await;
        assert_eq!(read_last_check(&pool).await, "");
    }

    #[tokio::test]
    async fn read_last_check_returns_stored_value_after_touch() {
        let (pool, _dir) = open_db().await;
        touch_last_check(&pool, 12345).await;
        assert_eq!(read_last_check(&pool).await, "12345");
    }

    #[tokio::test]
    async fn touch_last_check_upserts_overwrites_previous_value() {
        let (pool, _dir) = open_db().await;
        touch_last_check(&pool, 1000).await;
        touch_last_check(&pool, 2000).await;
        assert_eq!(read_last_check(&pool).await, "2000");
    }

    #[tokio::test]
    async fn touch_last_check_only_affects_its_own_settings_key() {
        let (pool, _dir) = open_db().await;
        sqlx::query("INSERT INTO settings (key, value) VALUES ('unrelated_key', 'untouched')")
            .execute(&pool)
            .await
            .unwrap();
        touch_last_check(&pool, 500).await;
        let other: String =
            sqlx::query_scalar("SELECT value FROM settings WHERE key = 'unrelated_key'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(other, "untouched");
    }

    #[tokio::test]
    async fn persisted_timestamp_round_trips_through_should_check_within_window() {
        let (pool, _dir) = open_db().await;
        touch_last_check(&pool, 1_000_000).await;
        let stored = read_last_check(&pool).await;
        assert!(!should_check(&stored, false, 1_000_000 + 3600)); // 1h later, within 24h window
    }

    #[tokio::test]
    async fn persisted_timestamp_round_trips_through_should_check_after_window_elapsed() {
        let (pool, _dir) = open_db().await;
        touch_last_check(&pool, 1_000_000).await;
        let stored = read_last_check(&pool).await;
        assert!(should_check(&stored, false, 1_000_000 + CHECK_INTERVAL_SECS + 1));
    }

    #[tokio::test]
    async fn skip_path_leaves_stored_timestamp_untouched() {
        let (pool, _dir) = open_db().await;
        touch_last_check(&pool, 1_000_000).await;
        let last = read_last_check(&pool).await;
        let now = 1_000_000 + 10; // well within the debounce window
        assert!(!should_check(&last, false, now));
        // check_for_updates's skip branch returns before calling
        // touch_last_check; confirm the stored value is unaffected.
        assert_eq!(read_last_check(&pool).await, "1000000");
    }

    #[test]
    fn classify_install_error_detects_signature_failure() {
        assert_eq!(classify_install_error("Signature mismatch"), "update.signature_invalid");
    }

    #[test]
    fn classify_install_error_detects_public_key_failure() {
        assert_eq!(classify_install_error("invalid public key"), "update.signature_invalid");
    }

    #[test]
    fn classify_install_error_is_case_insensitive() {
        assert_eq!(classify_install_error("SIGNATURE verification failed"), "update.signature_invalid");
    }

    #[test]
    fn classify_install_error_falls_back_to_download_failed() {
        assert_eq!(classify_install_error("connection reset by peer"), "update.download_failed");
    }

    #[test]
    fn try_acquire_returns_true_once_then_false() {
        let flag = AtomicBool::new(false);
        assert!(try_acquire(&flag));
        assert!(!try_acquire(&flag));
    }

    #[test]
    fn in_progress_guard_releases_flag_on_drop() {
        let flag = Arc::new(AtomicBool::new(false));
        {
            let _guard = InProgressGuard::acquire(flag.clone()).unwrap();
            assert!(flag.load(Ordering::SeqCst));
        }
        assert!(!flag.load(Ordering::SeqCst));
    }

    #[test]
    fn in_progress_guard_acquire_fails_when_already_held() {
        let flag = Arc::new(AtomicBool::new(false));
        let _guard = InProgressGuard::acquire(flag.clone()).unwrap();
        assert!(InProgressGuard::acquire(flag.clone()).is_none());
    }

    #[test]
    fn should_emit_progress_first_chunk_always_emits() {
        assert!(should_emit_progress(None, 0, false));
    }

    #[test]
    fn should_emit_progress_before_throttle_window_does_not_emit() {
        assert!(!should_emit_progress(Some(1000), 1249, false)); // 249ms later
    }

    #[test]
    fn should_emit_progress_at_throttle_window_emits() {
        assert!(should_emit_progress(Some(1000), 1250, false)); // 250ms later
    }

    #[test]
    fn should_emit_progress_finished_always_emits_even_within_window() {
        assert!(should_emit_progress(Some(1000), 1000, true)); // no time passed, but finished
    }
}
