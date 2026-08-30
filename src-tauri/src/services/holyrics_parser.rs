use serde::Deserialize;

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedHolyricsSong {
    pub title: String,
    pub artist: String,
    pub sections: Vec<ParsedHolyricsSection>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedHolyricsSection {
    pub number: u32,
    pub description: String,
    pub text: String,
}

#[derive(Debug)]
pub enum HolyricsError {
    InvalidJson(String),
    UnexpectedShape(String),
    EmptyArray,
}

impl std::fmt::Display for HolyricsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HolyricsError::InvalidJson(msg) => write!(f, "Arquivo não é um JSON válido: {msg}"),
            HolyricsError::UnexpectedShape(msg) => write!(
                f,
                "Estrutura não reconhecida — esperado um array de músicas ou uma única música: {msg}"
            ),
            HolyricsError::EmptyArray => write!(f, "Nenhuma música encontrada no arquivo"),
        }
    }
}

// Intermediate deserialization types mirroring the Holyrics JSON shape.
#[derive(Deserialize)]
struct RawSong {
    title: Option<String>,
    #[serde(default)]
    artist: Option<String>,
    lyrics: Option<RawLyrics>,
}

#[derive(Deserialize)]
struct RawLyrics {
    paragraphs: Option<Vec<RawParagraph>>,
}

#[derive(Deserialize)]
struct RawParagraph {
    number: Option<u32>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    text: Option<String>,
}

/// The JSON type of `v`, for an error message that tells the operator what the
/// file actually contained.
fn json_type_name(v: &serde_json::Value) -> &'static str {
    match v {
        serde_json::Value::Null => "null",
        serde_json::Value::Bool(_) => "a boolean",
        serde_json::Value::Number(_) => "a number",
        serde_json::Value::String(_) => "a string",
        serde_json::Value::Array(_) => "an array",
        serde_json::Value::Object(_) => "an object",
    }
}

pub fn parse(json: &str) -> Result<Vec<ParsedHolyricsSong>, HolyricsError> {
    let raw: serde_json::Value =
        serde_json::from_str(json).map_err(|e| HolyricsError::InvalidJson(e.to_string()))?;

    // Holyrics exports an array when several songs are selected, but a BARE
    // OBJECT when exactly one is (P16-13). Both are normalised to a list here so
    // the loop below is identical for either shape.
    let items: Vec<serde_json::Value> = match raw {
        serde_json::Value::Array(arr) => {
            if arr.is_empty() {
                return Err(HolyricsError::EmptyArray);
            }
            arr
        }
        obj @ serde_json::Value::Object(_) => vec![obj],
        other => {
            return Err(HolyricsError::UnexpectedShape(format!(
                "JSON root is {}, expected an array of songs or a single song object",
                json_type_name(&other)
            )));
        }
    };

    let mut songs = Vec::new();
    for (i, item) in items.into_iter().enumerate() {
        let raw_song: RawSong = serde_json::from_value(item).map_err(|e| {
            HolyricsError::UnexpectedShape(format!("item {i}: {e}"))
        })?;

        let title = raw_song.title.unwrap_or_default();
        let artist = raw_song.artist.unwrap_or_default();
        let paragraphs = raw_song
            .lyrics
            .and_then(|l| l.paragraphs)
            .unwrap_or_default();

        let sections: Vec<ParsedHolyricsSection> = paragraphs
            .into_iter()
            .map(|p| ParsedHolyricsSection {
                number: p.number.unwrap_or(1),
                description: p.description.unwrap_or_default(),
                text: p.text.unwrap_or_default(),
            })
            .collect();

        songs.push(ParsedHolyricsSong {
            title,
            artist,
            sections,
        });
    }

    Ok(songs)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_json() -> &'static str {
        r#"[
            {
                "title": "Graça Infinita",
                "artist": "Artista A",
                "lyrics": {
                    "paragraphs": [
                        { "number": 1, "description": "Estrofe 1", "text": "Letra da estrofe" },
                        { "number": 2, "description": "Refrão", "text": "Letra do refrão" }
                    ]
                }
            }
        ]"#
    }

    #[test]
    fn parses_valid_sample() {
        let songs = parse(sample_json()).unwrap();
        assert_eq!(songs.len(), 1);
        let song = &songs[0];
        assert_eq!(song.title, "Graça Infinita");
        assert_eq!(song.artist, "Artista A");
        assert_eq!(song.sections.len(), 2);
        assert_eq!(song.sections[0].description, "Estrofe 1");
        assert_eq!(song.sections[1].text, "Letra do refrão");
    }

    #[test]
    fn invalid_json_returns_error() {
        let result = parse("not valid json {{{");
        assert!(matches!(result, Err(HolyricsError::InvalidJson(_))));
    }

    /// P16-13: Holyrics drops the array wrapper when exactly one song is
    /// exported. That root used to be rejected outright; it now parses as a
    /// one-song list producing the same fields the array form does.
    #[test]
    fn single_object_root_parses_as_one_song() {
        let json = r#"{
            "title": "Graça Infinita",
            "artist": "Artista A",
            "lyrics": {
                "paragraphs": [
                    { "number": 1, "description": "Estrofe 1", "text": "Letra da estrofe" },
                    { "number": 2, "description": "Refrão", "text": "Letra do refrão" }
                ]
            }
        }"#;
        let songs = parse(json).unwrap();
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].title, "Graça Infinita");
        assert_eq!(songs[0].artist, "Artista A");
        assert_eq!(songs[0].sections.len(), 2);
        assert_eq!(songs[0].sections[1].description, "Refrão");
    }

    /// The object and array forms of the same song must be indistinguishable
    /// once parsed — that is the whole point of the normalisation.
    #[test]
    fn single_object_root_matches_the_wrapped_array_form() {
        let inner = r#"{
            "title": "Música",
            "artist": "Banda",
            "lyrics": { "paragraphs": [{ "number": 1, "description": "V1", "text": "corpo" }] }
        }"#;
        let from_object = parse(inner).unwrap();
        let from_array = parse(&format!("[{inner}]")).unwrap();
        assert_eq!(from_object, from_array);
    }

    #[test]
    fn single_object_root_without_lyrics_yields_a_song_with_no_sections() {
        let songs = parse(r#"{"title": "Só o título"}"#).unwrap();
        assert_eq!(songs.len(), 1);
        assert_eq!(songs[0].title, "Só o título");
        assert!(songs[0].sections.is_empty());
    }

    #[test]
    fn scalar_root_returns_unexpected_shape_error() {
        // P16-15: a root that is neither an array nor an object is still
        // rejected, and the message names both accepted shapes.
        for root in ["42", r#""uma string""#, "true", "null"] {
            let result = parse(root);
            assert!(
                matches!(result, Err(HolyricsError::UnexpectedShape(_))),
                "root {root} should be rejected"
            );
        }

        let msg = parse("42").unwrap_err().to_string();
        assert!(msg.contains("array"), "message should name the array shape: {msg}");
        assert!(
            msg.contains("única música"),
            "message should name the single-song shape: {msg}"
        );
    }

    #[test]
    fn object_root_with_wrong_field_types_is_rejected() {
        // Right root type, wrong contents — still an error, via the per-item path.
        let result = parse(r#"{"title": 123}"#);
        assert!(matches!(result, Err(HolyricsError::UnexpectedShape(_))));
    }

    #[test]
    fn empty_array_returns_empty_array_error() {
        let result = parse("[]");
        assert!(matches!(result, Err(HolyricsError::EmptyArray)));
    }

    #[test]
    fn paragraph_with_empty_description_uses_fallback() {
        let json = r#"[{
            "title": "Música",
            "lyrics": { "paragraphs": [{ "number": 3, "description": "", "text": "corpo" }] }
        }]"#;
        let songs = parse(json).unwrap();
        assert_eq!(songs[0].sections[0].description, "");
        assert_eq!(songs[0].sections[0].number, 3);
    }

    #[test]
    fn missing_artist_defaults_to_empty_string() {
        let json = r#"[{ "title": "Música", "lyrics": { "paragraphs": [] } }]"#;
        let songs = parse(json).unwrap();
        assert_eq!(songs[0].artist, "");
    }
}
