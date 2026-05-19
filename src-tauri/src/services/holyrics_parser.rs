use serde::{Deserialize, Serialize};

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
                "Estrutura não reconhecida — esperado um array de músicas: {msg}"
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

pub fn parse(json: &str) -> Result<Vec<ParsedHolyricsSong>, HolyricsError> {
    let raw: serde_json::Value =
        serde_json::from_str(json).map_err(|e| HolyricsError::InvalidJson(e.to_string()))?;

    let arr = raw
        .as_array()
        .ok_or_else(|| HolyricsError::UnexpectedShape("JSON root is not an array".to_string()))?;

    if arr.is_empty() {
        return Err(HolyricsError::EmptyArray);
    }

    let mut songs = Vec::new();
    for (i, item) in arr.iter().enumerate() {
        let raw_song: RawSong = serde_json::from_value(item.clone()).map_err(|e| {
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

    #[test]
    fn non_array_root_returns_unexpected_shape_error() {
        let result = parse(r#"{"title": "oops"}"#);
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
