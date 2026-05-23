use serde::{Deserialize, Serialize};

use super::media::MediaKind;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Copy)]
#[serde(rename_all = "kebab-case")]
pub enum BackgroundPreset {
    PretoBranco, // bg #000000, fg #FFFFFF
    BrancoPreto, // bg #FFFFFF, fg #000000
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Copy)]
#[serde(rename_all = "snake_case")]
pub enum FontFamily {
    Sans,
    Serif,
    Mono,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Copy)]
#[serde(rename_all = "snake_case")]
pub enum FontSize {
    Sm,
    Md,
    Lg,
    Xl,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Typography {
    pub font_family: FontFamily,
    pub font_size: FontSize,
}

/// Resolved background for a slide, including whether to restart on a section boundary.
/// Used by the background resolver service (services/background.rs) and the
/// presentation renderer. Song-level backgrounds set `restart_on_section_boundary = false`;
/// section-level overrides set it to `true`.
///
/// Either `asset_url` (media mode) or `preset` (preset mode) is set; not both.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundInfo {
    // Media mode (existing) — None when mode = preset
    pub media_kind: Option<MediaKind>,
    pub asset_url: Option<String>,
    pub scrim_opacity: u8,
    pub restart_on_section_boundary: bool,
    // Preset mode — None when mode = media
    pub preset: Option<BackgroundPreset>,
    // Typography — applies to any mode; None = use default (sans, lg)
    pub typography: Option<Typography>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn background_info_round_trips_media_mode() {
        let bg = BackgroundInfo {
            media_kind: Some(MediaKind::Video),
            asset_url: Some("http://asset.localhost/media/bg.mp4".into()),
            scrim_opacity: 35,
            restart_on_section_boundary: true,
            preset: None,
            typography: None,
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

    #[test]
    fn background_info_round_trips_preset_mode() {
        let bg = BackgroundInfo {
            media_kind: None,
            asset_url: None,
            scrim_opacity: 0,
            restart_on_section_boundary: true,
            preset: Some(BackgroundPreset::PretoBranco),
            typography: Some(Typography {
                font_family: FontFamily::Serif,
                font_size: FontSize::Lg,
            }),
        };
        let json = serde_json::to_string(&bg).unwrap();
        assert!(json.contains("\"preto-branco\""), "preset kebab-case: {json}");
        assert!(json.contains("\"serif\""), "fontFamily snake_case: {json}");
        assert!(json.contains("\"lg\""), "fontSize snake_case: {json}");
        let back: BackgroundInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(back, bg);
    }

    #[test]
    fn background_preset_serializes_kebab_case() {
        assert_eq!(
            serde_json::to_string(&BackgroundPreset::PretoBranco).unwrap(),
            "\"preto-branco\""
        );
        assert_eq!(
            serde_json::to_string(&BackgroundPreset::BrancoPreto).unwrap(),
            "\"branco-preto\""
        );
    }

    #[test]
    fn font_enums_serialize_snake_case() {
        assert_eq!(serde_json::to_string(&FontFamily::Sans).unwrap(), "\"sans\"");
        assert_eq!(serde_json::to_string(&FontFamily::Serif).unwrap(), "\"serif\"");
        assert_eq!(serde_json::to_string(&FontFamily::Mono).unwrap(), "\"mono\"");
        assert_eq!(serde_json::to_string(&FontSize::Sm).unwrap(), "\"sm\"");
        assert_eq!(serde_json::to_string(&FontSize::Md).unwrap(), "\"md\"");
        assert_eq!(serde_json::to_string(&FontSize::Lg).unwrap(), "\"lg\"");
        assert_eq!(serde_json::to_string(&FontSize::Xl).unwrap(), "\"xl\"");
    }
}
