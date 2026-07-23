use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub notes: Option<String>,
    pub pub_date: Option<String>,
}

/// Every outcome `check_for_updates` can report on success. Failures never
/// construct this type — they return `Err(ErrorPayload)` instead.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum UpdateCheckResult {
    UpdateAvailable { info: UpdateInfo },
    UpToDate,
    Skipped,
}

/// Throttled download progress emitted as the `update_progress` event.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgress {
    pub downloaded: u64,
    pub total: Option<u64>,
}

/// A completed check stamps `last_update_check`; a skipped one does not.
/// Failures never reach this fn — they return early via `?`.
pub fn persists_last_check(r: &UpdateCheckResult) -> bool {
    !matches!(r, UpdateCheckResult::Skipped)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn update_info_round_trips_with_camel_case() {
        let info = UpdateInfo {
            version: "1.1.0".into(),
            current_version: "1.0.0".into(),
            notes: Some("Bug fixes".into()),
            pub_date: Some("2026-06-01T00:00:00Z".into()),
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"currentVersion\""), "expected camelCase: {json}");
        assert!(json.contains("\"pubDate\""), "expected camelCase: {json}");
        let back: UpdateInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(back, info);
    }

    #[test]
    fn update_available_serializes_with_nested_info_not_flattened() {
        let result = UpdateCheckResult::UpdateAvailable {
            info: UpdateInfo {
                version: "1.1.0".into(),
                current_version: "1.0.0".into(),
                notes: None,
                pub_date: None,
            },
        };
        let json: serde_json::Value = serde_json::to_value(&result).unwrap();
        assert_eq!(json["status"], "updateAvailable");
        assert!(json["info"].is_object(), "info must be nested, not flattened: {json}");
        assert_eq!(json["info"]["version"], "1.1.0");
        // Flattening would put "version" at the top level alongside "status".
        assert!(json.get("version").is_none(), "info fields leaked to top level: {json}");
    }

    #[test]
    fn up_to_date_serializes_to_status_only() {
        let json = serde_json::to_value(UpdateCheckResult::UpToDate).unwrap();
        assert_eq!(json, serde_json::json!({ "status": "upToDate" }));
    }

    #[test]
    fn skipped_serializes_to_status_only() {
        let json = serde_json::to_value(UpdateCheckResult::Skipped).unwrap();
        assert_eq!(json, serde_json::json!({ "status": "skipped" }));
    }

    #[test]
    fn update_progress_serializes_camel_case_with_total() {
        let progress = UpdateProgress { downloaded: 512, total: Some(1024) };
        let json = serde_json::to_value(&progress).unwrap();
        assert_eq!(json, serde_json::json!({ "downloaded": 512, "total": 1024 }));
    }

    #[test]
    fn update_progress_total_none_serializes_null() {
        let progress = UpdateProgress { downloaded: 0, total: None };
        let json = serde_json::to_value(&progress).unwrap();
        assert_eq!(json["total"], serde_json::Value::Null);
    }

    #[test]
    fn persists_last_check_true_for_update_available() {
        let result = UpdateCheckResult::UpdateAvailable {
            info: UpdateInfo {
                version: "1.1.0".into(),
                current_version: "1.0.0".into(),
                notes: None,
                pub_date: None,
            },
        };
        assert!(persists_last_check(&result));
    }

    #[test]
    fn persists_last_check_true_for_up_to_date() {
        assert!(persists_last_check(&UpdateCheckResult::UpToDate));
    }

    #[test]
    fn persists_last_check_false_for_skipped() {
        assert!(!persists_last_check(&UpdateCheckResult::Skipped));
    }
}
