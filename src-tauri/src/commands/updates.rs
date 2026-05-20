use crate::domain::error::ErrorPayload;
use crate::domain::update::UpdateInfo;
use crate::state::AppState;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

const SETTING_LAST_CHECK: &str = "last_update_check";
const CHECK_INTERVAL_SECS: i64 = 24 * 60 * 60;

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

#[tauri::command]
pub async fn check_for_updates(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    force: bool,
) -> Result<Option<UpdateInfo>, ErrorPayload> {
    let pool = state.db.get().ok_or_else(|| ErrorPayload::new("update.db_not_initialized"))?;
    let now = now_unix();
    let last_check = read_last_check(pool).await;

    if !should_check(&last_check, force, now) {
        return Ok(None);
    }

    touch_last_check(pool, now).await;

    let updater = match app.updater() {
        Ok(u) => u,
        Err(_) => return Ok(None),
    };

    let update = match updater.check().await {
        Ok(u) => u,
        Err(_) => return Ok(None),
    };

    let Some(update) = update else {
        return Ok(None);
    };

    let current = app.package_info().version.to_string();
    // Ignore downgrades silently
    if semver_le(&update.version, &current) {
        return Ok(None);
    }

    Ok(Some(UpdateInfo {
        version: update.version.clone(),
        current_version: current,
        notes: update.body.clone(),
        pub_date: update.date.map(|d| d.to_string()),
    }))
}

#[tauri::command]
pub async fn apply_update_and_restart(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), ErrorPayload> {
    let _pool = state.db.get().ok_or_else(|| ErrorPayload::new("update.db_not_initialized"))?;

    let updater = app
        .updater()
        .map_err(|e| ErrorPayload::new("update.not_configured").with_param("detail", e.to_string()))?;

    let update = updater
        .check()
        .await
        .map_err(|e| ErrorPayload::new("update.check_failed").with_param("detail", e.to_string()))?
        .ok_or_else(|| ErrorPayload::new("update.no_update_available"))?;

    update
        .download_and_install(|_chunk, _total| {}, || {})
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.to_lowercase().contains("signature") || msg.to_lowercase().contains("public key") {
                ErrorPayload::new("update.signature_invalid").with_param("detail", msg)
            } else {
                ErrorPayload::new("update.download_failed").with_param("detail", msg)
            }
        })?;

    app.restart();
}

/// Very simple semver comparison: returns true if `a <= b`.
/// Only handles `MAJOR.MINOR.PATCH` without pre-release suffixes.
fn semver_le(a: &str, b: &str) -> bool {
    fn parts(s: &str) -> [u64; 3] {
        let mut it = s.split('.').filter_map(|p| p.parse::<u64>().ok());
        [it.next().unwrap_or(0), it.next().unwrap_or(0), it.next().unwrap_or(0)]
    }
    parts(a) <= parts(b)
}

#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn semver_le_detects_downgrade() {
        assert!(semver_le("0.1.0", "0.1.0")); // equal → le
        assert!(semver_le("0.0.9", "0.1.0")); // older
        assert!(!semver_le("0.2.0", "0.1.0")); // newer
        assert!(!semver_le("1.0.0", "0.9.9")); // newer major
    }
}
