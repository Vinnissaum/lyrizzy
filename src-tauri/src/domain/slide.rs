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
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SlideConfig {
    pub max_lines: usize,
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
    fn slide_config_round_trips_with_camel_case() {
        let config = SlideConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"maxLines\""), "expected camelCase: {json}");
        assert!(json.contains("\"maxCharsPerLine\""), "expected camelCase: {json}");
        let back: SlideConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(back, config);
    }
}
