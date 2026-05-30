use crate::domain::slide::{RepeatMode, Slide, SlideConfig};
use crate::domain::song::{SongSection, TextCasing};

/// Split a section into slides without any casing transform.
pub fn split(section: &SongSection, config: &SlideConfig) -> Vec<Slide> {
    split_with_casing(section, config, TextCasing::Normal, RepeatMode::Duplicate)
}

/// Split a section into slides, applying `casing` to every display line.
///
/// Lines are kept verbatim (one written line = one display line) so the slide
/// mirrors the strophe edit box; the renderer wraps only at the screen margins.
/// Slides break on blank lines and when `config.max_lines` is reached.
pub fn split_with_casing(
    section: &SongSection,
    config: &SlideConfig,
    casing: TextCasing,
    repeat_mode: RepeatMode,
) -> Vec<Slide> {
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
            if current_lines.len() >= config.max_lines {
                slides.push(Slide {
                    lines: std::mem::take(&mut current_lines),
                    section_label: section.label.clone(),
                    section_id: section.id.clone(),
                });
            }
            current_lines.push(casing.apply(raw_line));
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
        match repeat_mode {
            RepeatMode::Duplicate => {
                let base = slides.clone();
                for _ in 1..repeat {
                    slides.extend_from_slice(&base);
                }
            }
            RepeatMode::Annotate => {
                // Render once and mark the section's last slide with `(Nx)`.
                if let Some(last) = slides.last_mut() {
                    last.lines.push(format!("({repeat}x)"));
                }
            }
        }
    }

    slides
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
            notes: None,
            background_id: None,
            background_mode: None,
            background_preset: None,
            font_family: None,
            font_size: None,
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
    fn long_line_is_kept_verbatim_as_single_display_line() {
        // A long line is no longer force-broken — it stays one display line so
        // the slide mirrors the strophe edit box (the renderer wraps at margins).
        let long = "uma frase bem comprida que antes seria quebrada em sessenta caracteres";
        let section = make_section(long, 1);
        let config = SlideConfig {
            max_lines: 10,
            max_chars_per_line: 10,
        };
        let slides = split(&section, &config);
        assert_eq!(slides.len(), 1);
        assert_eq!(slides[0].lines, vec![long]);
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
    fn annotate_mode_marks_last_slide_instead_of_duplicating() {
        let section = make_section("Line A\nLine B", 2);
        let config = SlideConfig::default();
        let slides =
            split_with_casing(&section, &config, TextCasing::Normal, RepeatMode::Annotate);
        assert_eq!(slides.len(), 1, "annotate mode must not duplicate slides");
        assert_eq!(slides[0].lines, vec!["Line A", "Line B", "(2x)"]);
    }

    #[test]
    fn annotate_mode_marks_only_section_last_slide() {
        // 6 lines, max_lines=4 → two slides; the marker lands on the last.
        let body = "L1\nL2\nL3\nL4\nL5\nL6";
        let section = make_section(body, 3);
        let config = SlideConfig::default();
        let slides =
            split_with_casing(&section, &config, TextCasing::Normal, RepeatMode::Annotate);
        assert_eq!(slides.len(), 2);
        assert!(!slides[0].lines.contains(&"(3x)".to_string()));
        assert_eq!(*slides[1].lines.last().unwrap(), "(3x)");
    }

    #[test]
    fn annotate_mode_no_marker_when_repeat_one() {
        let section = make_section("Line A\nLine B", 1);
        let config = SlideConfig::default();
        let slides =
            split_with_casing(&section, &config, TextCasing::Normal, RepeatMode::Annotate);
        assert_eq!(slides.len(), 1);
        assert_eq!(slides[0].lines, vec!["Line A", "Line B"]);
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
    fn casing_is_applied_to_display_lines() {
        let section = make_section("graça divina\nque me salvou", 1);
        let config = SlideConfig::default();
        let slides = split_with_casing(&section, &config, TextCasing::Upper, RepeatMode::Duplicate);
        assert_eq!(slides.len(), 1);
        assert_eq!(slides[0].lines, vec!["GRAÇA DIVINA", "QUE ME SALVOU"]);
    }

    #[test]
    fn split_defaults_to_no_casing() {
        let section = make_section("Graça Divina", 1);
        let slides = split(&section, &SlideConfig::default());
        assert_eq!(slides[0].lines, vec!["Graça Divina"]);
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
