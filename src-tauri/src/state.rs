use std::sync::Arc;
use sqlx::SqlitePool;
use tokio::sync::{OnceCell, RwLock};

/// AppState holds all shared mutable state for the Tauri application.
/// The frontend stores are projections of this state, kept in sync via Tauri events.
pub struct AppState {
    /// Phase 0 counter demo — will be replaced by Arc<RwLock<PresentationState>> in Phase 1
    pub counter: Arc<RwLock<i32>>,

    /// SQLite connection pool. Set once during Tauri setup after migrations run.
    /// `OnceCell` lets us hand a pre-constructed `AppState` to `.manage()` and
    /// then fill the pool in synchronously inside `setup` via `set(...)`.
    /// Reads use `db.get().expect("pool initialized in setup")`.
    pub db: OnceCell<SqlitePool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            counter: Arc::new(RwLock::new(0)),
            db: OnceCell::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn counter_starts_at_zero() {
        let state = AppState::default();
        let value = *state.counter.read().await;
        assert_eq!(value, 0);
    }

    #[tokio::test]
    async fn counter_can_be_incremented() {
        let state = AppState::default();
        {
            let mut counter = state.counter.write().await;
            *counter += 1;
        }
        let value = *state.counter.read().await;
        assert_eq!(value, 1);
    }

    #[tokio::test]
    async fn db_pool_unset_by_default() {
        let state = AppState::default();
        assert!(state.db.get().is_none());
    }
}
