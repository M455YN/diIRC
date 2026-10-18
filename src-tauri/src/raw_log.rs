use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::Mutex;
use chrono::Local;

const RAW_LOG_CAP: usize = 1000;

#[derive(Serialize, Clone)]
pub(crate) struct RawLine {
    time: String,
    /// `rx` (from the server) or `tx` (sent by us).
    dir: &'static str,
    line: String,
}

/// Hides secrets (passwords, SASL, service logins) before a line is kept in the viewer.
/// Anything said to a services bot (NickServ, ChanServ, `Q@...`) is hidden, whatever the command.
fn redact_raw(line: &str) -> String {
    let tokens: Vec<&str> = line.split_whitespace().collect();
    if let Some(at) = tokens.iter().take(3).position(|t| t.eq_ignore_ascii_case("PRIVMSG") || t.eq_ignore_ascii_case("NOTICE")) {
        if let Some(target) = tokens.get(at + 1) {
            let target = target.to_ascii_lowercase();
            let nick = target.split('@').next().unwrap_or("");
            if nick.ends_with("serv") || nick == "q" {
                return format!("{} :*** (hidden)", tokens[..=at + 1].join(" "));
            }
        }
    }
    let lower = line.to_ascii_lowercase();
    let sensitive = ["pass ", "authenticate ", "identify ", "oper ", "register ", "login "]
        .iter()
        .any(|word| lower.starts_with(word) || lower.contains(&format!(" {word}")) || lower.contains(&format!(":{word}")));
    if !sensitive {
        return line.to_string();
    }
    // `PASS secret` keeps only the command; `PRIVMSG NickServ :IDENTIFY secret` keeps the target as well.
    let first = line.split_whitespace().next().unwrap_or("");
    let keep = if ["pass", "authenticate", "oper"].iter().any(|word| first.eq_ignore_ascii_case(word)) { 1 } else { 2 };
    let head: Vec<&str> = line.split_whitespace().take(keep).collect();
    format!("{} :*** (hidden)", head.join(" "))
}

pub(crate) async fn push_raw(
    log: &Arc<Mutex<HashMap<String, VecDeque<RawLine>>>>,
    server_id: &str,
    dir: &'static str,
    line: &str,
) {
    let mut map = log.lock().await;
    let queue = map.entry(server_id.to_string()).or_default();
    if queue.len() >= RAW_LOG_CAP {
        queue.pop_front();
    }
    queue.push_back(RawLine {
        time: Local::now().format("%H:%M:%S%.3f").to_string(),
        dir,
        line: redact_raw(line.trim_end()),
    });
}

#[cfg(test)]
mod raw_log_tests {
    use super::*;

    #[test]
    fn secrets_are_hidden() {
        assert_eq!(redact_raw("PASS hunter2"), "PASS :*** (hidden)");
        assert!(!redact_raw("PRIVMSG NickServ :IDENTIFY secret").contains("secret"));
        assert!(!redact_raw("AUTHENTICATE c2VjcmV0").contains("c2VjcmV0"));
        assert_eq!(redact_raw(":a!b@c PRIVMSG #x :hello world"), ":a!b@c PRIVMSG #x :hello world");
        for line in [
            "PRIVMSG NickServ :GHOST nick hunter2",
            "PRIVMSG Q@CServe.quakenet.org :AUTH user hunter2",
            "PRIVMSG nickserv :RECOVER nick hunter2",
            "NOTICE ChanServ :SET PASSWORD hunter2",
            "@time=2026-01-01T00:00:00Z PRIVMSG NickServ :IDENTIFY hunter2",
        ] {
            assert!(!redact_raw(line).contains("hunter2"), "{line}");
        }
    }
}
