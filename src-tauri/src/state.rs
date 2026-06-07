use std::sync::Arc;
use sqlx::SqlitePool;
use tokio::sync::{Mutex, OnceCell, RwLock};
use crate::domain::countdown::CountdownState;
use crate::domain::presentation::PresentationState;
use crate::domain::slide::Slide;

/// AppState holds all shared mutable state for the Tauri application.
/// The frontend stores are projections of this state, kept in sync via Tauri events.
pub struct AppState {
    /// SQLite connection pool. Set once during Tauri setup after migrations run.
    pub db: OnceCell<SqlitePool>,

    /// Single source of truth for the live presentation.
    /// Drop the write guard before calling app.emit() to avoid deadlock.
    pub presentation: Arc<RwLock<PresentationState>>,

    /// Pre-computed slides for each set item, parallel to presentation.set.items.
    /// Only updated by load_set_for_presentation; read by navigation commands.
    pub presentation_slides: Arc<RwLock<Vec<Vec<Slide>>>>,

    /// Countdown timer state. Updated by countdown commands and the ticker task.
    pub countdown: Arc<RwLock<CountdownState>>,

    /// AbortHandle for the active countdown ticker task. None when not running.
    pub countdown_task: Arc<Mutex<Option<tokio::task::AbortHandle>>>,

    /// Running MediaMTX process bridging a camera stream (RTMP/SRT/multicast) to
    /// WebRTC, plus the config it was started for. None when nothing is being
    /// proxied. The child is spawned with `kill_on_drop` so it dies with the app.
    pub stream_proxy: Arc<Mutex<Option<StreamProxy>>>,
}

/// A running MediaMTX proxy and the rendered config it serves. The config string
/// doubles as an identity key: an identical request reuses the live process.
pub struct StreamProxy {
    pub config: String,
    pub child: tokio::process::Child,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            db: OnceCell::new(),
            presentation: Arc::new(RwLock::new(PresentationState::default())),
            presentation_slides: Arc::new(RwLock::new(Vec::new())),
            countdown: Arc::new(RwLock::new(CountdownState::default())),
            countdown_task: Arc::new(Mutex::new(None)),
            stream_proxy: Arc::new(Mutex::new(None)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn db_pool_unset_by_default() {
        let state = AppState::default();
        assert!(state.db.get().is_none());
    }

    #[tokio::test]
    async fn countdown_starts_idle() {
        use crate::domain::countdown::CountdownMode;
        let state = AppState::default();
        let cd = state.countdown.read().await;
        assert_eq!(cd.duration_ms, 0);
        assert_eq!(cd.remaining_ms, 0);
        assert_eq!(cd.mode, CountdownMode::Idle);
        assert!(cd.target_epoch_ms.is_none());
    }
}
