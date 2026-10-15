//! EasyList-style filter rules for the in-app link preview: domain blocks and element hiding.
//! shortcut: only plain `||domain^` network rules and generic `##selector` cosmetic rules are used;
//! rules with options or paths and domain-specific cosmetic rules are skipped. Upgrade by adding them.

use std::collections::HashSet;
use std::path::Path;
use std::time::{Duration, SystemTime};

/// (file name in the cache, source). Downloaded on demand, not bundled.
const LISTS: &[(&str, &str)] = &[
    ("easylist.txt", "https://easylist.to/easylist/easylist.txt"),
    ("easyprivacy.txt", "https://easylist.to/easylist/easyprivacy.txt"),
    ("cookie.txt", "https://secure.fanboy.co.nz/fanboy-cookiemonster.txt"),
];
const MAX_AGE: Duration = Duration::from_secs(7 * 24 * 60 * 60);

#[derive(Default)]
pub struct FilterRules {
    blocked: HashSet<String>,
    allowed: HashSet<String>,
    hidden: Vec<String>,
}

/// Returns the host of a plain `||host^` rule body, or None for rules with paths or options.
fn plain_host(rule: &str) -> Option<String> {
    let host = rule.strip_suffix('^')?.to_ascii_lowercase();
    let valid = !host.is_empty() && host.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-');
    valid.then_some(host)
}

impl FilterRules {
    pub fn add_list(&mut self, text: &str) {
        let mut exceptions = HashSet::new();
        for line in text.lines().map(str::trim) {
            if line.is_empty() || line.starts_with('!') || line.starts_with('[') {
                continue;
            }
            if let Some(rule) = line.strip_prefix("@@||") {
                if let Some(host) = plain_host(rule) {
                    self.allowed.insert(host);
                }
            } else if let Some(rule) = line.strip_prefix("||") {
                if let Some(host) = plain_host(rule) {
                    self.blocked.insert(host);
                }
            } else if let Some(selector) = line.strip_prefix("#@#") {
                exceptions.insert(selector.to_string());
            } else if let Some(selector) = line.strip_prefix("##") {
                if !selector.is_empty() && !selector.contains(['{', '}']) {
                    self.hidden.push(selector.to_string());
                }
            }
        }
        self.hidden.retain(|selector| !exceptions.contains(selector));
    }

    pub fn blocks_url(&self, url: &str) -> bool {
        let Ok(parsed) = tauri::Url::parse(url) else {
            return false;
        };
        let Some(host) = parsed.host_str() else {
            return false;
        };
        // Walk from the full host to its parents; the most specific rule wins.
        let mut rest = host.to_ascii_lowercase();
        loop {
            if self.allowed.contains(&rest) {
                return false;
            }
            if self.blocked.contains(&rest) {
                return true;
            }
            match rest.split_once('.') {
                Some((_, parent)) => rest = parent.to_string(),
                None => return false,
            }
        }
    }

    /// Script that hides matching elements. Each selector is inserted on its own, so one selector
    /// the browser rejects does not drop the rest.
    pub fn hiding_script(&self) -> String {
        let selectors = serde_json::to_string(&self.hidden).unwrap_or_else(|_| "[]".to_string());
        format!(
            "(() => {{ const selectors = {selectors}; const apply = () => {{ \
             const style = document.createElement('style'); \
             (document.head || document.documentElement).appendChild(style); \
             for (const sel of selectors) {{ try {{ style.sheet.insertRule(sel + '{{display:none!important}}', style.sheet.cssRules.length); }} catch (_) {{}} }} \
             }}; \
             if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, {{ once: true }}); else apply(); }})();"
        )
    }
}

async fn download(client: &reqwest::Client, url: &str) -> Result<String, reqwest::Error> {
    client.get(url).send().await?.error_for_status()?.text().await
}

/// Loads every list, refreshing the cache when it is older than `MAX_AGE`. A failed download falls back
/// to the cached copy; a list with neither is skipped.
pub async fn load(cache_dir: &Path) -> FilterRules {
    let mut rules = FilterRules::default();
    let client = reqwest::Client::builder().timeout(Duration::from_secs(60)).build();
    for (file, url) in LISTS {
        let path = cache_dir.join(file);
        let fresh = tokio::fs::metadata(&path)
            .await
            .and_then(|meta| meta.modified())
            .ok()
            .and_then(|modified| SystemTime::now().duration_since(modified).ok())
            .is_some_and(|age| age < MAX_AGE);
        if !fresh {
            if let Ok(client) = &client {
                match download(client, url).await {
                    Ok(text) => {
                        let _ = tokio::fs::create_dir_all(cache_dir).await;
                        let _ = tokio::fs::write(&path, text).await;
                    }
                    Err(e) => log::warn!("Could not download filter list {file}: {e}"),
                }
            }
        }
        match tokio::fs::read_to_string(&path).await {
            Ok(text) => rules.add_list(&text),
            Err(_) => log::warn!("Filter list {file} is not available"),
        }
    }
    rules
}

#[cfg(test)]
mod tests {
    use super::FilterRules;

    fn rules(text: &str) -> FilterRules {
        let mut rules = FilterRules::default();
        rules.add_list(text);
        rules
    }

    #[test]
    fn blocks_listed_hosts_and_subdomains_only() {
        let rules = rules("||doubleclick.net^\n||ads.example.com^$third-party\n||tracker.org/pixel^\n");
        assert!(rules.blocks_url("https://doubleclick.net/x"));
        assert!(rules.blocks_url("https://ad.doubleclick.net/ad/123"));
        assert!(!rules.blocks_url("https://notdoubleclick.net/"));
        assert!(!rules.blocks_url("https://example.com/doubleclick.net"));
        // Rules with options or paths are skipped.
        assert!(!rules.blocks_url("https://ads.example.com/"));
        assert!(!rules.blocks_url("https://tracker.org/"));
    }

    #[test]
    fn exceptions_win_over_blocks() {
        let rules = rules("||doubleclick.net^\n@@||safe.doubleclick.net^\n");
        assert!(rules.blocks_url("https://ad.doubleclick.net/"));
        assert!(!rules.blocks_url("https://safe.doubleclick.net/"));
    }

    #[test]
    fn hides_generic_selectors_except_excepted_ones() {
        let rules = rules("##.cookie-banner\n##.promo\n#@#.promo\nexample.com##.only-there\n");
        let script = rules.hiding_script();
        assert!(script.contains("\".cookie-banner\""));
        assert!(!script.contains(".promo"));
        assert!(!script.contains("only-there"));
    }
}
