# Trinity Lyrics v2 — Release Playbook

Manual signing + GitHub Releases workflow for the Tauri updater plugin.

> For end-user install, dual-monitor setup, and the presentation-window acceptance
> test, see `docs/installation.md`.

---

## Prerequisites

- Rust toolchain (≥ 1.82) + `cargo-tauri` CLI (`npm install -g @tauri-apps/cli`)
- Node.js ≥ 20 + npm
- Git access to the repository with push rights to `main`
- A signing key (see **Key Generation** below)

---

## Key Generation (one-time, per maintainer)

Run once and keep the private key out of the repository:

```powershell
npx tauri signer generate -w "$env:USERPROFILE\.trinity-tauri-private-key"
```

This writes two files:
- `~/.trinity-tauri-private-key` — **PRIVATE**, never commit
- `~/.trinity-tauri-private-key.pub` — public key (paste into `tauri.conf.json`)

Copy the public key contents (single-line base64) into `src-tauri/tauri.conf.json` under
`plugins.updater.pubkey`. Commit that change.

---

## Version Bump Locations

Before building a release, bump the version string in **both** of these files:

| File | Field |
|---|---|
| `package.json` | `"version"` |
| `src-tauri/tauri.conf.json` | `"version"` |

They must match exactly. The Tauri updater compares the manifest version against
`CARGO_PKG_VERSION` which is read from `Cargo.toml`; `tauri.conf.json` syncs that
automatically on build.

---

## Build Command

```powershell
npm run tauri build
```

Output: `src-tauri/target/release/bundle/msi/` (Windows installer `.msi`)
and `src-tauri/target/release/bundle/nsis/` (NSIS `.exe` installer).

---

## Sign Command

```powershell
$env:TAURI_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.trinity-tauri-private-key" -Raw
$env:TAURI_KEY_PASSWORD = ""   # leave empty if key has no password

npx tauri signer sign `
  -k "$env:USERPROFILE\.trinity-tauri-private-key" `
  -- src-tauri/target/release/bundle/nsis/TrinityLyrics_<version>_x64-setup.exe
```

This produces a `.sig` file alongside the installer.

---

## Generate `latest.json`

The Tauri updater plugin fetches a `latest.json` manifest from the GitHub Releases
endpoint configured in `tauri.conf.json`. Schema:

```json
{
  "version": "1.2.0",
  "notes": "Release notes here.",
  "pub_date": "2026-06-01T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "url": "https://github.com/<owner>/<repo>/releases/download/v1.2.0/TrinityLyrics_1.2.0_x64-setup.exe",
      "signature": "<contents of the .sig file>"
    }
  }
}
```

The helper script `scripts/release.ps1` emits this file automatically at
`dist/latest.json` after building and signing.

---

## GitHub Release Flow

1. Create a new git tag: `git tag v<version> && git push origin v<version>`
2. Draft a GitHub Release on that tag.
3. Upload the installer (`.exe` or `.msi`) and `latest.json` as release assets.
4. Set the `latest.json` asset URL in `tauri.conf.json` `plugins.updater.endpoints`
   (only needed when the repo URL changes — the script handles the current format).
5. Publish the release.

On the next app launch (or when the operator clicks "Check for updates"), the updater
plugin downloads `latest.json`, compares versions, and—if newer—surfaces the
`UpdateBanner`.

---

## Dry-Run / Smoke Test

1. Build a test release with version `0.0.1`.
2. Publish it as a **draft** GitHub Release (not visible to users).
3. Build the app at version `0.0.0` pointing at the same endpoint.
4. Launch the app and confirm the update banner appears.
5. Click "Atualizar" and confirm the app restarts into `0.0.1`.
6. Delete the draft release.

---

## Security Notes

- The private key MUST NOT be committed or stored in CI secrets that are visible to
  pull-request authors. Run signing locally on the maintainer's machine.
- The public key embedded in `tauri.conf.json` is intentionally public — the updater
  plugin uses it to verify the installer signature before applying the update.
- If the private key is ever compromised: generate a new key pair, update the public key
  in `tauri.conf.json`, ship a release, and rotate.
