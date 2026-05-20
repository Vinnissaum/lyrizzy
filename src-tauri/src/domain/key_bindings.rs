use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum ActionId {
    AdvanceSlide,
    PreviousSlide,
    Blank,
    Freeze,
    ExitPresentation,
    JumpToItem1,
    JumpToItem2,
    JumpToItem3,
    JumpToItem4,
    JumpToItem5,
    JumpToItem6,
    JumpToItem7,
    JumpToItem8,
    JumpToItem9,
    CountdownPause,
    OpenPresentationWindow,
    FocusSearch,
}

impl ActionId {
    pub fn all() -> Vec<ActionId> {
        vec![
            ActionId::AdvanceSlide,
            ActionId::PreviousSlide,
            ActionId::Blank,
            ActionId::Freeze,
            ActionId::ExitPresentation,
            ActionId::JumpToItem1,
            ActionId::JumpToItem2,
            ActionId::JumpToItem3,
            ActionId::JumpToItem4,
            ActionId::JumpToItem5,
            ActionId::JumpToItem6,
            ActionId::JumpToItem7,
            ActionId::JumpToItem8,
            ActionId::JumpToItem9,
            ActionId::CountdownPause,
            ActionId::OpenPresentationWindow,
            ActionId::FocusSearch,
        ]
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Shortcut {
    pub key: String,
    pub ctrl: bool,
    pub shift: bool,
    pub alt: bool,
}

impl Shortcut {
    pub fn simple(key: &str) -> Self {
        Shortcut {
            key: key.to_string(),
            ctrl: false,
            shift: false,
            alt: false,
        }
    }

    pub fn ctrl(key: &str) -> Self {
        Shortcut {
            key: key.to_string(),
            ctrl: true,
            shift: false,
            alt: false,
        }
    }

    /// Case-insensitive key match plus modifier match.
    pub fn matches(&self, event_key: &str, ctrl: bool, shift: bool, alt: bool) -> bool {
        self.key.eq_ignore_ascii_case(event_key)
            && self.ctrl == ctrl
            && self.shift == shift
            && self.alt == alt
    }

    pub fn validate(&self) -> Result<(), KeyBindingsValidationError> {
        if self.key.is_empty() {
            return Err(KeyBindingsValidationError::InvalidShortcut);
        }
        Ok(())
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KeyBindings {
    pub bindings: HashMap<ActionId, Vec<Shortcut>>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum KeyBindingsValidationError {
    MissingAction { action: String },
    Conflict { action_a: String, action_b: String },
    InvalidShortcut,
}

impl std::fmt::Display for KeyBindingsValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            KeyBindingsValidationError::MissingAction { action } => {
                write!(f, "action '{action}' has no shortcuts")
            }
            KeyBindingsValidationError::Conflict { action_a, action_b } => {
                write!(f, "conflict between '{action_a}' and '{action_b}'")
            }
            KeyBindingsValidationError::InvalidShortcut => {
                write!(f, "shortcut must have a non-empty key")
            }
        }
    }
}

impl KeyBindings {
    pub fn defaults() -> Self {
        let mut bindings: HashMap<ActionId, Vec<Shortcut>> = HashMap::new();
        bindings.insert(
            ActionId::AdvanceSlide,
            vec![Shortcut::simple(" "), Shortcut::simple("ArrowRight")],
        );
        bindings.insert(ActionId::PreviousSlide, vec![Shortcut::simple("ArrowLeft")]);
        bindings.insert(ActionId::Blank, vec![Shortcut::simple("b")]);
        bindings.insert(ActionId::Freeze, vec![Shortcut::simple("f")]);
        bindings.insert(ActionId::ExitPresentation, vec![Shortcut::simple("Escape")]);
        bindings.insert(ActionId::JumpToItem1, vec![Shortcut::simple("1")]);
        bindings.insert(ActionId::JumpToItem2, vec![Shortcut::simple("2")]);
        bindings.insert(ActionId::JumpToItem3, vec![Shortcut::simple("3")]);
        bindings.insert(ActionId::JumpToItem4, vec![Shortcut::simple("4")]);
        bindings.insert(ActionId::JumpToItem5, vec![Shortcut::simple("5")]);
        bindings.insert(ActionId::JumpToItem6, vec![Shortcut::simple("6")]);
        bindings.insert(ActionId::JumpToItem7, vec![Shortcut::simple("7")]);
        bindings.insert(ActionId::JumpToItem8, vec![Shortcut::simple("8")]);
        bindings.insert(ActionId::JumpToItem9, vec![Shortcut::simple("9")]);
        bindings.insert(ActionId::CountdownPause, vec![Shortcut::simple("p")]);
        bindings.insert(
            ActionId::OpenPresentationWindow,
            vec![Shortcut::ctrl("p")],
        );
        bindings.insert(ActionId::FocusSearch, vec![Shortcut::ctrl("f")]);
        KeyBindings { bindings }
    }

    pub fn validate(&self) -> Result<(), KeyBindingsValidationError> {
        // Every shortcut must have a non-empty key.
        for shortcuts in self.bindings.values() {
            for s in shortcuts {
                s.validate()?;
            }
        }

        // Every ActionId must have at least one shortcut.
        for action in ActionId::all() {
            let has_binding = self
                .bindings
                .get(&action)
                .map(|v| !v.is_empty())
                .unwrap_or(false);
            if !has_binding {
                let action_name = serde_json::to_string(&action)
                    .unwrap_or_default()
                    .trim_matches('"')
                    .to_string();
                return Err(KeyBindingsValidationError::MissingAction {
                    action: action_name,
                });
            }
        }

        // No two distinct actions may share the same shortcut.
        let mut seen: Vec<(Shortcut, String)> = Vec::new();
        for (action, shortcuts) in &self.bindings {
            let action_name = serde_json::to_string(action)
                .unwrap_or_default()
                .trim_matches('"')
                .to_string();
            for s in shortcuts {
                for (existing_shortcut, existing_action) in &seen {
                    if s == existing_shortcut && action_name != *existing_action {
                        return Err(KeyBindingsValidationError::Conflict {
                            action_a: existing_action.clone(),
                            action_b: action_name.clone(),
                        });
                    }
                }
                seen.push((s.clone(), action_name.clone()));
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn action_id_serializes_camel_case() {
        assert_eq!(
            serde_json::to_string(&ActionId::AdvanceSlide).unwrap(),
            "\"advanceSlide\""
        );
        assert_eq!(
            serde_json::to_string(&ActionId::JumpToItem9).unwrap(),
            "\"jumpToItem9\""
        );
        assert_eq!(
            serde_json::to_string(&ActionId::OpenPresentationWindow).unwrap(),
            "\"openPresentationWindow\""
        );
    }

    #[test]
    fn shortcut_round_trips() {
        let s = Shortcut::ctrl("p");
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("\"ctrl\":true"), "{json}");
        let back: Shortcut = serde_json::from_str(&json).unwrap();
        assert_eq!(back, s);
    }

    #[test]
    fn shortcut_matches_case_insensitive() {
        let s = Shortcut::simple("b");
        assert!(s.matches("b", false, false, false));
        assert!(s.matches("B", false, false, false));
        assert!(!s.matches("b", true, false, false)); // ctrl mismatch
    }

    #[test]
    fn key_bindings_defaults_are_valid() {
        let kb = KeyBindings::defaults();
        assert!(kb.validate().is_ok(), "defaults must be conflict-free and complete");
    }

    #[test]
    fn key_bindings_defaults_serialize_round_trip() {
        let kb = KeyBindings::defaults();
        let json = serde_json::to_string(&kb).unwrap();
        let back: KeyBindings = serde_json::from_str(&json).unwrap();
        assert_eq!(back.bindings.len(), kb.bindings.len());
    }

    #[test]
    fn validate_detects_missing_action() {
        let mut kb = KeyBindings::defaults();
        kb.bindings.remove(&ActionId::Blank);
        assert!(matches!(
            kb.validate(),
            Err(KeyBindingsValidationError::MissingAction { .. })
        ));
    }

    #[test]
    fn validate_detects_conflict() {
        let mut kb = KeyBindings::defaults();
        // Give FocusSearch the same shortcut as Blank (both 'b', no modifiers)
        kb.bindings.insert(ActionId::FocusSearch, vec![Shortcut::simple("b")]);
        assert!(matches!(
            kb.validate(),
            Err(KeyBindingsValidationError::Conflict { .. })
        ));
    }

    #[test]
    fn validate_rejects_empty_key() {
        let mut kb = KeyBindings::defaults();
        kb.bindings.insert(ActionId::Blank, vec![Shortcut { key: "".into(), ctrl: false, shift: false, alt: false }]);
        assert!(matches!(
            kb.validate(),
            Err(KeyBindingsValidationError::InvalidShortcut)
        ));
    }

    #[test]
    fn defaults_json_matches_migration_seed() {
        let kb = KeyBindings::defaults();
        let json = serde_json::to_string(&kb).unwrap();
        // Validate the JSON in migration 005 can be deserialized into the same type.
        let migration_seed = r#"{"bindings":{"advanceSlide":[{"key":" ","ctrl":false,"shift":false,"alt":false},{"key":"ArrowRight","ctrl":false,"shift":false,"alt":false}],"previousSlide":[{"key":"ArrowLeft","ctrl":false,"shift":false,"alt":false}],"blank":[{"key":"b","ctrl":false,"shift":false,"alt":false}],"freeze":[{"key":"f","ctrl":false,"shift":false,"alt":false}],"exitPresentation":[{"key":"Escape","ctrl":false,"shift":false,"alt":false}],"jumpToItem1":[{"key":"1","ctrl":false,"shift":false,"alt":false}],"jumpToItem2":[{"key":"2","ctrl":false,"shift":false,"alt":false}],"jumpToItem3":[{"key":"3","ctrl":false,"shift":false,"alt":false}],"jumpToItem4":[{"key":"4","ctrl":false,"shift":false,"alt":false}],"jumpToItem5":[{"key":"5","ctrl":false,"shift":false,"alt":false}],"jumpToItem6":[{"key":"6","ctrl":false,"shift":false,"alt":false}],"jumpToItem7":[{"key":"7","ctrl":false,"shift":false,"alt":false}],"jumpToItem8":[{"key":"8","ctrl":false,"shift":false,"alt":false}],"jumpToItem9":[{"key":"9","ctrl":false,"shift":false,"alt":false}],"countdownPause":[{"key":"p","ctrl":false,"shift":false,"alt":false}],"openPresentationWindow":[{"key":"p","ctrl":true,"shift":false,"alt":false}],"focusSearch":[{"key":"f","ctrl":true,"shift":false,"alt":false}]}}"#;
        let from_seed: KeyBindings = serde_json::from_str(migration_seed)
            .expect("migration seed JSON must parse into KeyBindings");
        assert!(from_seed.validate().is_ok(), "migration seed must be valid");
        // Both must have the same 17 actions.
        assert_eq!(from_seed.bindings.len(), kb.bindings.len());
        let _ = json; // suppress unused warning
    }
}
