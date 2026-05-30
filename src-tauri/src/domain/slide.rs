use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Slide {
    pub lines: Vec<String>,
    pub section_label: String,
    pub section_id: String,
}

impl Slide {
    pub fn pseudo(label: &str) -> Self {
        Self {
            lines: vec![],
            section_label: label.to_string(),
            section_id: String::new(),
        }
    }

    /// Creates a pseudo-slide for a SlideShow set item.
    /// `section_label = "slide_show"`, `section_id = index.to_string()`.
    /// The presentation renderer reads `section_id` as the zero-based slide index.
    pub fn pseudo_slideshow(index: usize) -> Self {
        Self {
            lines: vec![],
            section_label: "slide_show".to_string(),
            section_id: index.to_string(),
        }
    }
}

/// How a section's `repeat_count` is reflected in the generated slides.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub enum RepeatMode {
    /// Duplicate the section's slides `repeat_count` times.
    #[default]
    Duplicate,
    /// Render the slides once and append an `(Nx)` marker below the lyrics
    /// on the last slide of the section.
    Annotate,
}

impl RepeatMode {
    /// Parse the nullable DB/payload string. Unknown/None → `Duplicate`.
    pub fn from_opt(s: Option<&str>) -> Self {
        match s {
            Some("annotate") => RepeatMode::Annotate,
            _ => RepeatMode::Duplicate,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SlideConfig {
    pub max_lines: usize,
    /// Retained for serialization/type compatibility. No longer used for
    /// wrapping — lines are kept verbatim so slides mirror the strophe edit box.
    pub max_chars_per_line: usize,
}

impl Default for SlideConfig {
    fn default() -> Self {
        Self {
            max_lines: 4,
            max_chars_per_line: 60,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slide_round_trips_with_camel_case() {
        let slide = Slide {
            lines: vec!["Amazing grace".into(), "How sweet the sound".into()],
            section_label: "Verse 1".into(),
            section_id: "s1".into(),
        };
        let json = serde_json::to_string(&slide).unwrap();
        assert!(json.contains("\"sectionLabel\""), "expected camelCase: {json}");
        assert!(json.contains("\"sectionId\""), "expected camelCase: {json}");
        let back: Slide = serde_json::from_str(&json).unwrap();
        assert_eq!(back, slide);
    }

    #[test]
    fn slide_config_default_values() {
        let config = SlideConfig::default();
        assert_eq!(config.max_lines, 4);
        assert_eq!(config.max_chars_per_line, 60);
    }

    #[test]
    fn slide_pseudo_slideshow_encodes_index() {
        let s = Slide::pseudo_slideshow(3);
        assert_eq!(s.section_label, "slide_show");
        assert_eq!(s.section_id, "3");
        assert!(s.lines.is_empty());
    }

    #[test]
    fn repeat_mode_from_opt_parses_known_and_defaults() {
        assert_eq!(RepeatMode::from_opt(Some("annotate")), RepeatMode::Annotate);
        assert_eq!(RepeatMode::from_opt(Some("duplicate")), RepeatMode::Duplicate);
        assert_eq!(RepeatMode::from_opt(None), RepeatMode::Duplicate);
        assert_eq!(RepeatMode::from_opt(Some("bogus")), RepeatMode::Duplicate);
        assert_eq!(RepeatMode::default(), RepeatMode::Duplicate);
    }

    #[test]
    fn slide_config_round_trips_with_camel_case() {
        let config = SlideConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"maxLines\""), "expected camelCase: {json}");
        assert!(json.contains("\"maxCharsPerLine\""), "expected camelCase: {json}");
        let back: SlideConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(back, config);
    }
}
