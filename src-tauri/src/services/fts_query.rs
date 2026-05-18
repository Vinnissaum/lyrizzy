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

#[cfg(test)]
mod tests {
    use super::*;

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
