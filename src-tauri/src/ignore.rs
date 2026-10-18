/// Case-insensitive wildcard match (`*` = any run, `?` = any single character).
/// Compiled patterns are kept, so a busy channel does not rebuild a regex per message and mask.
fn wildcard_match(pattern: &str, text: &str) -> bool {
    use regex::Regex;
    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock};
    static CACHE: OnceLock<Mutex<HashMap<String, Option<Regex>>>> = OnceLock::new();
    let mut cache = CACHE.get_or_init(Default::default).lock().unwrap_or_else(|e| e.into_inner());
    if cache.len() > 512 {
        cache.clear();
    }
    cache
        .entry(pattern.to_string())
        .or_insert_with(|| {
            let body = regex::escape(pattern).replace(r"\*", ".*").replace(r"\?", ".");
            Regex::new(&format!("(?is)^{body}$")).ok()
        })
        .as_ref()
        .is_some_and(|re| re.is_match(text))
}

/// Whether `nick!user@host` is covered by an ignore mask. A bare word is a nick; `user@host` and
/// `@host` match any nick.
pub(crate) fn ignore_matches(mask: &str, nick: &str, user: &str, host: &str) -> bool {
    let mask = mask.trim();
    if mask.is_empty() {
        return false;
    }
    let full = if mask.contains('!') {
        mask.to_string()
    } else if mask.contains('@') {
        // `@host` leaves the user part empty, which should mean "any user".
        format!("*!{}", if mask.starts_with('@') { format!("*{mask}") } else { mask.to_string() })
    } else {
        format!("{mask}!*@*")
    };
    wildcard_match(&full, &format!("{nick}!{user}@{host}"))
}

#[cfg(test)]
mod ignore_tests {
    use super::*;

    #[test]
    fn bare_word_is_a_nick_mask() {
        assert!(ignore_matches("Spammer", "spammer", "u", "h.example"));
        assert!(!ignore_matches("Spammer", "spammer2", "u", "h.example"));
        assert!(ignore_matches("spam*", "spammer2", "u", "h.example"));
    }

    #[test]
    fn host_and_full_masks() {
        assert!(ignore_matches("*@*.evil.net", "anyone", "me", "box.evil.net"));
        assert!(ignore_matches("@box.evil.net", "anyone", "me", "box.evil.net"));
        assert!(ignore_matches("bob!*@10.0.?.*", "Bob", "x", "10.0.3.7"));
        assert!(!ignore_matches("bob!*@10.0.?.*", "Bob", "x", "10.1.3.7"));
        assert!(!ignore_matches("", "bob", "x", "y"));
    }
}
