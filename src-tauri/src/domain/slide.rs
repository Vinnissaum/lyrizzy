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

/// A stable reference to a slide's position within an item's slide list,
/// used to keep the projected slide stable across regeneration (e.g. live
/// editing) even when the total number/order of slides changes.
#[derive(Clone, Debug, PartialEq)]
pub struct SlideAnchor {
    /// The slide's content: each line trimmed, joined with `\n`.
    pub key: String,
    /// The index of this slide among all slides sharing `key`
    /// within the item (i.e. the Nth occurrence of that content).
    pub ordinal: usize,
}

fn content_key(slide: &Slide) -> String {
    slide
        .lines
        .iter()
        .map(|l| l.trim())
        .collect::<Vec<_>>()
        .join("\n")
}

/// Builds the anchor for the slide at `index`. Returns `None` if `index` is
/// out of range for `slides`.
pub fn anchor_of(slides: &[Slide], index: usize) -> Option<SlideAnchor> {
    let slide = slides.get(index)?;
    let key = content_key(slide);
    let ordinal = slides[..index]
        .iter()
        .filter(|s| content_key(s) == key)
        .count();
    Some(SlideAnchor { key, ordinal })
}

/// Resolves an anchor against a regenerated slide list, returning an index
/// that is always valid for `new_slides` (or `0` if it is empty).
///
/// Fallback chain:
/// 1. Exact `(key, ordinal)` match.
/// 2. The last slide carrying `key` (ordinal overflow / content shrank).
/// 3. `old_index` clamped to `new_slides.len() - 1` (content removed entirely).
/// 4. `0` (e.g. `new_slides` is empty).
pub fn resolve_anchor(
    new_slides: &[Slide],
    anchor: Option<&SlideAnchor>,
    old_index: usize,
) -> usize {
    if new_slides.is_empty() {
        return 0;
    }

    if let Some(anchor) = anchor {
        let matching: Vec<usize> = new_slides
            .iter()
            .enumerate()
            .filter(|(_, s)| content_key(s) == anchor.key)
            .map(|(i, _)| i)
            .collect();

        if let Some(&exact) = matching.get(anchor.ordinal) {
            return exact;
        }

        if let Some(&last) = matching.last() {
            return last;
        }
    }

    old_index.min(new_slides.len() - 1)
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

    /// Builds a slide whose content (and hence anchor key) is `content`.
    /// `section_id` is left as an arbitrary, unused placeholder since
    /// anchoring no longer keys off it.
    fn slide_with(content: &str) -> Slide {
        Slide {
            lines: vec![content.into()],
            section_label: "Verse".into(),
            section_id: "unused".into(),
        }
    }

    #[test]
    fn anchor_of_returns_none_for_out_of_range_index() {
        let slides = vec![slide_with("s1")];
        assert_eq!(anchor_of(&slides, 5), None);
    }

    #[test]
    fn anchor_of_key_joins_trimmed_lines_with_newline() {
        let slide = Slide {
            lines: vec!["  Amazing grace  ".into(), "How sweet ".into()],
            section_label: "Verse 1".into(),
            section_id: "unused".into(),
        };
        let anchor = anchor_of(&[slide], 0).unwrap();
        assert_eq!(anchor.key, "Amazing grace\nHow sweet");
        assert_eq!(anchor.ordinal, 0);
    }

    #[test]
    fn resolve_anchor_exact_hit_on_unchanged_slides_returns_same_index() {
        let slides = vec![slide_with("s1"), slide_with("s2"), slide_with("s3")];
        let anchor = anchor_of(&slides, 1).unwrap();
        assert_eq!(resolve_anchor(&slides, Some(&anchor), 1), 1);
    }

    #[test]
    fn resolve_anchor_content_split_across_slides_resolves_by_ordinal() {
        let old_slides = vec![
            slide_with("s1"),
            slide_with("s2"),
            slide_with("s2"),
            slide_with("s2"),
        ];
        // Third slide with content "s2" (ordinal 2).
        let anchor = anchor_of(&old_slides, 3).unwrap();
        assert_eq!(anchor.ordinal, 2);

        let new_slides = vec![
            slide_with("s1"),
            slide_with("s2"),
            slide_with("s2"),
            slide_with("s2"),
        ];
        assert_eq!(resolve_anchor(&new_slides, Some(&anchor), 3), 3);
    }

    #[test]
    fn resolve_anchor_repeated_content_disambiguated_by_ordinal() {
        // Simulates RepeatMode::Duplicate: same content repeated.
        let slides = vec![slide_with("chorus"), slide_with("chorus")];
        let anchor_first = anchor_of(&slides, 0).unwrap();
        let anchor_second = anchor_of(&slides, 1).unwrap();
        assert_eq!(anchor_first.ordinal, 0);
        assert_eq!(anchor_second.ordinal, 1);
        assert_eq!(resolve_anchor(&slides, Some(&anchor_second), 1), 1);
        assert_eq!(resolve_anchor(&slides, Some(&anchor_first), 0), 0);
    }

    #[test]
    fn resolve_anchor_ordinal_overflow_falls_back_to_last_slide_of_content() {
        let old_slides = vec![
            slide_with("s1"),
            slide_with("s2"),
            slide_with("s2"),
            slide_with("s2"),
        ];
        let anchor = anchor_of(&old_slides, 3).unwrap(); // ordinal 2

        // Content "s2" shrank to a single slide.
        let new_slides = vec![slide_with("s1"), slide_with("s2")];
        assert_eq!(resolve_anchor(&new_slides, Some(&anchor), 3), 1);
    }

    #[test]
    fn resolve_anchor_content_deleted_clamps_old_index_to_last_slide() {
        let old_slides = vec![slide_with("s1"), slide_with("s2"), slide_with("s3")];
        let anchor = anchor_of(&old_slides, 1).unwrap(); // content "s2"

        // Content "s2" removed entirely.
        let new_slides = vec![slide_with("s1"), slide_with("s3")];
        assert_eq!(resolve_anchor(&new_slides, Some(&anchor), 1), 1);
    }

    #[test]
    fn resolve_anchor_shrink_below_old_index_returns_new_last_index() {
        let old_slides = vec![
            slide_with("s1"),
            slide_with("s2"),
            slide_with("s3"),
            slide_with("s4"),
        ];
        let anchor = anchor_of(&old_slides, 3).unwrap(); // content "s4"

        let new_slides = vec![slide_with("s1"), slide_with("s2")];
        assert_eq!(resolve_anchor(&new_slides, Some(&anchor), 3), 1);
    }

    #[test]
    fn resolve_anchor_empty_new_slides_returns_zero() {
        let old_slides = vec![slide_with("s1")];
        let anchor = anchor_of(&old_slides, 0).unwrap();
        assert_eq!(resolve_anchor(&[], Some(&anchor), 0), 0);
        assert_eq!(resolve_anchor(&[], None, 0), 0);
    }

    #[test]
    fn resolve_anchor_sentinel_slides_use_same_rule() {
        let old_slides = vec![
            Slide::pseudo("__title__"),
            slide_with("s1"),
            Slide::pseudo("__blackout__"),
        ];
        let anchor = anchor_of(&old_slides, 0).unwrap();
        assert_eq!(anchor.key, "");

        let new_slides = vec![
            Slide::pseudo("__title__"),
            Slide::pseudo("__title__"),
            slide_with("s1"),
        ];
        // key "" now has two slides; ordinal 0 should hit the first.
        assert_eq!(resolve_anchor(&new_slides, Some(&anchor), 0), 0);
    }

    #[test]
    fn resolve_anchor_strophe_inserted_above_shifts_anchor_forward() {
        // Anchor sits on the second strophe ("verse2").
        let old_slides = vec![slide_with("verse1"), slide_with("verse2"), slide_with("verse3")];
        let anchor = anchor_of(&old_slides, 1).unwrap();

        // A new strophe is inserted above "verse2".
        let new_slides = vec![
            slide_with("verse1"),
            slide_with("inserted"),
            slide_with("verse2"),
            slide_with("verse3"),
        ];
        assert_eq!(resolve_anchor(&new_slides, Some(&anchor), 1), 2);
    }

    #[test]
    fn resolve_anchor_strophe_deleted_above_shifts_anchor_backward() {
        // Anchor sits on the third strophe ("verse3").
        let old_slides = vec![
            slide_with("verse1"),
            slide_with("verse2"),
            slide_with("verse3"),
        ];
        let anchor = anchor_of(&old_slides, 2).unwrap();

        // The strophe above it ("verse1") is deleted.
        let new_slides = vec![slide_with("verse2"), slide_with("verse3")];
        assert_eq!(resolve_anchor(&new_slides, Some(&anchor), 2), 1);
    }

    #[test]
    fn resolve_anchor_current_slide_text_edited_falls_back_to_clamped_old_index() {
        // The current slide's own text changes, so its content key no
        // longer exists anywhere in the regenerated list. Since the slide
        // count is unchanged, the clamped old_index is still correct.
        let old_slides = vec![slide_with("verse1"), slide_with("verse2"), slide_with("verse3")];
        let anchor = anchor_of(&old_slides, 1).unwrap(); // key "verse2"

        let new_slides = vec![slide_with("verse1"), slide_with("verse2 edited"), slide_with("verse3")];
        assert_eq!(resolve_anchor(&new_slides, Some(&anchor), 1), 1);
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
