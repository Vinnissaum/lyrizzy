use serde::{Deserialize, Serialize};

use super::media::MediaKind;

/// Resolved background for a slide, including whether to restart on a section boundary.
/// Used by the background resolver service (services/background.rs) and the
/// presentation renderer. Song-level backgrounds set `restart_on_section_boundary = false`;
/// section-level overrides set it to `true`.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundInfo {
    pub media_kind: MediaKind,
    pub asset_url: String,
    pub scrim_opacity: u8,
    pub restart_on_section_boundary: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn background_info_round_trips_with_camel_case() {
        let bg = BackgroundInfo {
            media_kind: MediaKind::Video,
            asset_url: "asset://localhost/media/bg.mp4".into(),
            scrim_opacity: 35,
            restart_on_section_boundary: true,
        };
        let json = serde_json::to_string(&bg).unwrap();
        assert!(json.contains("\"mediaKind\""), "expected camelCase: {json}");
        assert!(json.contains("\"assetUrl\""), "expected camelCase: {json}");
        assert!(json.contains("\"scrimOpacity\""), "expected camelCase: {json}");
        assert!(
            json.contains("\"restartOnSectionBoundary\""),
            "expected camelCase: {json}"
        );
        let back: BackgroundInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(back, bg);
    }
}
