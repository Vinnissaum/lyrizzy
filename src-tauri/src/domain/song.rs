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
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Song {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub ccli_number: Option<String>,
    pub key_signature: Option<String>,
    pub language: String,
    pub notes: Option<String>,
    pub background_id: Option<String>,
    pub slide_config: Option<String>,
    pub source: Option<String>,
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
        };
        let json = serde_json::to_string(&section).unwrap();
        assert!(json.contains("\"songId\""), "expected camelCase: {json}");
        assert!(json.contains("\"sortOrder\""), "expected camelCase: {json}");
        assert!(json.contains("\"repeatCount\""), "expected camelCase: {json}");
        assert!(json.contains("\"type\":\"verse\""), "expected snake_case enum: {json}");
        let back: SongSection = serde_json::from_str(&json).unwrap();
        assert_eq!(back, section);
    }

    #[test]
    fn song_round_trips_with_camel_case() {
        let song = Song {
            id: "id1".into(),
            title: "Amazing Grace".into(),
            artist: Some("John Newton".into()),
            ccli_number: None,
            key_signature: None,
            language: "pt".into(),
            notes: None,
            background_id: None,
            slide_config: None,
            source: None,
            created_at: 1000,
            updated_at: 2000,
            deleted_at: None,
            sections: vec![],
        };
        let json = serde_json::to_string(&song).unwrap();
        assert!(json.contains("\"createdAt\""), "expected camelCase: {json}");
        assert!(json.contains("\"updatedAt\""), "expected camelCase: {json}");
        let back: Song = serde_json::from_str(&json).unwrap();
        assert_eq!(back, song);
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
