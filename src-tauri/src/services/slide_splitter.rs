use crate::domain::slide::{Slide, SlideConfig};
use crate::domain::song::SongSection;

pub fn split(section: &SongSection, config: &SlideConfig) -> Vec<Slide> {
    if section.body.trim().is_empty() {
        return vec![];
    }

    let mut slides: Vec<Slide> = Vec::new();
    let mut current_lines: Vec<String> = Vec::new();

    for raw_line in section.body.split('\n') {
        if raw_line.trim().is_empty() {
            // Blank line = forced slide boundary
            if !current_lines.is_empty() {
                slides.push(Slide {
                    lines: std::mem::take(&mut current_lines),
                    section_label: section.label.clone(),
                    section_id: section.id.clone(),
                });
            }
        } else {
            for display_line in wrap_line(raw_line, config.max_chars_per_line) {
                if current_lines.len() >= config.max_lines {
                    slides.push(Slide {
                        lines: std::mem::take(&mut current_lines),
                        section_label: section.label.clone(),
                        section_id: section.id.clone(),
                    });
                }
                current_lines.push(display_line);
            }
        }
    }

    if !current_lines.is_empty() {
        slides.push(Slide {
            lines: current_lines,
            section_label: section.label.clone(),
            section_id: section.id.clone(),
        });
    }

    let repeat = section.repeat_count.max(1) as usize;
    if repeat > 1 && !slides.is_empty() {
        let base = slides.clone();
        for _ in 1..repeat {
            slides.extend_from_slice(&base);
        }
    }

    slides
}

/// Wraps a single line into one or more display lines of at most `max_chars` characters.
/// Breaks on the nearest preceding whitespace; hard-breaks at the limit if no whitespace exists.
fn wrap_line(line: &str, max_chars: usize) -> Vec<String> {
    let chars: Vec<char> = line.chars().collect();
    if chars.len() <= max_chars {
        return vec![line.to_string()];
    }

    let mut result = Vec::new();
    let mut pos = 0;

    while pos < chars.len() {
        let end = (pos + max_chars).min(chars.len());

        if end == chars.len() {
            let s: String = chars[pos..end].iter().collect();
            result.push(s);
            break;
        }

        // Look for the last whitespace in chars[pos..end].
        let segment = &chars[pos..end];
        if let Some(ws_offset) = segment.iter().rposition(|c| c.is_whitespace()) {
            result.push(segment[..ws_offset].iter().collect());
            pos += ws_offset + 1; // skip the whitespace character
        } else {
            // Hard break — no whitespace in this window.
            result.push(segment.iter().collect());
            pos = end;
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::song::SectionType;

    fn make_section(body: &str, repeat_count: i32) -> SongSection {
        SongSection {
            id: "sec1".into(),
            song_id: "song1".into(),
            label: "Estrofe 1".into(),
            section_type: SectionType::Verse,
            body: body.into(),
            sort_order: 0,
            repeat_count,
        }
    }

    #[test]
    fn single_slide_when_lines_fit() {
        let section = make_section("Amazing grace\nHow sweet the sound\nThat saved a wretch", 1);
        let config = SlideConfig::default(); // max_lines=4
        let slides = split(&section, &config);
        assert_eq!(slides.len(), 1);
        assert_eq!(slides[0].lines.len(), 3);
    }

    #[test]
    fn multi_slide_split_by_line_count() {
        let body = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8";
        let section = make_section(body, 1);
        let config = SlideConfig::default(); // max_lines=4
        let slides = split(&section, &config);
        assert_eq!(slides.len(), 2);
        assert_eq!(slides[0].lines.len(), 4);
        assert_eq!(slides[1].lines.len(), 4);
    }

    #[test]
    fn line_wraps_at_whitespace() {
        // "hello world more text" = 21 chars; max_chars=10 → wrap at space before "world"
        let section = make_section("hello world more text", 1);
        let config = SlideConfig {
            max_lines: 10,
            max_chars_per_line: 10,
        };
        let slides = split(&section, &config);
        assert_eq!(slides.len(), 1);
        // "hello" (5) then "world more" (10) then "text" (4)
        assert!(slides[0].lines[0].len() <= 10, "first wrapped line too long");
        assert!(slides[0].lines.len() >= 2, "expected wrapping to produce multiple lines");
    }

    #[test]
    fn line_hard_breaks_when_no_whitespace() {
        // "ABCDEFGHIJKLMNOPQRST" = 20 chars; max_chars=10 → hard break at 10
        let section = make_section("ABCDEFGHIJKLMNOPQRST", 1);
        let config = SlideConfig {
            max_lines: 10,
            max_chars_per_line: 10,
        };
        let slides = split(&section, &config);
        assert_eq!(slides.len(), 1);
        assert_eq!(slides[0].lines[0], "ABCDEFGHIJ");
        assert_eq!(slides[0].lines[1], "KLMNOPQRST");
    }

    #[test]
    fn empty_body_returns_empty_vec() {
        let section = make_section("", 1);
        assert!(split(&section, &SlideConfig::default()).is_empty());
        let whitespace_only = make_section("   \n  \n  ", 1);
        assert!(split(&whitespace_only, &SlideConfig::default()).is_empty());
    }

    #[test]
    fn repeat_count_duplicates_slides() {
        let section = make_section("Line A\nLine B", 3);
        let config = SlideConfig::default();
        let slides = split(&section, &config);
        assert_eq!(slides.len(), 3);
        assert_eq!(slides[0].lines, slides[1].lines);
        assert_eq!(slides[1].lines, slides[2].lines);
    }

    #[test]
    fn blank_lines_force_slide_boundary() {
        // Body has two paragraphs separated by a blank line.
        let body = "Verse line one\nVerse line two\n\nChorus line one\nChorus line two";
        let section = make_section(body, 1);
        let config = SlideConfig::default(); // max_lines=4
        let slides = split(&section, &config);
        assert_eq!(slides.len(), 2, "blank line must force a slide boundary");
        assert_eq!(slides[0].lines, vec!["Verse line one", "Verse line two"]);
        assert_eq!(slides[1].lines, vec!["Chorus line one", "Chorus line two"]);
    }

    #[test]
    fn section_label_and_id_propagated_to_all_slides() {
        let body = "L1\nL2\nL3\nL4\nL5\nL6\nL7\nL8";
        let section = make_section(body, 1);
        let slides = split(&section, &SlideConfig::default());
        for slide in &slides {
            assert_eq!(slide.section_label, "Estrofe 1");
            assert_eq!(slide.section_id, "sec1");
        }
    }
}
