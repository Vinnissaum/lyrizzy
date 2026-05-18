use serde::{Deserialize, Serialize};

// TODO Phase 2: add Media, Countdown, WebView variants
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SetItemType {
    Song,
    Blank,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SetItem {
    pub id: String,
    pub set_id: String,
    pub item_type: SetItemType,
    pub song_id: Option<String>,
    pub sort_order: i32,
    pub notes: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ServiceSet {
    pub id: String,
    pub name: String,
    pub service_date: Option<String>,
    pub notes: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub items: Vec<SetItem>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn service_set_round_trips_with_camel_case() {
        let set = ServiceSet {
            id: "set1".into(),
            name: "Culto — 18/05/2026".into(),
            service_date: Some("2026-05-18".into()),
            notes: None,
            created_at: 1000,
            updated_at: 2000,
            items: vec![SetItem {
                id: "item1".into(),
                set_id: "set1".into(),
                item_type: SetItemType::Song,
                song_id: Some("song1".into()),
                sort_order: 0,
                notes: None,
            }],
        };
        let json = serde_json::to_string(&set).unwrap();
        assert!(json.contains("\"serviceDate\""), "expected camelCase: {json}");
        assert!(json.contains("\"createdAt\""), "expected camelCase: {json}");
        assert!(json.contains("\"itemType\":\"song\""), "expected snake_case enum: {json}");
        assert!(json.contains("\"songId\""), "expected camelCase: {json}");
        let back: ServiceSet = serde_json::from_str(&json).unwrap();
        assert_eq!(back, set);
    }
}
