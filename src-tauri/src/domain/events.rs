//! Tagged event payloads broadcast to the windows.
//!
//! With two independent outputs, `state_changed` and `countdown_tick` must say
//! *which* output they describe so each presentation window can ignore the
//! other's events and the operator can track both. The payload wraps the
//! existing state with its [`OutputId`].

use serde::Serialize;

use crate::domain::countdown::CountdownState;
use crate::domain::output::OutputId;
use crate::domain::presentation::PresentationState;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StateChangedPayload {
    pub output: OutputId,
    pub state: PresentationState,
}

impl StateChangedPayload {
    pub fn new(output: OutputId, state: PresentationState) -> Self {
        Self { output, state }
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CountdownTickPayload {
    pub output: OutputId,
    pub state: CountdownState,
}

impl CountdownTickPayload {
    pub fn new(output: OutputId, state: CountdownState) -> Self {
        Self { output, state }
    }
}
