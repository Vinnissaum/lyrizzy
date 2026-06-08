use std::collections::HashMap;
use std::sync::Arc;
use sqlx::SqlitePool;
use tokio::sync::{Mutex, OnceCell, RwLock};
use crate::domain::countdown::CountdownState;
use crate::domain::output::OutputId;
use crate::domain::presentation::PresentationState;
use crate::domain::slide::Slide;

/// All mutable presentation state for a single output (screen / TV).
///
/// Each output runs its own set and is navigated independently, so every field
/// that used to be a single global on [`AppState`] now lives per-output here.
/// The ticker/navigation helpers already take these `Arc`s as parameters, so
/// driving a specific output is just a matter of handing them that output's
/// `Arc`s.
pub struct OutputState {
    /// Single source of truth for this output's live presentation.
    /// Drop the write guard before calling app.emit() to avoid deadlock.
    pub presentation: Arc<RwLock<PresentationState>>,

    /// Pre-computed slides for each set item, parallel to presentation.set.items.
    /// Only updated by load_set_for_presentation; read by navigation commands.
    pub presentation_slides: Arc<RwLock<Vec<Vec<Slide>>>>,

    /// This output's countdown timer state. Updated by countdown commands and
    /// the per-output ticker task.
    pub countdown: Arc<RwLock<CountdownState>>,

    /// AbortHandle for this output's active countdown ticker task. None when not
    /// running.
    pub countdown_task: Arc<Mutex<Option<tokio::task::AbortHandle>>>,
}

impl Default for OutputState {
    fn default() -> Self {
        Self {
            presentation: Arc::new(RwLock::new(PresentationState::default())),
            presentation_slides: Arc::new(RwLock::new(Vec::new())),
            countdown: Arc::new(RwLock::new(CountdownState::default())),
            countdown_task: Arc::new(Mutex::new(None)),
        }
    }
}

/// AppState holds all shared mutable state for the Tauri application.
/// The frontend stores are projections of this state, kept in sync via Tauri events.
pub struct AppState {
    /// SQLite connection pool. Set once during Tauri setup after migrations run.
    pub db: OnceCell<SqlitePool>,

    /// Per-output presentation state. Both [`OutputId`] variants are always
    /// present (built in `Default`), so [`AppState::output`] never misses.
    outputs: HashMap<OutputId, OutputState>,

    /// Running MediaMTX process bridging a camera stream (RTMP/SRT/multicast) to
    /// WebRTC, plus the config it was started for. None when nothing is being
    /// proxied. The child is spawned with `kill_on_drop` so it dies with the app.
    /// Global (not per-output): only one camera is proxied at a time.
    pub stream_proxy: Arc<Mutex<Option<StreamProxy>>>,
}

impl AppState {
    /// Borrow the state for a given output. Both outputs are created in
    /// `Default`, so this never panics in normal operation.
    pub fn output(&self, id: OutputId) -> &OutputState {
        self.outputs
            .get(&id)
            .expect("output state is always present for every OutputId")
    }
}

/// A running MediaMTX proxy and the rendered config it serves. The config string
/// doubles as an identity key: an identical request reuses the live process.
pub struct StreamProxy {
    pub config: String,
    pub child: tokio::process::Child,
}

impl Default for AppState {
    fn default() -> Self {
        let outputs = OutputId::ALL
            .into_iter()
            .map(|id| (id, OutputState::default()))
            .collect();
        Self {
            db: OnceCell::new(),
            outputs,
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
        let cd = state.output(OutputId::One).countdown.read().await;
        assert_eq!(cd.duration_ms, 0);
        assert_eq!(cd.remaining_ms, 0);
        assert_eq!(cd.mode, CountdownMode::Idle);
        assert!(cd.target_epoch_ms.is_none());
    }

    #[tokio::test]
    async fn both_outputs_exist_and_are_independent() {
        let state = AppState::default();
        // Mutating output One's presentation must not affect output Two.
        {
            let mut p = state.output(OutputId::One).presentation.write().await;
            p.current_item_index = 5;
        }
        assert_eq!(
            state.output(OutputId::One).presentation.read().await.current_item_index,
            5
        );
        assert_eq!(
            state.output(OutputId::Two).presentation.read().await.current_item_index,
            0
        );
    }
}
