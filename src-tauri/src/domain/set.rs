use serde::{Deserialize, Serialize};

use super::countdown::CountdownConfig;
use super::media::{MediaItemOptions, MediaKind};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SetItemType {
    Song,
    Media,
    Countdown,
    WebView,
    Blank,
    SlideShow,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum WebViewMode {
    Iframe,
    Mjpeg,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WebViewConfig {
    pub mode: WebViewMode,
    pub url: String,
    pub basic_auth_user: Option<String>,
    pub basic_auth_pass: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SetItem {
    pub id: String,
    pub set_id: String,
    pub item_type: SetItemType,
    pub song_id: Option<String>,
    pub media_id: Option<String>,
    pub media_kind: Option<MediaKind>,
    pub media_options: Option<MediaItemOptions>,
    pub countdown_config: Option<CountdownConfig>,
    pub webview_config: Option<WebViewConfig>,
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
    use crate::domain::countdown::CountdownEndBehavior;

    #[test]
    fn set_item_type_serializes_snake_case() {
        assert_eq!(
            serde_json::to_string(&SetItemType::Song).unwrap(),
            "\"song\""
        );
        assert_eq!(
            serde_json::to_string(&SetItemType::Media).unwrap(),
            "\"media\""
        );
        assert_eq!(
            serde_json::to_string(&SetItemType::Countdown).unwrap(),
            "\"countdown\""
        );
        assert_eq!(
            serde_json::to_string(&SetItemType::WebView).unwrap(),
            "\"web_view\""
        );
        assert_eq!(
            serde_json::to_string(&SetItemType::Blank).unwrap(),
            "\"blank\""
        );
        assert_eq!(
            serde_json::to_string(&SetItemType::SlideShow).unwrap(),
            "\"slide_show\""
        );
    }

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
                media_id: None,
                media_kind: None,
                media_options: None,
                countdown_config: None,
                webview_config: None,
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

    #[test]
    fn set_item_with_all_variants_round_trips() {
        let countdown_item = SetItem {
            id: "item-cd".into(),
            set_id: "set1".into(),
            item_type: SetItemType::Countdown,
            song_id: None,
            media_id: None,
            media_kind: None,
            media_options: None,
            countdown_config: Some(CountdownConfig {
                target: crate::domain::countdown::CountdownTarget::Duration { duration_ms: 600_000 },
                message: Some("Serviço em breve".into()),
                end_behavior: CountdownEndBehavior::HoldZero,
                background_media_id: None,
                position: Default::default(),
            }),
            webview_config: None,
            sort_order: 0,
            notes: None,
        };
        let json = serde_json::to_string(&countdown_item).unwrap();
        assert!(json.contains("\"countdown\""), "{json}");
        assert!(json.contains("\"countdownConfig\""), "{json}");
        let back: SetItem = serde_json::from_str(&json).unwrap();
        assert_eq!(back, countdown_item);
    }

    #[test]
    fn webview_config_round_trips() {
        let item = SetItem {
            id: "item-wv".into(),
            set_id: "set1".into(),
            item_type: SetItemType::WebView,
            song_id: None,
            media_id: None,
            media_kind: None,
            media_options: None,
            countdown_config: None,
            webview_config: Some(WebViewConfig {
                mode: WebViewMode::Mjpeg,
                url: "http://192.168.1.10/stream".into(),
                basic_auth_user: Some("admin".into()),
                basic_auth_pass: Some("secret".into()),
            }),
            sort_order: 0,
            notes: None,
        };
        let json = serde_json::to_string(&item).unwrap();
        assert!(json.contains("\"web_view\""), "{json}");
        assert!(json.contains("\"webviewConfig\""), "{json}");
        assert!(json.contains("\"mjpeg\""), "{json}");
        let back: SetItem = serde_json::from_str(&json).unwrap();
        assert_eq!(back, item);
    }
}
