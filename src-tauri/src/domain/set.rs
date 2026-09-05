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

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum WebViewMode {
    Iframe,
    Mjpeg,
    /// RTSP camera stream, bridged to WebRTC by the MediaMTX proxy.
    Rtsp,
    /// Legacy: parse-only, never offered, never rendered. Kept as a variant
    /// (rather than deleted) so a `v1.3.0` item using this mode deserializes
    /// into an explicit unsupported state instead of failing to load.
    Rtmp,
    /// Legacy: parse-only, never offered, never rendered. See `Rtmp`.
    Srt,
    /// Legacy: parse-only, never offered, never rendered. See `Rtmp`.
    Multicast,
}

impl WebViewMode {
    /// True only for the modes the operator can still pick or that still
    /// render — the legacy modes remain parseable but are otherwise inert.
    pub fn is_supported(self) -> bool {
        matches!(self, Self::Iframe | Self::Mjpeg | Self::Rtsp)
    }
}

/// RTSP lower-transport, matching MediaMTX's `rtspTransport` path option.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RtspTransport {
    Automatic,
    Udp,
    Tcp,
}

/// Visual crop for iframe mode — scales/shifts the iframe so a region (e.g. a
/// camera page's `<video>`) fills the screen. Stored verbatim and round-tripped
/// to the frontend, which owns the transform math.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WebViewCrop {
    pub zoom: f64,
    pub offset_x: f64,
    pub offset_y: f64,
}

/// A saved stream configuration a camera item can switch between without
/// losing its other settings. `mode` stays item-level on `WebViewConfig` —
/// a profile only carries the connection details for that mode.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StreamProfile {
    pub id: String,
    pub label: String,
    pub url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rtsp_transport: Option<RtspTransport>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WebViewConfig {
    pub mode: WebViewMode,
    pub url: String,
    pub basic_auth_user: Option<String>,
    pub basic_auth_pass: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub crop: Option<WebViewCrop>,
    /// RTSP lower-transport (rtsp mode reuses `url` for the rtsp:// address).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rtsp_transport: Option<RtspTransport>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub profiles: Vec<StreamProfile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_profile_id: Option<String>,
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
                name: None,
                message: Some("Serviço em breve".into()),
                end_behavior: CountdownEndBehavior::HoldZero,
                background_media_id: None,
                position: Default::default(),
                scheduled_start: None,
                message_scale: 100,
                digits_scale: 100,
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
                crop: None,
                rtsp_transport: None,
                profiles: Vec::new(),
                active_profile_id: None,
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

    #[test]
    fn legacy_webview_config_json_without_profiles_deserializes_with_defaults() {
        let legacy_json = r#"{
            "mode": "mjpeg",
            "url": "http://192.168.1.10/stream",
            "basicAuthUser": null,
            "basicAuthPass": null
        }"#;
        let config: WebViewConfig = serde_json::from_str(legacy_json).unwrap();
        assert_eq!(config.profiles, Vec::new());
        assert_eq!(config.active_profile_id, None);
    }

    #[test]
    fn stream_profile_round_trips_and_omits_none_rtsp_transport() {
        let profile = StreamProfile {
            id: "profile1".into(),
            label: "Main Cam".into(),
            url: "rtsp://192.168.1.20/stream".into(),
            rtsp_transport: Some(RtspTransport::Tcp),
        };
        let json = serde_json::to_string(&profile).unwrap();
        assert!(json.contains("\"rtspTransport\":\"tcp\""), "{json}");
        let back: StreamProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(back, profile);

        let profile_no_transport = StreamProfile {
            id: "profile2".into(),
            label: "Backup Cam".into(),
            url: "http://192.168.1.21/stream".into(),
            rtsp_transport: None,
        };
        let json_no_transport = serde_json::to_string(&profile_no_transport).unwrap();
        assert!(
            !json_no_transport.contains("rtspTransport"),
            "{json_no_transport}"
        );
    }

    #[test]
    fn webview_config_with_empty_profiles_omits_profiles_key() {
        let config = WebViewConfig {
            mode: WebViewMode::Mjpeg,
            url: "http://192.168.1.10/stream".into(),
            basic_auth_user: None,
            basic_auth_pass: None,
            crop: None,
            rtsp_transport: None,
            profiles: Vec::new(),
            active_profile_id: None,
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(!json.contains("\"profiles\""), "{json}");
        assert!(!json.contains("\"activeProfileId\""), "{json}");
    }

    /// A `v1.3.0` blob for a mode/config we no longer offer must still
    /// deserialize (unknown keys ignored, no `deny_unknown_fields`), landing
    /// on the matching legacy variant in an explicitly unsupported state.
    #[test]
    fn v1_3_0_srt_blob_deserializes_to_unsupported_legacy_variant() {
        let legacy_json = r#"{
            "mode": "srt",
            "url": "",
            "basicAuthUser": null,
            "basicAuthPass": null,
            "srtConfig": {
                "host": "192.168.1.30",
                "port": 9000,
                "mode": "caller",
                "streamId": "cam1",
                "encrypted": true,
                "passphrase": "secret",
                "latencyMs": 200,
                "overheadBandwidth": 25
            }
        }"#;
        let config: WebViewConfig = serde_json::from_str(legacy_json).unwrap();
        assert_eq!(config.mode, WebViewMode::Srt);
        assert!(!config.mode.is_supported());
    }

    #[test]
    fn v1_3_0_multicast_blob_deserializes_to_unsupported_legacy_variant() {
        let legacy_json = r#"{
            "mode": "multicast",
            "url": "",
            "basicAuthUser": null,
            "basicAuthPass": null,
            "multicastConfig": {
                "ip": "239.1.1.1",
                "port": 5000
            }
        }"#;
        let config: WebViewConfig = serde_json::from_str(legacy_json).unwrap();
        assert_eq!(config.mode, WebViewMode::Multicast);
        assert!(!config.mode.is_supported());
    }

    #[test]
    fn v1_3_0_rtmp_blob_deserializes_to_unsupported_legacy_variant() {
        let legacy_json = r#"{
            "mode": "rtmp",
            "url": "rtmp://192.168.1.40/live",
            "basicAuthUser": null,
            "basicAuthPass": null
        }"#;
        let config: WebViewConfig = serde_json::from_str(legacy_json).unwrap();
        assert_eq!(config.mode, WebViewMode::Rtmp);
        assert!(!config.mode.is_supported());
    }

    #[test]
    fn rtsp_config_with_profiles_round_trips_byte_for_byte() {
        let config = WebViewConfig {
            mode: WebViewMode::Rtsp,
            url: "rtsp://192.168.1.20/stream".into(),
            basic_auth_user: None,
            basic_auth_pass: None,
            crop: None,
            rtsp_transport: Some(RtspTransport::Tcp),
            profiles: vec![
                StreamProfile {
                    id: "profile1".into(),
                    label: "Main Cam".into(),
                    url: "rtsp://192.168.1.20/stream".into(),
                    rtsp_transport: Some(RtspTransport::Tcp),
                },
                StreamProfile {
                    id: "profile2".into(),
                    label: "Backup Cam".into(),
                    url: "rtsp://192.168.1.21/stream".into(),
                    rtsp_transport: None,
                },
            ],
            active_profile_id: Some("profile1".into()),
        };
        let json = serde_json::to_string(&config).unwrap();
        let back: WebViewConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(back, config);
        let json_again = serde_json::to_string(&back).unwrap();
        assert_eq!(json_again, json, "expected byte-for-byte round trip");
    }

    #[test]
    fn is_supported_truth_table() {
        assert!(WebViewMode::Iframe.is_supported());
        assert!(WebViewMode::Mjpeg.is_supported());
        assert!(WebViewMode::Rtsp.is_supported());
        assert!(!WebViewMode::Rtmp.is_supported());
        assert!(!WebViewMode::Srt.is_supported());
        assert!(!WebViewMode::Multicast.is_supported());
    }
}
