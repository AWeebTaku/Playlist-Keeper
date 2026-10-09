// Only the commands listed here exist for the frontend, and each needs an explicit capability.
const COMMANDS: &[&str] = &[
    "secret_get",
    "secret_set",
    "secret_delete",
    "browser_cookies",
    "browser_profiles",
    "default_browser",
    "http_fetch",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to run tauri-build");
}
