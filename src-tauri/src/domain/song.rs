use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SectionType {
    Verse,
    Chorus,
    Bridge,
    PreChorus,
    Outro,
    Interlude,
    Tag,
}

/// How lyric lines are cased when slides are generated.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub enum TextCasing {
    #[default]
    Normal,
    Upper,
    Lower,
    Title,
}

impl TextCasing {
    /// Parse the nullable DB/payload string. Unknown/None → `Normal`.
    pub fn from_opt(s: Option<&str>) -> Self {
        match s {
            Some("upper") => TextCasing::Upper,
            Some("lower") => TextCasing::Lower,
            Some("title") => TextCasing::Title,
            _ => TextCasing::Normal,
        }
    }

    /// Apply the casing transform to a single display line.
    pub fn apply(self, line: &str) -> String {
        match self {
            TextCasing::Normal => line.to_string(),
            TextCasing::Upper => line.to_uppercase(),
            TextCasing::Lower => line.to_lowercase(),
            TextCasing::Title => title_case(line),
        }
    }
}

/// Capitalize the first character of each whitespace-separated word and
/// lowercase the rest. Whitespace runs are preserved.
fn title_case(line: &str) -> String {
    line.split_inclusive(char::is_whitespace)
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                Some(first) => {
                    first.to_uppercase().collect::<String>() + &chars.as_str().to_lowercase()
                }
                None => String::new(),
            }
        })
        .collect()
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SongSection {
    pub id: String,
    pub song_id: String,
    pub label: String,
    #[serde(rename = "type")]
    pub section_type: SectionType,
    pub body: String,
    pub sort_order: i32,
    pub repeat_count: i32,
    pub notes: Option<String>,
    pub background_id: Option<String>,
    pub background_mode: Option<String>,
    pub background_preset: Option<String>,
    pub font_family: Option<String>,
    pub font_size: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Song {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub author: Option<String>,
    pub copyright: Option<String>,
    pub ccli_number: Option<String>,
    pub key_signature: Option<String>,
    pub language: String,
    pub notes: Option<String>,
    pub background_id: Option<String>,
    pub scrim_opacity: i32,
    pub slide_config: Option<String>,
    pub source: Option<String>,
    pub background_mode: Option<String>,
    pub background_preset: Option<String>,
    pub font_family: Option<String>,
    pub font_size: Option<String>,
    pub text_casing: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
    pub sections: Vec<SongSection>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn song_section_round_trips_with_camel_case() {
        let section = SongSection {
            id: "s1".into(),
            song_id: "song1".into(),
            label: "Verse 1".into(),
            section_type: SectionType::Verse,
            body: "Amazing grace".into(),
            sort_order: 0,
            repeat_count: 1,
            notes: Some("Presenter note".into()),
            background_id: Some("bg-id".into()),
            background_mode: Some("preset".into()),
            background_preset: Some("preto-branco".into()),
            font_family: Some("serif".into()),
            font_size: Some("lg".into()),
        };
        let json = serde_json::to_string(&section).unwrap();
        assert!(json.contains("\"songId\""), "expected camelCase: {json}");
        assert!(json.contains("\"sortOrder\""), "expected camelCase: {json}");
        assert!(json.contains("\"repeatCount\""), "expected camelCase: {json}");
        assert!(json.contains("\"type\":\"verse\""), "expected snake_case enum: {json}");
        assert!(json.contains("\"backgroundId\""), "expected camelCase: {json}");
        assert!(json.contains("\"backgroundMode\""), "expected camelCase: {json}");
        assert!(json.contains("\"backgroundPreset\""), "expected camelCase: {json}");
        assert!(json.contains("\"fontFamily\""), "expected camelCase: {json}");
        assert!(json.contains("\"fontSize\""), "expected camelCase: {json}");
        let back: SongSection = serde_json::from_str(&json).unwrap();
        assert_eq!(back, section);
    }

    #[test]
    fn song_round_trips_with_camel_case() {
        let song = Song {
            id: "id1".into(),
            title: "Amazing Grace".into(),
            artist: Some("John Newton".into()),
            author: Some("John Newton".into()),
            copyright: Some("Public Domain".into()),
            ccli_number: None,
            key_signature: None,
            language: "pt".into(),
            notes: None,
            background_id: None,
            scrim_opacity: 35,
            slide_config: None,
            source: None,
            background_mode: Some("preset".into()),
            background_preset: Some("preto-branco".into()),
            font_family: Some("sans".into()),
            font_size: Some("lg".into()),
            text_casing: Some("upper".into()),
            created_at: 1000,
            updated_at: 2000,
            deleted_at: None,
            sections: vec![],
        };
        let json = serde_json::to_string(&song).unwrap();
        assert!(json.contains("\"createdAt\""), "expected camelCase: {json}");
        assert!(json.contains("\"updatedAt\""), "expected camelCase: {json}");
        assert!(json.contains("\"author\""), "expected author field: {json}");
        assert!(json.contains("\"copyright\""), "expected copyright field: {json}");
        let back: Song = serde_json::from_str(&json).unwrap();
        assert_eq!(back, song);
    }

    #[test]
    fn text_casing_from_opt_parses_known_and_defaults() {
        assert_eq!(TextCasing::from_opt(Some("upper")), TextCasing::Upper);
        assert_eq!(TextCasing::from_opt(Some("lower")), TextCasing::Lower);
        assert_eq!(TextCasing::from_opt(Some("title")), TextCasing::Title);
        assert_eq!(TextCasing::from_opt(Some("normal")), TextCasing::Normal);
        assert_eq!(TextCasing::from_opt(None), TextCasing::Normal);
        assert_eq!(TextCasing::from_opt(Some("bogus")), TextCasing::Normal);
    }

    #[test]
    fn text_casing_apply_transforms_lines() {
        assert_eq!(TextCasing::Normal.apply("Graça Divina"), "Graça Divina");
        assert_eq!(TextCasing::Upper.apply("Graça divina"), "GRAÇA DIVINA");
        assert_eq!(TextCasing::Lower.apply("Graça DIVINA"), "graça divina");
        assert_eq!(TextCasing::Title.apply("graça DIVINA é"), "Graça Divina É");
    }

    #[test]
    fn title_case_preserves_spacing() {
        assert_eq!(title_case("  hello   world  "), "  Hello   World  ");
    }

    #[test]
    fn section_type_serializes_snake_case() {
        assert_eq!(
            serde_json::to_string(&SectionType::PreChorus).unwrap(),
            "\"pre_chorus\""
        );
        assert_eq!(
            serde_json::to_string(&SectionType::Chorus).unwrap(),
            "\"chorus\""
        );
    }
}
