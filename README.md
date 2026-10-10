# Playlist Keeper

A desktop app for Windows, macOS and Linux that keeps a local history of **your own YouTube Music playlists**.

YouTube removes songs and videos, or greys them out, without telling you, and once an entry is gone you can no longer
tell what it was. Playlist Keeper saves a copy of every entry (title, artist, length, thumbnail) on your computer, flags
what disappeared, and helps you replace lost tracks, find duplicates, compare playlists and tidy titles. Everything
runs locally; nothing is sent anywhere except to YouTube itself.

> Unofficial. Not affiliated with YouTube or Google. It talks to YouTube Music the same way a browser does, through the
> account you are already signed in to, so changes in YouTube can break it.

## Contents

1. [Features](#features)
2. [Install and first launch](#install-and-first-launch)
3. [Signing in](#signing-in)
4. [How it works](#how-it-works)
5. [Build from source: requirements and setup](#build-from-source-requirements-and-setup)
6. [Dependencies, one by one](#dependencies-one-by-one)
7. [Develop](#develop)
8. [Releasing and auto-update](#releasing-and-auto-update)
9. [Security and privacy](#security-and-privacy)
10. [Troubleshooting](#troubleshooting)
11. [Project layout](#project-layout)

## Features

| Screen | What it does |
|---|---|
| **Items** | Every saved track with thumbnail, length and status (OK, **Greyed out**, **Removed**). *Find replacement* searches songs and videos for a re-upload; *Accept* adds it and removes the greyed-out original. List or grid view. |
| **Short tracks** | Anime openings/endings, intros and outros are often a cut of a longer song. *Find full version* searches by song name plus show name and ranks longer results. *Add* keeps the clip; *Replace* removes it. Shows when the full version is already in a playlist. |
| **Compare** | *Where else is each track?* lists the other playlists that already hold a track (same video, or same song and version). *Playlist A vs B* shows only in A, in both, only in B, with an Add button on each side. |
| **Cleanup** | Tidier titles: "(Official Video)", "[Lyrics]", "HD" and similar are removed; remix, cover, slowed, mashup and other versions are kept. Every cleaned name is editable. Cleaned names live only in this app (YouTube cannot rename other people's videos). |
| **Duplicates** | *Exact* (same video twice), *likely* (same song, version, artist and length, e.g. video vs lyric video) and *possible* (same title, different artist or length; never pre-selected). Covers, remixes, mashups and slowed versions are never grouped with the original. You choose the copy to keep and confirm before anything is removed. |
| **Sidebar** | A full-width **Sync all** button that fills up as it syncs, playlist search, and your playlists in sections: **Playlists**, and below them **Hidden** when "Show hidden" is on. Hide or unhide a playlist with the eye button on its row (hidden playlists are skipped by sync). The **Hidden** button next to the layout buttons shows or hides that section. Four layouts, chosen with the buttons above the list and remembered: **list with covers**, **cover grid**, **compact list** and **detailed cards**. |
| **Home** | The start page: a greeting, your totals (playlists, tracks saved, greyed out or removed, last synced), a **Needs attention** list of the playlists with the most lost tracks, and a Sync button that stands out when your last sync is more than a day old. Click the logo or **Home** in the sidebar to return to it. |
| **Profile card** | Your Google account photo and name at the top right. Click it for the **theme** switcher (System, Light, Dark), **Check for updates** (with install and restart when one is available), **Reconnect** (use another browser or account; your current login stays until the new one works) and **Log out** (removes the saved login; your saved playlist history stays on this computer). |

The look follows YouTube Music: near-black with a soft rose-coral glow, frosted-glass panels, blurred cover art behind the playlist
title, Roboto, and a clean white light theme.

Nothing on YouTube is changed without a confirmation dialog (Accept, Replace, Remove). Add and Compare's Add are single
clicks because they only add.

## Install and first launch

Download the installer for your system from the project's **Releases** page (file names look like
`playlist-keeper_x.y.z_...` on Linux, `Playlist Keeper_x.y.z_...` on Windows and macOS; GitHub may show spaces as dots). After the first install the app updates itself (it asks
before installing an update).

These builds are **not code-signed** (a deliberate choice), so the first launch needs one extra step:

| System | File to download | First launch |
|---|---|---|
| **Windows 10/11** | `Playlist Keeper_x.y.z_x64-setup.exe` (installs for the current user, no admin rights) or the `.msi` | SmartScreen shows "Windows protected your PC": click **More info**, then **Run anyway**. Needs the Microsoft Edge WebView2 runtime, which is already part of Windows 11 and current Windows 10. |
| **macOS 11+** (Apple silicon and Intel) | `Playlist Keeper_x.y.z_universal.dmg` | Drag the app to Applications. On macOS 14 and earlier: right-click the app, **Open**, **Open**. On macOS 15 and later: try to open it once, then **System Settings > Privacy & Security > Open Anyway**. Or in Terminal: `xattr -dr com.apple.quarantine "/Applications/Playlist Keeper.app"`. |
| **Debian, Ubuntu, Mint, Pop!_OS** | `playlist-keeper_x.y.z_amd64.deb` | `sudo apt install ./playlist*.deb` (pulls in WebKitGTK and the other runtime libraries). |
| **Fedora, RHEL-likes, openSUSE** | `playlist-keeper-x.y.z-1.x86_64.rpm` | Fedora: `sudo dnf install ./playlist*.rpm`. openSUSE: `sudo zypper install ./playlist*.rpm`. |
| **Arch, Manjaro, EndeavourOS** | `playlist-keeper-x.y.z-1-x86_64.pkg.tar.zst` | `sudo pacman -U playlist-keeper-*.pkg.tar.zst` (pulls in `webkit2gtk-4.1` and `gtk3`). |
| **Any glibc Linux (Gentoo, NixOS, ...)** | `playlist-keeper_x.y.z_amd64.AppImage` | `chmod +x playlist*.AppImage && ./playlist*.AppImage`. If it complains about FUSE: install `libfuse2` (Ubuntu 24.04: `libfuse2t64`) or run `./playlist*.AppImage --appimage-extract-and-run`. On Arch you can also build from source (below). |

The apps update themselves where the system allows it: the AppImage, `.deb` and `.rpm` (the update asks for your
password to run `dpkg` or `rpm`), Windows and macOS. The Arch package is managed by `pacman`, so there the profile card
shows "Version x is available" and opens the releases page; install the new `.pkg.tar.zst` yourself. Each release also
contains `SHA256SUMS.txt` to verify downloads.

Linux also needs a **Secret Service** provider running (it holds your login): GNOME Keyring or KWallet (both are
present on a normal GNOME/KDE desktop), or KeePassXC. On a minimal window manager install and start one, for example
`gnome-keyring`.

## Signing in

Playlist Keeper reads the YouTube cookies of a browser that is **already signed in to YouTube Music**, so it uses the
account you already have; you never type a password into the app.

1. Sign in to https://music.youtube.com in your normal browser (the Connect screen has an **Open music.youtube.com**
   button that opens your default browser).
2. In the app, pick the browser (your default one is listed first and marked) and click **Use this account**. If a
   browser has several signed-in profiles (Firefox), pick one. Supported: Firefox (profiles in the classic, XDG, snap,
   flatpak, macOS and Windows locations), Chrome, Edge, Brave, Chromium, Vivaldi, Opera, LibreWolf.
3. The app tests the login against YouTube before saving it to the system keychain.

**Chrome on Windows 127 or newer** encrypts cookies in a way other apps cannot read. Use Firefox, or open the
**Paste a cookie instead** box on the Connect screen: in Chrome press F12, open **Network**, click any request to
`music.youtube.com`, and copy the `cookie` request header.

Cookies expire after a while. When YouTube stops accepting the login the app returns to the Connect screen; sign in
again. Google's "device code" login (account chooser) was built and tested but YouTube Music answers HTTP 400 to its
tokens, so it was dropped.

## How it works

- **Sync** reads every non-hidden playlist (three at a time) from YouTube Music's own responses and compares it with the
  saved copy. A track YouTube greys out is marked *Greyed out* but keeps its saved title and artist; a track that is no
  longer listed is marked *Removed*. A playlist that comes back empty while the saved copy is not is treated as a failed
  read, never as "everything was removed". Auto-generated mixes that cannot be read are skipped and reported.
- **Covers and titles** are refreshed in the background every time the app starts, from the library list alone (no tracks are read), so new playlists and their cover art appear without a full sync.
- **Cleaning** removes packaging words (official video, lyrics, HD, ...) and splits `Artist - Title` when the uploader is
  a channel. Anything else in brackets counts as a *version* (remix, cover, slowed, an unknown label), so two different
  versions are never merged. A missed duplicate is cheaper than a wrongly removed track.
- **Greyed out is not always deleted.** YouTube Music greys out entries it cannot play (licensing, region, removed
  music video). Many still exist on youtube.com, which is why replacements are searched rather than assumed.
- **Short clips**: the search uses the song name plus the show name (for example `Renegade GANGSTA.`), because the
  song name alone is too generic. A full version must be clearly longer than the clip.

## Build from source: requirements and setup

Skip this section if you only want to use the app. You need four things: **Git**, **Node.js**, **Rust**, and the
**system libraries Tauri uses for its window**. Everything else is downloaded by `npm ci` and `cargo`.

Check what you already have:

```
git --version
node -v        # needs 22.13 or newer (24 LTS recommended)
npm -v
rustc --version && cargo --version
```

### 1. Git

- **Windows**: `winget install --id Git.Git -e` (or https://git-scm.com/download/win)
- **macOS**: `xcode-select --install` (included) or `brew install git`
- **Linux**: `sudo apt install git` / `sudo dnf install git` / `sudo pacman -S git` / `sudo zypper in git` / `sudo apk add git`

### 2. Node.js (with npm)

Download the **LTS** version from https://nodejs.org, or:

- **Windows**: `winget install --id OpenJS.NodeJS.LTS -e`
- **macOS**: `brew install node` (or the installer from nodejs.org); check `node -v` afterwards
- **Linux**: your distribution's package may be too old; use https://nodejs.org, `nvm` (https://github.com/nvm-sh/nvm,
  then `nvm install 24`), or `fnm`. Arch: `sudo pacman -S nodejs npm`. Fedora: `sudo dnf install nodejs npm` (check `node -v`).

Version 22.13 or newer is required (22 LTS, 24 LTS or 26+). Odd-numbered releases such as 23 or 25 are not supported by
the test runner.

### 3. Rust

- **Linux and macOS**: `curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh`, then restart the terminal
  (or `. ~/.cargo/env`).
- **Windows** (PowerShell): `winget install --id Rustlang.Rustup`, then restart the terminal and make sure the MSVC
  toolchain is the default: `rustup default stable-msvc`.

Use a current stable Rust (developed with 1.99); `rustup update` keeps it current. The installer puts everything in
your home directory (`~/.cargo`, `~/.rustup`); no administrator rights are needed.

### 4. System libraries and compilers (per operating system)

These follow Tauri's own list (https://v2.tauri.app/start/prerequisites/) plus three extra packages this project
needs: the D-Bus development files (for the keychain on Linux), `pkg-config`, and `patchelf` (only for building an
AppImage).

#### Windows

1. **Microsoft C++ Build Tools**: install "Build Tools for Visual Studio" from https://visualstudio.microsoft.com/visual-cpp-build-tools/
   and tick the **Desktop development with C++** workload. (`winget install --id Microsoft.VisualStudio.2022.BuildTools`
   works too; add the workload in the installer.)
2. **WebView2**: preinstalled on Windows 11 and current Windows 10. If missing, install the *Evergreen Bootstrapper* from
   https://developer.microsoft.com/microsoft-edge/webview2/.
3. **VBSCRIPT** is needed only to build the `.msi`: Settings > Apps > Optional features > More Windows features (it is
   normally on). The NSIS `.exe` installer does not need it.
4. WiX (for the `.msi`) and NSIS (for the `.exe`) are downloaded automatically by Tauri on first build.

#### macOS

- Install the Command Line Tools: `xcode-select --install` (the full Xcode app is not required for desktop builds).
- Optional but handy: Homebrew (https://brew.sh) for Node.

#### Linux

| Distribution | Command |
|---|---|
| **Debian, Ubuntu, Mint, Pop!_OS** | `sudo apt update`<br>`sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libdbus-1-dev pkg-config patchelf` |
| **Arch, Manjaro, EndeavourOS** | `sudo pacman -Syu`<br>`sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg xdotool dbus pkgconf patchelf` |
| **Fedora, RHEL, Rocky, Alma** | `sudo dnf check-update`<br>`sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel libxdo-devel dbus-devel pkgconf-pkg-config patchelf`<br>`sudo dnf group install "c-development"` |
| **openSUSE (Tumbleweed, Leap)** | `sudo zypper up`<br>`sudo zypper in webkit2gtk3-devel libopenssl-devel curl wget file libappindicator3-1 librsvg-devel dbus-1-devel pkg-config patchelf`<br>`sudo zypper in -t pattern devel_basis` |
| **Alpine** | `sudo apk add build-base webkit2gtk-4.1-dev curl wget file openssl libayatana-appindicator-dev librsvg dbus-dev pkgconf patchelf` |
| **Gentoo** | `sudo emerge --ask net-libs/webkit-gtk:4.1 dev-libs/libayatana-appindicator net-misc/curl net-misc/wget sys-apps/file sys-apps/dbus dev-util/pkgconf dev-util/patchelf` |
| **NixOS** | Use a dev shell; see https://wiki.nixos.org/wiki/Tauri (add `dbus`, `pkg-config`, `openssl`, `webkitgtk_4_1`, `librsvg`, `libayatana-appindicator`, `patchelf`, `nodejs`, `rustup`). |
| **Fedora Atomic, Silverblue, openSUSE Aeon (rpm-ostree)** | Build inside a toolbox/distrobox container with the Fedora or openSUSE row above. |

Only the Arch row was run end to end for this project; the other rows come from Tauri's documentation and the CI
builds on Ubuntu. If a package name changed in your release, the Tauri prerequisites page is authoritative.

On a Linux desktop you also need a **Secret Service** provider (GNOME Keyring, KWallet, or KeePassXC) to run the app.

### 5. Get the code and run it

```
git clone <your repository url> playlist-keeper
cd playlist-keeper
npm ci                  # installs the exact versions from package-lock.json
npm run tauri dev       # first start compiles the Rust side (about 5 minutes), later starts take seconds
```

`npm run tauri build` produces the installers for the operating system you run it on (cross-building is not
supported, which is why Windows and macOS installers come from the GitHub workflows):

| OS | Output folder `src-tauri/target/release/bundle/` |
|---|---|
| Linux | `deb/*.deb`, `rpm/*.rpm`, `appimage/*.AppImage` |
| Windows | `msi/*.msi`, `nsis/*-setup.exe` |
| macOS | `dmg/*.dmg`, `macos/*.app` |

A local `build` also creates update packages and therefore needs the update-signing key (see
[Releasing](#releasing-and-auto-update)):

```
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/playlist-keeper.key)" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" npm run tauri build
```

(Windows PowerShell: `$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $HOME\.tauri\playlist-keeper.key -Raw; $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""`, then `npm run tauri build`.)
To build without update packages, run `node scripts/ci-config.mjs --no-updater-artifacts` first (it edits
`tauri.conf.json`; revert it with git afterwards).

## Dependencies, one by one

### What you install yourself

| Dependency | Why | Version | Where to get it |
|---|---|---|---|
| Git | clone the project, push releases | any recent | see step 1 |
| Node.js + npm | build the web UI, run tests and the Tauri CLI | 22.13+ (24 LTS recommended) | https://nodejs.org |
| Rust (rustup, cargo) | compile the native shell | current stable | https://rustup.rs |
| Tauri system libraries | the native window (WebKitGTK on Linux, WebView2 on Windows, WKWebView on macOS) | see step 4 | OS package manager |
| C/C++ toolchain | linking the Rust code | MSVC Build Tools / Xcode CLT / gcc | see step 4 |
| D-Bus dev files + `pkg-config` (Linux) | the keychain crate talks to the Secret Service over D-Bus | any | see step 4 |
| `patchelf` (Linux, AppImage only) | repackages libraries into the AppImage | any | see step 4 |
| A Secret Service provider (Linux, to **run**) | stores your login | GNOME Keyring / KWallet / KeePassXC | your desktop or package manager |
| A signed-in browser | the account the app uses | Firefox, Chrome, Edge, Brave, ... | the browser's site |

### Installed automatically (`npm ci` and `cargo`)

JavaScript, runtime (`dependencies`):

| Package | Purpose |
|---|---|
| `youtubei.js` | YouTube Music session, search, add and remove (unofficial client) |
| `@tauri-apps/api` | calls from the UI into the Rust shell |
| `@tauri-apps/plugin-sql` | SQLite database access |
| `@tauri-apps/plugin-opener` | opens music.youtube.com in the default browser |
| `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process` | check for, install and restart into updates |
| `@tauri-apps/plugin-log` | forwards the webview console to the terminal during development |
| `phosphor-svelte` | the icon set (only the icons that are used end up in the app) |
| `@fontsource-variable/roboto` | the Roboto font files, bundled so the app looks the same offline on every system (only the Latin subsets are included; other scripts use the system font) |

JavaScript, build and test (`devDependencies`): `@tauri-apps/cli` (build and package), `vite` and
`@sveltejs/vite-plugin-svelte` (bundler), `svelte` (UI), `typescript`, `svelte-check`, `eslint` with `typescript-eslint`,
`eslint-plugin-svelte`, `@eslint/js` and `globals` (lint), `vitest` (tests), `@types/node` (typings for the tests, which
use Node's built-in SQLite).

Rust crates (`src-tauri/Cargo.toml`):

| Crate | Purpose |
|---|---|
| `tauri` and `tauri-build` | the app framework |
| `tauri-plugin-sql` (SQLite) | database and migrations |
| `tauri-plugin-opener`, `tauri-plugin-updater`, `tauri-plugin-process`, `tauri-plugin-log` | open links, auto-update, restart, dev logging |
| `keyring` | stores the login in the OS keychain (Windows Credential Manager, macOS Keychain, Secret Service) |
| `rookie` | reads browser cookies (Chromium and Firefox families) |
| `reqwest` (rustls) | the single HTTP path to YouTube/Google, with a host allow-list |
| `url`, `serde`, `serde_json`, `log` | URL checks, data conversion, logging |

Exact versions are pinned by `package-lock.json` and `src-tauri/Cargo.lock`; always install with `npm ci`, not
`npm install`. Check for known vulnerabilities with `npm audit` (CI also audits the Rust crates).

### Downloaded by tooling during a build

- **Linux AppImage**: `linuxdeploy` and its AppImage plugin, fetched by Tauri into `~/.cache/tauri` (needs internet on
  the first build). If the download times out, fetch the file named in the error with `curl -L -o` into that folder and
  `chmod +x` it. On rolling distributions whose `strip` is newer than the bundled tools, build with `NO_STRIP=1`.
- **Windows**: WiX and NSIS, downloaded by Tauri into `%LOCALAPPDATA%\tauri`.
- **CI** uses these GitHub Actions: `actions/checkout`, `actions/setup-node`, `actions/upload-artifact`,
  `dtolnay/rust-toolchain`, `swatinem/rust-cache`, `tauri-apps/tauri-action`, `actions-rust-lang/audit`.

## Develop

```
npm run tauri dev      # run with hot reload
npm test               # unit tests (Vitest; the database tests use real SQLite via node:sqlite)
npm run check          # svelte-check + eslint + colour-contrast check of the design tokens
npm run contrast       # only the contrast check (every text/background colour pair, light and dark, WCAG AA)
cargo clippy --all-targets -- -D warnings   # run inside src-tauri/
cargo test --lib                            # run inside src-tauri/
```

**End-to-end self-test inside the real app** (needs a browser signed in to YouTube Music; prints counts only, never
cookies):

```
VITE_SELFTEST=1 npm run tauri dev       # sign-in, library, read a playlist, search, sync, replacements, duplicates, compare
VITE_SELFTEST=write npm run tauri dev   # the same, plus: creates ONE throwaway playlist, adds / replaces / removes tracks, deletes it
VITE_OPEN="My Playlist" VITE_TAB=short npm run tauri dev   # open a playlist and a tab on start
```

Look-and-feel check without YouTube, Tauri or any personal data: run `npm run dev` and open
`http://127.0.0.1:1420/?mock=1` in a browser (dev builds only). It fills the app with fake playlists and tracks. Add
`&theme=dark|light`, `&view=list|grid|compact|cards`, `&open=Late%20Night%20Drive`, `&tab=items|short|compare|clean|dupes`,
`&menu=1`, `&hidden=1`, `&update=1`, `&empty=1`, `&screen=connect|connect-back`. Headless Chrome can screenshot these pages.

More look-only options inside the real app: `VITE_THEME=light|dark`, `VITE_VIEW=list|grid|compact|cards` (playlist layout),
`VITE_MENU=1` (profile card open), `VITE_HIDDEN=1` (show the Hidden section), `VITE_FAKEUPDATE=1` (pretend an update is
available), `VITE_CONNECT=1` (show the Connect screen without signing out).

(Windows PowerShell: `$env:VITE_SELFTEST = "1"; npm run tauri dev`.) These are compiled out of release builds.

## Releasing and auto-update

Releases are automatic. `.github/workflows/release.yml` builds installers on GitHub Actions and publishes a GitHub
release with a feed (`latest.json`) that the installed apps check on start and from **Check for updates**; the app asks
before installing. Updates are verified with Tauri's update key; this is separate from OS code signing, which is not
used (see [Install](#install-and-first-launch) for the first-launch warnings).

| What you do | What happens |
|---|---|
| **Push to `master`** with changes to the app (`src/`, `src-tauri/`, `package*.json`, config) | Checks run, then **Linux (deb, rpm, AppImage, Arch package) and Windows (exe, msi)** are built and published as the next patch version (0.1.0, then 0.1.1, 0.1.2, ...), with release notes generated from the commits. |
| Push only docs, tests, dev tooling or workflow files, or put **`[skip release]`** in the commit message | Nothing is released. |
| **Actions > release > Run workflow**, pick `minor` or `major` | A full release including **macOS** (universal dmg, Apple silicon and Intel). Tick "Include macOS" to add macOS to a patch release. |
| Run workflow with **dry run** ticked | Builds Linux only and attaches the installers to the run; publishes nothing. Use it to test changes to the workflow. |
| Push a tag `vX.Y.Z` yourself | Exactly that version on all three systems. |

How it works: the version is computed from the existing release tags and written into the build only (nothing is
committed, so there is no bot commit), tests, lint, audit and the Rust lint gate everything, and a release is created
**only if every build succeeded**, with all files at once, so users are never offered a half-built release. A release
without macOS has no macOS entry in the feed; macOS apps then simply report no update until the next release that has one.

macOS is limited to minor and major releases on purpose: GitHub counts a macOS build as 10 minutes for each minute, and
the repository is private (a free account has 2,000 minutes a month). A patch release costs roughly 60 billed minutes, a
macOS build roughly 250 more. If the repository becomes public the minutes are free: change the line `macos = kind !== 'patch' || ...`
in `scripts/release-plan.mjs` (and the push case) so macOS is always built.

**One-time setup**

1. Create a GitHub repository and push the project. Nothing in the project names the repository: the release workflow
   fills in the update URL from the repository it runs in.
2. Create the update key (skip if `~/.tauri/playlist-keeper.key` exists; its public half is already in
   `src-tauri/tauri.conf.json`, so a **new** key means replacing `plugins.updater.pubkey` there too):
   `npx tauri signer generate -w ~/.tauri/playlist-keeper.key`
3. Add one repository secret `TAURI_SIGNING_PRIVATE_KEY` (Settings > Secrets and variables > Actions) holding the full
   contents of the key file, or, with the GitHub CLI: `gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/playlist-keeper.key`.
   **Do not create `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` for the generated key**: it has no password, GitHub cannot store an
   empty secret, and any password makes signing fail with "incorrect updater private key password". Add that secret only
   if you generated the key with a password. The release workflow checks the key first and fails within seconds if it is wrong.
4. **Back up the key file.** If it is lost, installed copies can never be updated again.
5. First run: **Actions > release > Run workflow** with **dry run** ticked, and check that it goes green. Then push a
   small change to `master` and watch a release appear under **Releases**.

`.github/workflows/build.yml` runs the checks and builds unsigned Linux and Windows installers for pull requests and manual
runs (nothing is published). `.github/dependabot.yml` opens weekly pull requests that update the pinned GitHub Actions,
npm packages and Rust crates. A local build keeps a placeholder update URL, so "Check for updates" in a local build
reports that it could not check. To release a specific version by hand: `npm run version:set -- 0.3.0`, commit, `git tag v0.3.0`,
`git push --follow-tags` (the tag decides the version, so the committed version only matters for local builds).

## Security and privacy

- Your login (YouTube cookies) is stored in the OS keychain, never in a file, and is only sent to YouTube.
- The UI cannot open sockets itself. Every request goes through one Rust command that allows only `https` to
  `youtube.com`, `google.com` and `googleapis.com`. The page's content-security-policy allows images only from
  YouTube's and Google's image hosts (`*.ytimg.com`, `*.ggpht.com`, `*.googleusercontent.com`, `www.gstatic.com`: track
  thumbnails, playlist covers and your profile photo). The app opens no listening ports.
- Rust commands exist only where the capability file (`src-tauri/capabilities/default.json`) grants them.
- The only other network access is the update check against your GitHub release feed.
- Your name, handle and profile photo URL (shown in the profile card) are cached in the app's local storage; they are
  not secrets and are cleared by Reconnect.
- No telemetry, no accounts, no server of any kind.
- The saved copy of your playlists (titles, artists, lengths) is a SQLite file in the app config folder:
  Linux `~/.config/dev.playlistkeeper.app/keeper.db`, macOS `~/Library/Application Support/dev.playlistkeeper.app/`,
  Windows `%APPDATA%\dev.playlistkeeper.app\`. Delete the folder to reset the app. Keychain entries use the service
  name `dev.playlistkeeper.app`.

## Troubleshooting

| Problem | Fix |
|---|---|
| "secure storage unavailable" (Linux) | Start a Secret Service provider (GNOME Keyring, KWallet, KeePassXC) and make sure it is unlocked. |
| "firefox is not signed in" / no profile found | Sign in at music.youtube.com in that browser first. Firefox must have been started once; flatpak and snap profiles are searched too. |
| Chrome on Windows cannot be read | Chrome 127+ blocks it. Use Firefox or paste the cookie. |
| "YouTube did not accept this login" | The cookie expired or belongs to a different account. Sign in again in the browser, then reconnect. |
| A playlist is skipped during sync | Auto-generated mixes (their ids start with `RD`, for example a personal mix) have no readable contents. Hide them. |
| Blank or glitchy window on Linux with some graphics drivers | Start with `WEBKIT_DISABLE_DMABUF_RENDERER=1`. |
| AppImage will not start | Install `libfuse2`, or run with `--appimage-extract-and-run`. |
| macOS says the app is damaged or from an unidentified developer | See the first-launch steps above (`xattr -dr com.apple.quarantine ...`). |
| `npm run tauri build` fails with "A public key has been found, but no private key" | Provide the signing key (see Build) or run `node scripts/ci-config.mjs --no-updater-artifacts` first. |
| First `tauri dev` is slow | It compiles all Rust dependencies once (about 5 minutes, several GB in `src-tauri/target`). Later runs are fast. |

## Project layout

```
src/core/       pure TypeScript logic, no I/O, unit-tested: sanitize (title cleaning), dupes, diff (saved copy vs fresh read),
                compare, score, full (full-version ranking)
src/services/   YouTube client and parsers, auth, SQLite repository, sync, actions (what the screens do), updater
src/ui/         Svelte components; styles/tokens.css (colours, shapes), styles/fonts.css, app.css (components)
src/assets/     the app logo shown in the sidebar and on the Connect screen
src/dev/        the in-app self-test (development only)
src-tauri/      Rust shell: keychain, browser cookies, HTTP with allow-list, migrations, updater, capabilities, icons
scripts/        release-plan.mjs (version and platform decision), make-latest-json.mjs (update feed), set-version.mjs,
                ci-config.mjs (CI-only config edits), contrast.mjs (colour contrast check)
packaging/arch/ PKGBUILD that turns the Linux deb into the Arch package (built in CI)
tests/          shared test helper (in-memory SQLite)
.github/        build.yml (checks and unsigned builds for pull requests), release.yml (automatic releases), dependabot.yml
```

### Design decisions worth knowing

- Playlists are read from YouTube's raw responses, because the parsed API drops the greyed-out flag and the
  per-entry `setVideoId` needed to remove one copy of a repeated video. Only the playlist's own shelf is read, never the
  "suggestions" shelf.
- The webview strips `Cookie`, `Origin` and `User-Agent` headers and `youtubei.js` omits `Origin`/`User-Agent` in a
  browser runtime, so requests are made by the Rust shell, which sets them.
- `youtubei.js`'s `playlist.delete()` is broken upstream; the app calls the underlying endpoint itself where needed.
- Cleaned titles are local only; unknown bracket text counts as a version.
