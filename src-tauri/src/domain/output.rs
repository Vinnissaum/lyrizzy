use serde::{Deserialize, Serialize};

/// Identifies one of the independent presentation outputs (screens / TVs).
///
/// The app drives two outputs that each run their own set and are navigated
/// independently. `One` maps to the original single-output behaviour (window
/// label `"presentation"`); `Two` is the second screen (`"presentation-2"`).
///
/// Commands accept `Option<OutputId>` defaulting to `One`, so call sites that
/// predate the dual-output work keep targeting the first output unchanged.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum OutputId {
    #[default]
    One,
    Two,
}

impl OutputId {
    /// All outputs, in stable order. Used to build the per-output state maps.
    pub const ALL: [OutputId; 2] = [OutputId::One, OutputId::Two];

    /// The WebviewWindow label that hosts this output.
    pub fn window_label(self) -> &'static str {
        match self {
            OutputId::One => "presentation",
            OutputId::Two => "presentation-2",
        }
    }

    /// Inverse of [`window_label`]: map a window label back to its output, if it
    /// is a presentation window. Non-presentation labels return `None`.
    pub fn from_window_label(label: &str) -> Option<OutputId> {
        match label {
            "presentation" => Some(OutputId::One),
            "presentation-2" => Some(OutputId::Two),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serde_round_trips_camel_case() {
        assert_eq!(serde_json::to_string(&OutputId::One).unwrap(), "\"one\"");
        assert_eq!(serde_json::to_string(&OutputId::Two).unwrap(), "\"two\"");
        assert_eq!(
            serde_json::from_str::<OutputId>("\"one\"").unwrap(),
            OutputId::One
        );
        assert_eq!(
            serde_json::from_str::<OutputId>("\"two\"").unwrap(),
            OutputId::Two
        );
    }

    #[test]
    fn default_is_first_output() {
        assert_eq!(OutputId::default(), OutputId::One);
    }

    #[test]
    fn label_round_trips_for_both_outputs() {
        for id in OutputId::ALL {
            assert_eq!(OutputId::from_window_label(id.window_label()), Some(id));
        }
        assert_eq!(OutputId::One.window_label(), "presentation");
        assert_eq!(OutputId::Two.window_label(), "presentation-2");
    }

    #[test]
    fn non_presentation_label_is_none() {
        assert_eq!(OutputId::from_window_label("operator"), None);
        assert_eq!(OutputId::from_window_label("presentation-3"), None);
        assert_eq!(OutputId::from_window_label(""), None);
    }
}
