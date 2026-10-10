use std::path::PathBuf;
use std::process::Command;
use tauri_plugin_sql::{Migration, MigrationKind};

const SERVICE: &str = "dev.playlistkeeper.app";
/// Database file name inside the app config dir (`sqlite:keeper.db` on the JS side).
const DB_FILE: &str = "keeper.db";

// ---- secrets (OS keychain) -----------------------------------------------------------------

fn entry(key: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, key).map_err(|e| e.to_string())
}

#[tauri::command]
fn secret_get(key: String) -> Result<Option<String>, String> {
    match entry(&key)?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("secure storage unavailable: {e}")),
    }
}

#[tauri::command]
fn secret_set(key: String, value: String) -> Result<(), String> {
    entry(&key)?
        .set_password(&value)
        .map_err(|e| format!("secure storage unavailable: {e}"))
}

#[tauri::command]
fn secret_delete(key: String) -> Result<(), String> {
    match entry(&key)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("secure storage unavailable: {e}")),
    }
}

// ---- http ----------------------------------------------------------------------------------

struct HttpClient(reqwest::Client);

#[derive(serde::Deserialize)]
struct HttpRequest {
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
}

#[derive(serde::Serialize)]
struct HttpResponse {
    status: u16,
    headers: Vec<(String, String)>,
    body: String,
}

/// Only YouTube/Google hosts over https. The webview cannot send Cookie/Origin headers itself (it strips them),
/// so requests are made here, and this is the single place that decides where the app may talk to.
fn allowed(url: &url::Url) -> bool {
    let Some(host) = url.host_str() else {
        return false;
    };
    url.scheme() == "https"
        && ["youtube.com", "google.com", "googleapis.com"]
            .iter()
            .any(|d| host == *d || host.ends_with(&format!(".{d}")))
}

#[tauri::command]
async fn http_fetch(
    client: tauri::State<'_, HttpClient>,
    req: HttpRequest,
) -> Result<HttpResponse, String> {
    let url = url::Url::parse(&req.url).map_err(|e| e.to_string())?;
    if !allowed(&url) {
        return Err(format!(
            "blocked request to {}",
            url.host_str().unwrap_or("?")
        ));
    }
    let method = reqwest::Method::from_bytes(req.method.as_bytes()).map_err(|e| e.to_string())?;
    let mut rb = client.0.request(method, url);
    for (k, v) in req.headers {
        rb = rb.header(k, v);
    }
    if let Some(body) = req.body {
        rb = rb.body(body);
    }
    let res = rb.send().await.map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let headers = res
        .headers()
        .iter()
        .filter_map(|(k, v)| v.to_str().ok().map(|v| (k.to_string(), v.to_string())))
        .collect();
    let body = res.text().await.map_err(|e| e.to_string())?;
    Ok(HttpResponse {
        status,
        headers,
        body,
    })
}

// ---- browser cookies -----------------------------------------------------------------------

#[derive(serde::Serialize)]
struct Profile {
    /// Folder name of the profile (stable id for `browser_cookies`).
    id: String,
    /// Readable name, e.g. "default-release".
    label: String,
    /// Seconds since the epoch of the last cookie write; the most recent profile is the one in use.
    modified: u64,
}

fn home() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

/// Every Firefox `cookies.sqlite`, across the places Firefox keeps profiles (classic, XDG, snap, flatpak, macOS, Windows).
fn firefox_files() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Some(h) = home() {
        roots.extend([
            h.join(".mozilla/firefox"),
            h.join(".config/mozilla/firefox"),
            h.join("snap/firefox/common/.mozilla/firefox"),
            h.join(".var/app/org.mozilla.firefox/.mozilla/firefox"),
            h.join(".var/app/org.mozilla.firefox/config/mozilla/firefox"),
            h.join("Library/Application Support/Firefox/Profiles"),
        ]);
    }
    if let Some(a) = std::env::var_os("APPDATA") {
        roots.push(PathBuf::from(a).join("Mozilla/Firefox/Profiles"));
    }
    let mut files: Vec<PathBuf> = roots
        .iter()
        .filter_map(|r| std::fs::read_dir(r).ok())
        .flat_map(|rd| {
            rd.filter_map(|e| e.ok())
                .map(|e| e.path().join("cookies.sqlite"))
        })
        .filter(|p| p.is_file())
        .collect();
    files.sort();
    files.dedup();
    files
}

fn profile_id(file: &std::path::Path) -> String {
    file.parent()
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default()
}

fn modified(file: &std::path::Path) -> u64 {
    std::fs::metadata(file)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn cookie_header(mut cookies: Vec<rookie::common::enums::Cookie>) -> Option<String> {
    // the same cookie name exists for several subdomains; keep one per name, the ".youtube.com" one first
    cookies.retain(|c| c.domain.trim_start_matches('.').ends_with("youtube.com"));
    cookies.sort_by_key(|c| c.domain != ".youtube.com");
    let mut seen = std::collections::HashSet::new();
    let pairs: Vec<String> = cookies
        .into_iter()
        .filter(|c| seen.insert(c.name.clone()))
        .map(|c| format!("{}={}", c.name, c.value))
        .collect();
    pairs
        .iter()
        .any(|p| p.starts_with("__Secure-3PAPISID="))
        .then(|| pairs.join("; "))
}

fn domains() -> Option<Vec<String>> {
    Some(vec!["youtube.com".to_string()])
}

fn firefox_header(file: &std::path::Path) -> Option<String> {
    cookie_header(rookie::any_browser(file.to_str()?, domains(), None).ok()?)
}

/// Firefox profiles that are signed in to YouTube, most recently used first.
/// For other browsers an empty list is returned (they use their default profile).
#[tauri::command]
fn browser_profiles(browser: String) -> Vec<Profile> {
    if browser != "firefox" {
        return vec![];
    }
    let mut v: Vec<Profile> = firefox_files()
        .iter()
        .filter(|f| firefox_header(f).is_some())
        .map(|f| {
            let id = profile_id(f);
            let label = id
                .split_once('.')
                .map(|(_, n)| n.to_string())
                .unwrap_or_else(|| id.clone());
            Profile {
                id,
                label,
                modified: modified(f),
            }
        })
        .collect();
    v.sort_by_key(|p| std::cmp::Reverse(p.modified));
    v
}

/// Cookie header ("a=b; c=d") with the YouTube cookies of `browser`, or an error if it is not signed in.
/// `profile` (Firefox only) must be one of the ids from `browser_profiles`; default is the most recently used.
#[tauri::command]
fn browser_cookies(browser: String, profile: Option<String>) -> Result<String, String> {
    if browser == "firefox" {
        let mut files = firefox_files();
        files.sort_by_key(|f| std::cmp::Reverse(modified(f)));
        if let Some(id) = &profile {
            files.retain(|f| &profile_id(f) == id); // only discovered profiles are accepted, never an arbitrary path
        }
        return files.iter().find_map(|f| firefox_header(f)).ok_or_else(|| {
            "firefox is not signed in to YouTube (or no Firefox profile was found)".to_string()
        });
    }
    let cookies = match browser.as_str() {
        "librewolf" => rookie::librewolf(domains()),
        "chrome" => rookie::chrome(domains()),
        "chromium" => rookie::chromium(domains()),
        "edge" => rookie::edge(domains()),
        "brave" => rookie::brave(domains()),
        "vivaldi" => rookie::vivaldi(domains()),
        "opera" => rookie::opera(domains()),
        #[cfg(target_os = "macos")]
        "safari" => rookie::safari(domains()),
        other => return Err(format!("unsupported browser: {other}")),
    }
    .map_err(|e| format!("could not read {browser} cookies: {e}"))?;
    cookie_header(cookies).ok_or_else(|| format!("{browser} is not signed in to YouTube"))
}

fn browser_from(text: &str) -> Option<&'static str> {
    let t = text.to_lowercase();
    // order matters: "chromium" contains "chrom", "librewolf" is a Firefox fork
    [
        ("librewolf", "librewolf"),
        ("firefox", "firefox"),
        ("mozilla", "firefox"),
        ("brave", "brave"),
        ("vivaldi", "vivaldi"),
        ("opera", "opera"),
        ("msedge", "edge"),
        ("edge", "edge"),
        ("chromium", "chromium"),
        ("chrome", "chrome"),
        ("safari", "safari"),
    ]
    .iter()
    .find(|(needle, _)| t.contains(needle))
    .map(|(_, name)| *name)
}

fn capture(cmd: &str, args: &[&str]) -> Option<String> {
    let out = Command::new(cmd).args(args).output().ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Normalised name of the system's default web browser, if it can be determined.
#[tauri::command]
fn default_browser() -> Option<String> {
    #[cfg(target_os = "linux")]
    let raw = capture("xdg-settings", &["get", "default-web-browser"])
        .or_else(|| capture("xdg-mime", &["query", "default", "x-scheme-handler/https"]));
    #[cfg(target_os = "windows")]
    let raw = capture(
        "reg",
        &[
            "query",
            r"HKCU\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice",
            "/v",
            "ProgId",
        ],
    );
    #[cfg(target_os = "macos")]
    let raw = capture(
        "defaults",
        &[
            "read",
            "com.apple.LaunchServices/com.apple.launchservices.secure",
            "LSHandlers",
        ],
    )
    .and_then(|s| {
        // the handler block that mentions the https scheme names the bundle id
        let i = s.find("LSHandlerURLScheme = https")?;
        let start = s[..i].rfind('{').unwrap_or(0);
        let end = s[i..].find('}').map(|e| i + e).unwrap_or(s.len());
        Some(s[start..end].to_string())
    })
    .or_else(|| Some("safari".to_string()));
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    let raw: Option<String> = None;
    raw.as_deref().and_then(browser_from).map(str::to_string)
}

// ---- updates -----------------------------------------------------------------------------------

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateSupport {
    supported: bool,
    reason: Option<String>,
    releases_url: Option<String>,
}

#[derive(Clone, Copy, PartialEq, Debug)]
enum Packaging {
    Deb,
    Rpm,
    Other,
}

/// Why in-app updating cannot work for this install, if it cannot. A deb or rpm install is updated by running `dpkg` / `rpm`;
/// a package repacked for another distribution (the Arch package is made from the deb) has the marker but not the tool.
fn why_not(p: Packaging, has_dpkg: bool, has_rpm: bool) -> Option<&'static str> {
    match p {
        Packaging::Deb if !has_dpkg => Some("This copy was installed from a package that this system's package manager manages, so the app cannot update itself. Install the new package from the releases page."),
        Packaging::Rpm if !has_rpm => Some("This copy was installed from a package that this system's package manager manages, so the app cannot update itself. Install the new package from the releases page."),
        _ => None,
    }
}

fn on_path(program: &str) -> bool {
    std::env::var_os("PATH")
        .is_some_and(|p| std::env::split_paths(&p).any(|d| d.join(program).is_file()))
}

/// "https://github.com/OWNER/REPO/releases/latest/download/latest.json" -> "https://github.com/OWNER/REPO/releases/latest".
/// A build that still has the placeholder repository has no releases page.
fn releases_page(endpoint: &str) -> Option<String> {
    let rest = endpoint.strip_prefix("https://github.com/")?;
    let (repo, _) = rest.split_once("/releases/")?;
    (repo != "OWNER/REPO").then(|| format!("https://github.com/{repo}/releases/latest"))
}

#[tauri::command]
fn update_support(app: tauri::AppHandle) -> UpdateSupport {
    use tauri::utils::config::BundleType;
    let packaging = match tauri::utils::platform::bundle_type() {
        Some(BundleType::Deb) => Packaging::Deb,
        Some(BundleType::Rpm) => Packaging::Rpm,
        _ => Packaging::Other,
    };
    let releases_url = app
        .config()
        .plugins
        .0
        .get("updater")
        .and_then(|u| u.get("endpoints"))
        .and_then(|e| e.get(0))
        .and_then(|e| e.as_str())
        .and_then(releases_page);
    let reason = why_not(packaging, on_path("dpkg"), on_path("rpm")).map(str::to_string);
    UpdateSupport {
        supported: reason.is_none(),
        reason,
        releases_url,
    }
}

// ---- data ------------------------------------------------------------------------------------

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initial schema",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "playlist cover art",
            sql: include_str!("../migrations/002_playlist_thumb.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    if cfg!(debug_assertions) {
        // dev only: the webview's console shows up in the terminal running `tauri dev`
        builder = builder.plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        );
    }
    builder
        .manage(HttpClient(
            reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(60))
                .build()
                .expect("http client"),
        ))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&format!("sqlite:{DB_FILE}"), migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            secret_get,
            secret_set,
            secret_delete,
            browser_cookies,
            browser_profiles,
            default_browser,
            http_fetch,
            update_support
        ])
        .run(tauri::generate_context!())
        .expect("error while running Playlist Keeper");
}

#[cfg(test)]
mod tests {
    use super::{browser_from, releases_page, why_not, Packaging};

    #[test]
    fn maps_desktop_ids_and_prog_ids() {
        assert_eq!(browser_from("firefox.desktop"), Some("firefox"));
        assert_eq!(browser_from("google-chrome.desktop"), Some("chrome"));
        assert_eq!(browser_from("chromium.desktop"), Some("chromium"));
        assert_eq!(
            browser_from("    ProgId    REG_SZ    MSEdgeHTM"),
            Some("edge")
        );
        assert_eq!(browser_from("FirefoxURL-308046B0AF4A39CB"), Some("firefox"));
        assert_eq!(browser_from("BraveHTML"), Some("brave"));
        assert_eq!(browser_from("com.apple.Safari"), Some("safari"));
        assert_eq!(browser_from("librewolf.desktop"), Some("librewolf"));
        assert_eq!(browser_from("something-else"), None);
    }

    #[test]
    fn in_app_updates_need_the_tool_that_installs_the_package() {
        assert!(why_not(Packaging::Deb, true, false).is_none()); // Debian, Ubuntu
        assert!(why_not(Packaging::Rpm, false, true).is_none()); // Fedora, openSUSE
        assert!(why_not(Packaging::Deb, false, false).is_some()); // the Arch package: deb marker, no dpkg
        assert!(why_not(Packaging::Rpm, true, false).is_some());
        assert!(why_not(Packaging::Other, false, false).is_none()); // AppImage, Windows, macOS
    }

    #[test]
    fn finds_the_releases_page_from_the_update_feed_url() {
        assert_eq!(
            releases_page(
                "https://github.com/me/Playlist-Keeper/releases/latest/download/latest.json"
            )
            .as_deref(),
            Some("https://github.com/me/Playlist-Keeper/releases/latest")
        );
        assert_eq!(
            releases_page("https://github.com/OWNER/REPO/releases/latest/download/latest.json"),
            None
        );
        assert_eq!(releases_page("https://example.com/latest.json"), None);
    }

    #[test]
    fn only_youtube_and_google_over_https_are_allowed() {
        let ok = |s: &str| super::allowed(&url::Url::parse(s).unwrap());
        assert!(ok("https://music.youtube.com/youtubei/v1/browse"));
        assert!(ok("https://www.youtube.com/o/oauth2/device/code"));
        assert!(ok("https://oauth2.googleapis.com/token"));
        assert!(!ok("http://music.youtube.com/"));
        assert!(!ok("https://evil.com/?https://youtube.com"));
        assert!(!ok("https://notyoutube.com/"));
        assert!(!ok("https://youtube.com.evil.com/"));
    }

    /// Developer check against the real browsers on this machine: `cargo test -- --ignored --nocapture`.
    /// Prints counts only, never cookie values.
    #[test]
    #[ignore]
    fn live_browser_cookies() {
        for b in ["firefox", "chrome", "brave", "edge", "chromium"] {
            match super::browser_cookies(b.to_string(), None) {
                Ok(c) => println!("{b}: signed in, {} cookies", c.split("; ").count()),
                Err(e) => println!("{b}: {e}"),
            }
        }
        for p in super::browser_profiles("firefox".into()) {
            println!("firefox profile {} (modified {})", p.label, p.modified);
        }
        println!("default browser: {:?}", super::default_browser());
    }
}
