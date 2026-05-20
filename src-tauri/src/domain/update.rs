use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub notes: Option<String>,
    pub pub_date: Option<String>,
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
}
