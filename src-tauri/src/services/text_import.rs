use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedSection {
    pub label: String,
    pub section_type: String,
    pub body: String,
}

/// Maps a bracket label (without `[` / `]`) to a section type string.
fn label_to_type(bracket_label: &str) -> (&'static str, Option<&'static str>) {
    let lower = bracket_label.to_lowercase();
    let lower = lower.trim();

    // Returns (section_type, forced_label_override)
    match lower {
        s if s.starts_with("estrofe") => ("verse", None),
        s if s == "refrão" || s == "refrao" || s == "refrao" => ("chorus", None),
        s if s == "ponte" => ("bridge", None),
        s if s == "intro" => ("verse", Some("Intro")),
        s if s == "final" => ("outro", None),
        s if s == "pré-refrão" || s == "pre-refrão" || s == "pre-refrao" || s == "pré-refrao" => {
            ("pre_chorus", None)
        }
        _ => ("verse", None),
    }
}

/// Parse plain-text lyrics into sections.
///
/// - Groups of non-blank lines separated by one or more blank lines form sections.
/// - If the first non-blank line of a group is `[Label]`, it defines the section label/type.
/// - Otherwise the section gets an auto-generated "Estrofe N" label.
pub fn parse_plain_text(input: &str) -> Vec<ParsedSection> {
    if input.trim().is_empty() {
        return vec![];
    }

    // Split into paragraph groups (separated by one or more blank lines).
    let paragraphs: Vec<Vec<&str>> = {
        let mut groups: Vec<Vec<&str>> = Vec::new();
        let mut current: Vec<&str> = Vec::new();
        for line in input.lines() {
            if line.trim().is_empty() {
                if !current.is_empty() {
                    groups.push(current.clone());
                    current.clear();
                }
            } else {
                current.push(line);
            }
        }
        if !current.is_empty() {
            groups.push(current);
        }
        groups
    };

    let mut verse_counter = 0usize;
    let mut sections: Vec<ParsedSection> = Vec::new();

    for group in paragraphs {
        if group.is_empty() {
            continue;
        }

        let first_trimmed = group[0].trim();

        // Check if the first line is a bracket label.
        if first_trimmed.starts_with('[') && first_trimmed.ends_with(']') {
            let bracket_content = &first_trimmed[1..first_trimmed.len() - 1];
            let body_lines = &group[1..];
            let body = body_lines
                .iter()
                .map(|l| l.trim_end())
                .collect::<Vec<_>>()
                .join("\n")
                .trim()
                .to_string();

            let (section_type, label_override) = label_to_type(bracket_content);
            let label = label_override
                .map(|s| s.to_string())
                .unwrap_or_else(|| bracket_content.to_string());

            if section_type == "verse" && label.to_lowercase().starts_with("estrofe") {
                verse_counter += 1;
            }

            sections.push(ParsedSection {
                label,
                section_type: section_type.to_string(),
                body,
            });
        } else {
            // Auto-label as "Estrofe N".
            verse_counter += 1;
            let body = group
                .iter()
                .map(|l| l.trim_end())
                .collect::<Vec<_>>()
                .join("\n");

            sections.push(ParsedSection {
                label: format!("Estrofe {verse_counter}"),
                section_type: "verse".to_string(),
                body,
            });
        }
    }

    sections
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_input_returns_empty_vec() {
        assert!(parse_plain_text("").is_empty());
        assert!(parse_plain_text("   \n   ").is_empty());
    }

    #[test]
    fn single_paragraph_becomes_one_section() {
        let result = parse_plain_text("Amazing grace\nhow sweet the sound");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].label, "Estrofe 1");
        assert_eq!(result[0].section_type, "verse");
        assert!(result[0].body.contains("Amazing grace"));
    }

    #[test]
    fn blank_line_split_produces_multiple_sections() {
        let input = "Linha um\nLinha dois\n\nLinha três\nLinha quatro";
        let result = parse_plain_text(input);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].label, "Estrofe 1");
        assert_eq!(result[1].label, "Estrofe 2");
    }

    #[test]
    fn bracket_refrao_maps_to_chorus() {
        let input = "[Refrão]\nCorpo do refrão";
        let result = parse_plain_text(input);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].section_type, "chorus");
        assert_eq!(result[0].label, "Refrão");
        assert_eq!(result[0].body, "Corpo do refrão");
    }

    #[test]
    fn bracket_ponte_maps_to_bridge() {
        let result = parse_plain_text("[Ponte]\ncorpo");
        assert_eq!(result[0].section_type, "bridge");
    }

    #[test]
    fn bracket_final_maps_to_outro() {
        let result = parse_plain_text("[Final]\ncorpo");
        assert_eq!(result[0].section_type, "outro");
    }

    #[test]
    fn bracket_pre_refrao_maps_to_pre_chorus() {
        let result = parse_plain_text("[Pré-refrão]\ncorpo");
        assert_eq!(result[0].section_type, "pre_chorus");
    }

    #[test]
    fn bracket_intro_maps_to_verse_with_intro_label() {
        let result = parse_plain_text("[Intro]\ncorpo");
        assert_eq!(result[0].section_type, "verse");
        assert_eq!(result[0].label, "Intro");
    }

    #[test]
    fn unknown_bracket_stays_as_label_with_type_verse() {
        let result = parse_plain_text("[CustomLabel]\ncorpo");
        assert_eq!(result[0].section_type, "verse");
        assert_eq!(result[0].label, "CustomLabel");
    }

    #[test]
    fn bracket_recognition_is_case_insensitive() {
        let result_upper = parse_plain_text("[REFRÃO]\ncorpo");
        let result_lower = parse_plain_text("[refrão]\ncorpo");
        assert_eq!(result_upper[0].section_type, "chorus");
        assert_eq!(result_lower[0].section_type, "chorus");
    }

    #[test]
    fn mixed_bracket_and_plain_sections() {
        let input = "Estrofe sem label\n\n[Refrão]\nCorpo do refrão\n\nOutra estrofe";
        let result = parse_plain_text(input);
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].section_type, "verse");
        assert_eq!(result[1].section_type, "chorus");
        assert_eq!(result[2].section_type, "verse");
    }
}
