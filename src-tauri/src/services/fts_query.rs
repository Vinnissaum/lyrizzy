/// Result of sanitizing a user-supplied search string for FTS5.
pub enum FtsQuery {
    /// Safe to use with `MATCH`; value is the (possibly prefix-modified) query.
    Fts5(String),
    /// Input had unbalanced quotes or parens — fall back to a LIKE search.
    Like(String),
}

/// Sanitize `input` for safe use in an FTS5 MATCH clause.
///
/// Unbalanced `"` or `(` / `)` would cause a sqlite3 FTS5 syntax error, so
/// we detect them and downgrade to a LIKE search instead.  A trailing `*` is
/// appended for prefix matching when the input looks like a plain term.
pub fn sanitize(input: &str) -> FtsQuery {
    let trimmed = input.trim();

    let quote_count = trimmed.chars().filter(|&c| c == '"').count();
    let open_parens = trimmed.chars().filter(|&c| c == '(').count();
    let close_parens = trimmed.chars().filter(|&c| c == ')').count();

    if quote_count % 2 != 0 || open_parens != close_parens {
        return FtsQuery::Like(trimmed.to_string());
    }

    // Append a prefix wildcard when the input is a simple word/phrase
    // (no existing FTS5 operators present).
    let has_operators = trimmed.contains('"')
        || trimmed.contains('(')
        || trimmed.contains(" OR ")
        || trimmed.contains(" AND ")
        || trimmed.contains(" NOT ")
        || trimmed.ends_with('*');

    let query = if has_operators {
        trimmed.to_string()
    } else {
        format!("{trimmed}*")
    };

    FtsQuery::Fts5(query)
}

/// Lower case with every Portuguese (and common Latin-1) diacritic removed:
/// "Manancial de Toda Benção" → "manancial de toda bencao". The full-text
/// index folds accents itself (`unicode61`); this is for searches that do not
/// go through it (P23 S7).
pub fn fold_for_search(text: &str) -> String {
    text.chars()
        // A title stored decomposed ("c" + a combining cedilla, as text from
        // macOS often is) carries its accents as separate combining marks.
        .filter(|c| !('\u{0300}'..='\u{036F}').contains(c))
        .flat_map(char::to_lowercase)
        .map(fold_char)
        .collect()
}

fn fold_char(c: char) -> char {
    match c {
        'á' | 'à' | 'â' | 'ã' | 'ä' | 'å' => 'a',
        'ç' => 'c',
        'é' | 'è' | 'ê' | 'ë' => 'e',
        'í' | 'ì' | 'î' | 'ï' => 'i',
        'ñ' => 'n',
        'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
        'ú' | 'ù' | 'û' | 'ü' => 'u',
        'ý' | 'ÿ' => 'y',
        other => other,
    }
}

/// What the fallback search compares, on the typed text and on each title and
/// artist alike: folded, without the quotes and parentheses that sent the
/// search to the fallback in the first place, and with the spaces they leave
/// behind trimmed and collapsed ("bencao (" → "bencao").
pub fn fallback_key(text: &str) -> String {
    let kept: String = fold_for_search(text)
        .chars()
        .filter(|c| !matches!(c, '"' | '(' | ')'))
        .collect();
    kept.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fold_for_search_drops_accents_and_cedilla() {
        let pairs = [
            ('á', 'a'), ('à', 'a'), ('â', 'a'), ('ã', 'a'), ('é', 'e'), ('ê', 'e'), ('í', 'i'),
            ('ó', 'o'), ('ô', 'o'), ('õ', 'o'), ('ú', 'u'), ('ü', 'u'), ('ç', 'c'),
        ];
        for (accented, plain) in pairs {
            assert_eq!(fold_for_search(&accented.to_string()), plain.to_string(), "{accented}");
            let upper: String = accented.to_uppercase().collect();
            assert_eq!(fold_for_search(&upper), plain.to_string(), "{upper}");
        }
        assert_eq!(fold_for_search("Só pra te Adorar"), "so pra te adorar");
        assert_eq!(fold_for_search("BENÇÃO"), "bencao");
        // Decomposed: the base letter followed by a combining mark.
        assert_eq!(fold_for_search("Ben\u{0063}\u{0327}a\u{0303}o"), "bencao");
        assert_eq!(fold_for_search("BENC\u{0327}A\u{0303}O"), "bencao");
        assert_eq!(fold_for_search("So\u{0301} pra"), "so pra");
        // Other text is only lower-cased.
        assert_eq!(fold_for_search("Sonda-me (Ao Vivo) 2X"), "sonda-me (ao vivo) 2x");
        assert_eq!(fallback_key("Sonda-me (Ao Vivo) \"2X"), "sonda-me ao vivo 2x");
        assert_eq!(fallback_key("bencao ("), "bencao");
        assert_eq!(fallback_key("so ( pra"), "so pra");
    }

    #[test]
    fn plain_term_gets_prefix_wildcard() {
        match sanitize("grace") {
            FtsQuery::Fts5(q) => assert_eq!(q, "grace*"),
            FtsQuery::Like(_) => panic!("expected Fts5"),
        }
    }

    #[test]
    fn unbalanced_quote_downgrades_to_like() {
        assert!(matches!(sanitize("\"unbalanced"), FtsQuery::Like(_)));
    }

    #[test]
    fn unbalanced_parens_downgrades_to_like() {
        assert!(matches!(sanitize("word (incomplete"), FtsQuery::Like(_)));
    }

    #[test]
    fn balanced_quotes_stay_as_fts5() {
        assert!(matches!(sanitize("\"exact phrase\""), FtsQuery::Fts5(_)));
    }

    #[test]
    fn existing_wildcard_not_doubled() {
        match sanitize("grace*") {
            FtsQuery::Fts5(q) => assert_eq!(q, "grace*"),
            FtsQuery::Like(_) => panic!("expected Fts5"),
        }
    }
}
