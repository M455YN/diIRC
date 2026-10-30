//! Luna extensions: single `.js` files whose first comment holds a JSON manifest.
//!
//! The frontend runs each extension in a hidden sandboxed iframe whose document comes from the small loopback
//! server below. That document carries a CSP header (`default-src 'none'`), so the browser itself cuts the
//! extension off from the network and the app's DOM. Everything an extension can do goes through messages the
//! frontend checks against the permissions the user granted (see `src/lib/extensions`). `ext_http` is the only
//! network path, and it only reaches hosts the frontend passes in.
//!
//! Why a loopback server and not a custom protocol: Tauri treats pages from a protocol the app registers as the
//! app's own (local) origin, whose frames may call every command. A `127.0.0.1:<port>` page is a remote origin,
//! and Tauri rejects commands from remote origins unless a capability explicitly allows them (none does).

use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::crypto::WebPkiSupportedAlgorithms;
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{CertificateError, DigitallySignedStruct, SignatureScheme};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::OnceCell;

const MAX_SOURCE_BYTES: u64 = 512 * 1024;
const MAX_HTTP_BYTES: usize = 2 * 1024 * 1024;
/// What the extension document may do: run its own script, nothing else.
const EXTENSION_CSP: &str = "default-src 'none'; script-src 'self'; base-uri 'none'; form-action 'none'";
/// Defines `window.luna` inside the sandbox; kept next to the host code that answers it.
const SDK_JS: &str = include_str!("../../src/lib/extensions/sdk.js");

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Permissions {
    /// `host` or `host:port` entries `ext_http` may reach.
    #[serde(default)]
    pub network: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SettingSpec {
    pub key: String,
    pub label: String,
    /// `text` or `boolean`.
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub default: serde_json::Value,
    #[serde(default)]
    pub placeholder: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Manifest {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub description: String,
    pub api: u32,
    #[serde(default)]
    pub permissions: Permissions,
    #[serde(default)]
    pub settings: Vec<SettingSpec>,
}

fn valid_id(id: &str) -> bool {
    (2..=40).contains(&id.len())
        && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        && !id.starts_with('-')
}

fn valid_network_entry(entry: &str) -> bool {
    !entry.is_empty()
        && entry.len() <= 100
        && entry.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == ':')
}

/// The manifest is the JSON in the file's first block comment: `/* luna-extension { ... } */`.
pub fn parse_manifest(source: &str) -> Result<Manifest, String> {
    let rest = source
        .trim_start_matches('\u{feff}')
        .trim_start()
        .strip_prefix("/*")
        .ok_or("The file must start with a /* luna-extension { ... } */ comment")?;
    let end = rest.find("*/").ok_or("The manifest comment is not closed")?;
    let json = rest[..end]
        .trim()
        .strip_prefix("luna-extension")
        .ok_or("The first comment must start with `luna-extension`")?;
    let manifest: Manifest = serde_json::from_str(json.trim()).map_err(|e| format!("Invalid manifest: {e}"))?;

    if !valid_id(&manifest.id) {
        return Err("Manifest id must be 2-40 characters: lowercase letters, digits and dashes".to_string());
    }
    if manifest.name.trim().is_empty() || manifest.name.len() > 60 {
        return Err("Manifest name must be 1-60 characters".to_string());
    }
    if manifest.version.trim().is_empty() || manifest.version.len() > 24 {
        return Err("Manifest version must be 1-24 characters".to_string());
    }
    if manifest.api != 1 {
        return Err(format!("This Luna supports extension API 1, the extension needs {}", manifest.api));
    }
    if manifest.permissions.network.len() > 10 || !manifest.permissions.network.iter().all(|e| valid_network_entry(e)) {
        return Err("permissions.network must list at most 10 plain `host` or `host:port` entries".to_string());
    }
    if manifest.settings.len() > 20 {
        return Err("An extension can declare at most 20 settings".to_string());
    }
    for setting in &manifest.settings {
        let key_ok = !setting.key.is_empty()
            && setting.key.len() <= 32
            && setting.key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
        if !key_ok || !matches!(setting.kind.as_str(), "text" | "boolean") {
            return Err(format!("Invalid setting `{}`: keys are letters, digits and _, type is text or boolean", setting.key));
        }
    }
    Ok(manifest)
}

fn extensions_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve the application data directory: {e}"))?
        .join("extensions"))
}

async fn read_source(path: &str) -> Result<(String, Manifest), String> {
    let meta = tokio::fs::metadata(path).await.map_err(|e| format!("Cannot read the file: {e}"))?;
    if !meta.is_file() || meta.len() > MAX_SOURCE_BYTES {
        return Err(format!("Extensions must be a single file of at most {} KB", MAX_SOURCE_BYTES / 1024));
    }
    let source = tokio::fs::read_to_string(path).await.map_err(|e| format!("The file is not valid UTF-8 text: {e}"))?;
    let manifest = parse_manifest(&source)?;
    Ok((source, manifest))
}

fn check_source(source: &str) -> Result<Manifest, String> {
    if source.len() as u64 > MAX_SOURCE_BYTES {
        return Err(format!("Extensions must be a single file of at most {} KB", MAX_SOURCE_BYTES / 1024));
    }
    parse_manifest(source)
}

async fn write_extension(app: &AppHandle, source: String, manifest: &Manifest) -> Result<(), String> {
    let dir = extensions_dir(app)?.join(&manifest.id);
    tokio::fs::create_dir_all(&dir).await.map_err(|e| e.to_string())?;
    tokio::fs::write(dir.join("main.js"), source).await.map_err(|e| e.to_string())
}

/// Reads and validates an extension file without installing it, so the user can approve its permissions first.
#[tauri::command]
pub async fn ext_inspect(path: String) -> Result<Manifest, String> {
    read_source(&path).await.map(|(_, manifest)| manifest)
}

/// Copies an extension file into the app's data directory. Replaces an installed extension with the same id.
#[tauri::command]
pub async fn ext_install(app: AppHandle, path: String) -> Result<Manifest, String> {
    let (source, manifest) = read_source(&path).await?;
    write_extension(&app, source, &manifest).await?;
    Ok(manifest)
}

/// The source of an installed extension, for exporting it.
#[tauri::command]
pub async fn ext_read_source(app: AppHandle, id: String) -> Result<String, String> {
    if !valid_id(&id) {
        return Err("Invalid extension id".to_string());
    }
    tokio::fs::read_to_string(extensions_dir(&app)?.join(&id).join("main.js")).await.map_err(|e| e.to_string())
}

/// Like `ext_inspect`, for source text that came from an export file.
#[tauri::command]
pub async fn ext_inspect_source(source: String) -> Result<Manifest, String> {
    check_source(&source)
}

/// Like `ext_install`, for source text that came from an export file.
#[tauri::command]
pub async fn ext_install_source(app: AppHandle, source: String) -> Result<Manifest, String> {
    let manifest = check_source(&source)?;
    write_extension(&app, source, &manifest).await?;
    Ok(manifest)
}

/// Every installed extension, read from the manifest at the top of its `main.js`. Broken ones are skipped.
#[tauri::command]
pub async fn ext_list(app: AppHandle) -> Result<Vec<Manifest>, String> {
    let root = extensions_dir(&app)?;
    let mut found = Vec::new();
    let Ok(mut entries) = tokio::fs::read_dir(&root).await else {
        return Ok(found);
    };
    while let Ok(Some(entry)) = entries.next_entry().await {
        let Ok(source) = tokio::fs::read_to_string(entry.path().join("main.js")).await else { continue };
        match parse_manifest(&source) {
            Ok(manifest) if entry.file_name().to_string_lossy() == manifest.id => found.push(manifest),
            Ok(_) => log::warn!("Extension folder {:?} does not match its manifest id", entry.file_name()),
            Err(error) => log::warn!("Skipping extension {:?}: {error}", entry.file_name()),
        }
    }
    found.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(found)
}

#[tauri::command]
pub async fn ext_remove(app: AppHandle, id: String) -> Result<(), String> {
    if !valid_id(&id) {
        return Err("Invalid extension id".to_string());
    }
    let dir = extensions_dir(&app)?.join(&id);
    match tokio::fs::remove_dir_all(&dir).await {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// ---- serving the extension documents ----

static SERVER_PORT: OnceCell<u16> = OnceCell::const_new();

/// Where extension documents are loaded from: `http://127.0.0.1:<port>`. The server starts on first use and
/// listens on the loopback interface only.
#[tauri::command]
pub async fn ext_origin(app: AppHandle) -> Result<String, String> {
    let port = SERVER_PORT
        .get_or_try_init(|| async move {
            let listener = TcpListener::bind(("127.0.0.1", 0))
                .await
                .map_err(|e| format!("Cannot start the extension server: {e}"))?;
            let port = listener.local_addr().map_err(|e| e.to_string())?.port();
            tokio::spawn(async move {
                while let Ok((stream, _)) = listener.accept().await {
                    let app = app.clone();
                    tokio::spawn(async move {
                        let _ = tokio::time::timeout(Duration::from_secs(10), handle_connection(stream, app, port)).await;
                    });
                }
            });
            Ok::<u16, String>(port)
        })
        .await?;
    Ok(format!("http://127.0.0.1:{port}"))
}

async fn handle_connection(mut stream: TcpStream, app: AppHandle, port: u16) {
    let mut request = Vec::with_capacity(1024);
    let mut chunk = [0u8; 1024];
    let head_end = loop {
        match stream.read(&mut chunk).await {
            Ok(0) | Err(_) => return,
            Ok(n) => request.extend_from_slice(&chunk[..n]),
        }
        if let Some(at) = request.windows(4).position(|window| window == b"\r\n\r\n") {
            break at;
        }
        if request.len() > 8192 {
            return;
        }
    };
    let head = String::from_utf8_lossy(&request[..head_end]).into_owned();
    let (status, content_type, body) = match extensions_dir(&app) {
        Ok(dir) => route(&dir, &head, port),
        Err(_) => (500, "text/plain", b"error".to_vec()),
    };
    let reason = match status {
        200 => "OK",
        404 => "Not Found",
        405 => "Method Not Allowed",
        421 => "Misdirected Request",
        _ => "Error",
    };
    let header = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nContent-Security-Policy: {EXTENSION_CSP}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(header.as_bytes()).await;
    let _ = stream.write_all(&body).await;
    let _ = stream.shutdown().await;
}

/// Answers one request: `/_sdk.js`, `/<id>/index.html` (generated) and `/<id>/main.js`. Nothing else is served, so an
/// extension cannot read other files. A request whose `Host` is not our own address (DNS rebinding) is refused.
fn route(extensions: &Path, head: &str, port: u16) -> (u16, &'static str, Vec<u8>) {
    let not_found = (404, "text/plain", b"not found".to_vec());
    let mut lines = head.split("\r\n");
    let mut request_line = lines.next().unwrap_or("").split(' ');
    if request_line.next() != Some("GET") {
        return (405, "text/plain", b"method not allowed".to_vec());
    }
    let host_ok = lines.any(|line| {
        line.split_once(':')
            .is_some_and(|(name, value)| name.eq_ignore_ascii_case("host") && value.trim() == format!("127.0.0.1:{port}"))
    });
    if !host_ok {
        return (421, "text/plain", b"wrong host".to_vec());
    }
    let target = request_line.next().unwrap_or("");
    let path = target.split('?').next().unwrap_or("").trim_start_matches('/');
    if path == "_sdk.js" {
        return (200, "text/javascript; charset=utf-8", SDK_JS.as_bytes().to_vec());
    }
    let Some((id, file)) = path.split_once('/') else { return not_found };
    if !valid_id(id) {
        return not_found;
    }
    match file {
        "index.html" => {
            let html = format!(
                "<!doctype html><meta charset=\"utf-8\"><script src=\"/_sdk.js\"></script><script src=\"/{id}/main.js\"></script>"
            );
            (200, "text/html; charset=utf-8", html.into_bytes())
        }
        "main.js" => match std::fs::read(extensions.join(id).join("main.js")) {
            Ok(bytes) => (200, "text/javascript; charset=utf-8", bytes),
            Err(_) => not_found,
        },
        _ => not_found,
    }
}

// ---- network for extensions ----

#[derive(Deserialize)]
pub struct HttpRequest {
    url: String,
    #[serde(default)]
    method: Option<String>,
    #[serde(default)]
    headers: Vec<(String, String)>,
    #[serde(default)]
    body: Option<String>,
}

#[derive(Serialize)]
pub struct HttpResponse {
    status: u16,
    headers: Vec<(String, String)>,
    body: String,
}

/// Only http(s) URLs without credentials whose `host` or `host:port` is in the granted list.
fn check_allowed(url: &str, allowed_hosts: &[String]) -> Result<reqwest::Url, String> {
    let parsed = reqwest::Url::parse(url.trim()).map_err(|e| format!("Invalid URL: {e}"))?;
    if !matches!(parsed.scheme(), "http" | "https") || !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("Only plain http(s) URLs are allowed".to_string());
    }
    let host = parsed.host_str().ok_or("Missing host")?.to_ascii_lowercase();
    let with_port = format!("{host}:{}", parsed.port_or_known_default().unwrap_or(0));
    if allowed_hosts.iter().any(|a| a.eq_ignore_ascii_case(&host) || a.eq_ignore_ascii_case(&with_port)) {
        Ok(parsed)
    } else {
        Err(format!("The extension has no permission to reach {host}"))
    }
}

fn error_chain(error: &dyn std::error::Error) -> String {
    let mut text = error.to_string();
    let mut source = error.source();
    while let Some(next) = source {
        text.push_str(": ");
        text.push_str(&next.to_string());
        source = next.source();
    }
    text
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect()
}

/// Accepts exactly one certificate, identified by the SHA-256 of its DER form. The handshake fails for any
/// other certificate, so nothing (not even a request body) reaches a server that is not the one the user trusted.
#[derive(Debug)]
struct PinVerifier {
    pin: Vec<u8>,
    algorithms: WebPkiSupportedAlgorithms,
}

impl ServerCertVerifier for PinVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        if Sha256::digest(end_entity.as_ref()).as_slice() == self.pin.as_slice() {
            Ok(ServerCertVerified::assertion())
        } else {
            Err(rustls::Error::InvalidCertificate(CertificateError::ApplicationVerificationFailure))
        }
    }

    fn verify_tls12_signature(&self, message: &[u8], cert: &CertificateDer<'_>, dss: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls12_signature(message, cert, dss, &self.algorithms)
    }

    fn verify_tls13_signature(&self, message: &[u8], cert: &CertificateDer<'_>, dss: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls13_signature(message, cert, dss, &self.algorithms)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.algorithms.supported_schemes()
    }
}

fn pinned_tls(pin_hex: &str) -> Result<rustls::ClientConfig, String> {
    let pin: Vec<u8> = (0..pin_hex.len())
        .step_by(2)
        .map(|i| pin_hex.get(i..i + 2).and_then(|pair| u8::from_str_radix(pair, 16).ok()))
        .collect::<Option<_>>()
        .filter(|bytes: &Vec<u8>| bytes.len() == 32)
        .ok_or("The pinned certificate must be 64 hex characters (SHA-256)")?;
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let verifier = Arc::new(PinVerifier { pin, algorithms: provider.signature_verification_algorithms });
    let mut config = rustls::ClientConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .map_err(|e| e.to_string())?
        .dangerous()
        .with_custom_certificate_verifier(verifier)
        .with_no_client_auth();
    config.alpn_protocols = vec![b"http/1.1".to_vec()];
    Ok(config)
}

/// One HTTP request for an extension. Redirects are not followed (the extension reads `Location` itself).
/// A server whose certificate is not trusted fails with `cert_untrusted`; when `pinned_sha256` is given, only that
/// exact certificate is accepted and any other fails with `cert_mismatch`.
#[tauri::command]
pub async fn ext_http(request: HttpRequest, allowed_hosts: Vec<String>, pinned_sha256: Option<String>) -> Result<HttpResponse, String> {
    let url = check_allowed(&request.url, &allowed_hosts)?;
    let method = reqwest::Method::from_bytes(request.method.as_deref().unwrap_or("GET").to_ascii_uppercase().as_bytes())
        .map_err(|_| "Invalid HTTP method".to_string())?;
    if !matches!(method.as_str(), "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD") {
        return Err("Unsupported HTTP method".to_string());
    }
    if request.body.as_ref().is_some_and(|b| b.len() > MAX_HTTP_BYTES) {
        return Err("The request body is too large".to_string());
    }

    let mut builder = reqwest::Client::builder()
        .user_agent("Luna IRC extension")
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none());
    if let Some(pin) = pinned_sha256.as_deref() {
        builder = builder.use_preconfigured_tls(pinned_tls(pin)?);
    }
    let client = builder.build().map_err(|e| e.to_string())?;

    let mut call = client.request(method, url);
    for (name, value) in &request.headers {
        let lower = name.to_ascii_lowercase();
        if matches!(lower.as_str(), "host" | "content-length" | "transfer-encoding" | "connection") {
            return Err(format!("The {name} header cannot be set by an extension"));
        }
        call = call.header(name.as_str(), value.as_str());
    }
    if let Some(body) = request.body {
        call = call.body(body);
    }

    let mut response = call.send().await.map_err(|e| {
        let chain = error_chain(&e);
        if chain.contains("invalid peer certificate") {
            if pinned_sha256.is_some() { "cert_mismatch".to_string() } else { "cert_untrusted".to_string() }
        } else {
            chain
        }
    })?;
    let status = response.status().as_u16();
    let headers = response
        .headers()
        .iter()
        .map(|(name, value)| (name.as_str().to_string(), String::from_utf8_lossy(value.as_bytes()).into_owned()))
        .collect();
    let mut bytes: Vec<u8> = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        if bytes.len() + chunk.len() > MAX_HTTP_BYTES {
            return Err("The response is too large".to_string());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(HttpResponse { status, headers, body: String::from_utf8_lossy(&bytes).into_owned() })
}

/// SHA-256 of the certificate a server presents, read without sending anything but a bare `GET`.
/// The frontend shows it to the user, who decides whether to trust it (and the extension cannot influence that).
#[tauri::command]
pub async fn ext_probe_cert(url: String, allowed_hosts: Vec<String>) -> Result<String, String> {
    let url = check_allowed(&url, &allowed_hosts)?;
    if url.scheme() != "https" {
        return Err("Only https servers have a certificate".to_string());
    }
    let client = reqwest::Client::builder()
        .user_agent("Luna IRC extension")
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .danger_accept_invalid_certs(true)
        .tls_info(true)
        .build()
        .map_err(|e| e.to_string())?;
    let response = client.head(url).send().await.map_err(|e| error_chain(&e))?;
    let certificate = response
        .extensions()
        .get::<reqwest::tls::TlsInfo>()
        .and_then(|info| info.peer_certificate())
        .ok_or("The server did not present a certificate")?;
    Ok(sha256_hex(certificate))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manifest(extra: &str) -> String {
        format!("/* luna-extension\n{{\"id\":\"demo-ext\",\"name\":\"Demo\",\"version\":\"1.0.0\",\"api\":1{extra}}}\n*/\nluna.api;")
    }

    #[test]
    fn parses_a_manifest_from_the_first_comment() {
        let parsed = parse_manifest(&manifest(",\"permissions\":{\"network\":[\"host.example\"]}")).unwrap();
        assert_eq!(parsed.id, "demo-ext");
        assert_eq!(parsed.permissions.network, vec!["host.example"]);
    }

    #[test]
    fn rejects_bad_manifests() {
        assert!(parse_manifest("luna.api;").is_err());
        assert!(parse_manifest("/* something else {} */").is_err());
        assert!(parse_manifest(&manifest(",\"permissions\":{\"network\":[\"https://x/y\"]}")).is_err());
        assert!(parse_manifest("/* luna-extension {\"id\":\"../x\",\"name\":\"n\",\"version\":\"1\",\"api\":1} */").is_err());
        assert!(parse_manifest("/* luna-extension {\"id\":\"ok-id\",\"name\":\"n\",\"version\":\"1\",\"api\":2} */").is_err());
    }

    #[test]
    fn only_granted_hosts_are_reachable() {
        let allowed = vec!["paste.example.org".to_string(), "example.org:8443".to_string()];
        assert!(check_allowed("https://paste.example.org/paste", &allowed).is_ok());
        assert!(check_allowed("https://PASTE.example.org/x", &allowed).is_ok());
        assert!(check_allowed("https://example.org:8443/x", &allowed).is_ok());
        assert!(check_allowed("https://example.org/x", &allowed).is_err());
        assert!(check_allowed("https://evil.example/x", &allowed).is_err());
        assert!(check_allowed("https://user:pw@paste.example.org/x", &allowed).is_err());
        assert!(check_allowed("ftp://paste.example.org/x", &allowed).is_err());
    }

    #[test]
    fn serves_only_the_known_files_to_our_own_host() {
        let dir = std::env::temp_dir().join(format!("luna-ext-route-test-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("demo-ext")).unwrap();
        std::fs::write(dir.join("demo-ext").join("main.js"), "luna.api;").unwrap();
        let get = |path: &str, host: &str| route(&dir, &format!("GET {path} HTTP/1.1\r\nHost: {host}\r\nAccept: */*"), 4000);

        assert_eq!(get("/demo-ext/main.js", "127.0.0.1:4000").0, 200);
        assert_eq!(get("/demo-ext/main.js", "127.0.0.1:4000").2, b"luna.api;");
        assert_eq!(get("/demo-ext/index.html", "127.0.0.1:4000").0, 200);
        assert_eq!(get("/_sdk.js", "127.0.0.1:4000").0, 200);
        assert_eq!(get("/demo-ext/main.js?x=1", "127.0.0.1:4000").0, 200);

        assert_eq!(get("/demo-ext/main.js", "evil.example:4000").0, 421, "a rebound hostname must be refused");
        assert_eq!(get("/demo-ext/other.js", "127.0.0.1:4000").0, 404);
        assert_eq!(get("/../secret/main.js", "127.0.0.1:4000").0, 404);
        assert_eq!(get("/demo-ext/../main.js", "127.0.0.1:4000").0, 404);
        assert_eq!(get("/missing-ext/main.js", "127.0.0.1:4000").0, 404);
        assert_eq!(route(&dir, "POST /demo-ext/main.js HTTP/1.1\r\nHost: 127.0.0.1:4000", 4000).0, 405);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn pin_must_be_a_sha256_hex_string() {
        assert!(pinned_tls("zz").is_err());
        assert!(pinned_tls(&"ab".repeat(31)).is_err());
        assert!(pinned_tls(&"ab".repeat(32)).is_ok());
    }
}
