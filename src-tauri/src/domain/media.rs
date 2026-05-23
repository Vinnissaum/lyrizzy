use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MediaKind {
    Image,
    Video,
    Presentation,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Media {
    pub id: String,
    pub file_name: String,
    pub display_name: String,
    pub kind: MediaKind,
    pub mime_type: String,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub duration_ms: Option<i64>,
    pub thumbnail_file: Option<String>,
    pub byte_size: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
    /// Number of converted slide images; set only for `MediaKind::Presentation`.
    pub slide_count: Option<i64>,
}

/// Per-set-item playback overrides for media items.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaItemOptions {
    /// Whether the video loops. Serde-renamed so the wire field is "loop".
    #[serde(rename = "loop")]
    pub loop_: bool,
    pub mute: bool,
    pub auto_advance_on_end: bool,
}

impl Default for MediaItemOptions {
    fn default() -> Self {
        Self {
            loop_: false,
            mute: false,
            auto_advance_on_end: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn media_kind_serializes_snake_case() {
        assert_eq!(
            serde_json::to_string(&MediaKind::Image).unwrap(),
            "\"image\""
        );
        assert_eq!(
            serde_json::to_string(&MediaKind::Video).unwrap(),
            "\"video\""
        );
        assert_eq!(
            serde_json::to_string(&MediaKind::Presentation).unwrap(),
            "\"presentation\""
        );
    }

    #[test]
    fn media_item_options_loop_field_renamed() {
        let opts = MediaItemOptions::default();
        let json = serde_json::to_string(&opts).unwrap();
        assert!(json.contains("\"loop\":false"), "expected 'loop' key: {json}");
        assert!(json.contains("\"autoAdvanceOnEnd\":true"), "expected camelCase: {json}");
        let back: MediaItemOptions = serde_json::from_str(&json).unwrap();
        assert_eq!(back, opts);
    }

    #[test]
    fn media_round_trips_camel_case() {
        let media = Media {
            id: "uuid-1".into(),
            file_name: "background.mp4".into(),
            display_name: "Fundo Culto".into(),
            kind: MediaKind::Video,
            mime_type: "video/mp4".into(),
            width: Some(1920),
            height: Some(1080),
            duration_ms: Some(30_000),
            thumbnail_file: Some("uuid-1.thumb.jpg".into()),
            byte_size: 1_048_576,
            created_at: 1_000_000,
            updated_at: 1_000_000,
            deleted_at: None,
            slide_count: None,
        };
        let json = serde_json::to_string(&media).unwrap();
        assert!(json.contains("\"fileName\""), "expected camelCase: {json}");
        assert!(json.contains("\"displayName\""), "expected camelCase: {json}");
        assert!(json.contains("\"durationMs\""), "expected camelCase: {json}");
        assert!(json.contains("\"thumbnailFile\""), "expected camelCase: {json}");
        assert!(json.contains("\"byteSize\""), "expected camelCase: {json}");
        assert!(json.contains("\"createdAt\""), "expected camelCase: {json}");
        assert!(json.contains("\"updatedAt\""), "expected camelCase: {json}");
        assert!(json.contains("\"slideCount\""), "expected slideCount field: {json}");
        let back: Media = serde_json::from_str(&json).unwrap();
        assert_eq!(back, media);
    }

    #[test]
    fn media_presentation_kind_round_trips() {
        let media = Media {
            id: "uuid-pptx".into(),
            file_name: "uuid-pptx.pptx".into(),
            display_name: "Slides Culto.pptx".into(),
            kind: MediaKind::Presentation,
            mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation".into(),
            width: None,
            height: None,
            duration_ms: None,
            thumbnail_file: Some("uuid-pptx/slide_000.png".into()),
            byte_size: 512_000,
            created_at: 1_000_000,
            updated_at: 1_000_000,
            deleted_at: None,
            slide_count: Some(5),
        };
        let json = serde_json::to_string(&media).unwrap();
        assert!(json.contains("\"presentation\""), "expected presentation kind: {json}");
        assert!(json.contains("\"slideCount\":5"), "expected slideCount: {json}");
        let back: Media = serde_json::from_str(&json).unwrap();
        assert_eq!(back, media);
    }
}
