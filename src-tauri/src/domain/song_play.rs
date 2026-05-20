use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SongPlay {
    pub id: String,
    pub song_id: String,
    pub set_id: String,
    /// Local calendar date the set was started — YYYY-MM-DD.
    pub played_on: String,
    pub created_at: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn song_play_round_trips_with_camel_case() {
        let play = SongPlay {
            id: "p1".into(),
            song_id: "s1".into(),
            set_id: "set1".into(),
            played_on: "2026-05-20".into(),
            created_at: 1_716_220_800_000,
        };
        let json = serde_json::to_string(&play).unwrap();
        assert!(json.contains("\"songId\""), "expected camelCase: {json}");
        assert!(json.contains("\"setId\""), "expected camelCase: {json}");
        assert!(json.contains("\"playedOn\""), "expected camelCase: {json}");
        assert!(json.contains("\"createdAt\""), "expected camelCase: {json}");
        let back: SongPlay = serde_json::from_str(&json).unwrap();
        assert_eq!(back, play);
    }
}
