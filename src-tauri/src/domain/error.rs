use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorPayload {
    pub code: String,
    pub params: HashMap<String, String>,
}

impl ErrorPayload {
    pub fn new(code: impl Into<String>) -> Self {
        ErrorPayload {
            code: code.into(),
            params: HashMap::new(),
        }
    }

    pub fn with_param(mut self, key: impl Into<String>, val: impl Into<String>) -> Self {
        self.params.insert(key.into(), val.into());
        self
    }
}

impl From<String> for ErrorPayload {
    fn from(s: String) -> Self {
        let mut params = HashMap::new();
        params.insert("message".to_string(), s);
        ErrorPayload {
            code: "legacy".to_string(),
            params,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn string_wraps_as_legacy() {
        let payload: ErrorPayload = "erro de teste".to_string().into();
        assert_eq!(payload.code, "legacy");
        assert_eq!(payload.params.get("message").map(String::as_str), Some("erro de teste"));
    }

    #[test]
    fn round_trips_through_serde() {
        let payload: ErrorPayload = "erro".to_string().into();
        let json = serde_json::to_string(&payload).unwrap();
        let deserialized: ErrorPayload = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.code, "legacy");
        assert_eq!(deserialized.params.get("message").map(String::as_str), Some("erro"));
    }

    #[test]
    fn builder_produces_correct_fields() {
        let err = ErrorPayload::new("song.not_found").with_param("id", "abc-123");
        let json = serde_json::to_string(&err).unwrap();
        let back: ErrorPayload = serde_json::from_str(&json).unwrap();
        assert_eq!(back.code, "song.not_found");
        assert_eq!(back.params.get("id").map(String::as_str), Some("abc-123"));
    }
}
