# Lyrizzy — Release Playbook

Pushing a `v*` git tag builds, signs, and stages a draft GitHub Release for both
platforms. This is the primary release path — no local build or manual signing
required.

> For end-user install, dual-monitor setup, and the presentation-window acceptance
> test, see `docs/installation.md`.

---

## One-Time Setup (per repository, not per release)

### 1. Generate the signing key

```powershell
npx tauri signer generate -w "$env:USERPROFILE\.trinity-tauri-private-key"
```

This writes two files:
- `~/.trinity-tauri-private-key` — **PRIVATE**, never commit, never share
- `~/.trinity-tauri-private-key.pub` — public key

Paste the **public** key's single-line base64 contents into
`src-tauri/tauri.conf.json` under `plugins.updater.pubkey`, and commit that change.
The updater plugin uses this key to verify installer signatures before applying an
update — it is meant to be public.

### 2. Add the two required GitHub secrets

In the repository's **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | The full contents of `~/.trinity-tauri-private-key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The key's password (empty string if none) |

`.github/workflows/release.yml` reads both as `env` vars for the
`tauri-apps/tauri-action@v1` step. See **§ Security Notes** below for why storing
the private key in CI secrets is safe here.

---

## Release Flow

1. **Bump the version everywhere in one command:**

   ```
   node scripts/bump-version.mjs 1.2.0
   ```

   This writes `1.2.0` to `package.json`, both `package-lock.json` version fields,
   `src-tauri/tauri.conf.json`, the `[package]` section of `src-tauri/Cargo.toml`,
   and the `tauri-app` entry of `src-tauri/Cargo.lock` — and touches no dependency
   version string. Rejects a malformed argument (anything not `MAJOR.MINOR.PATCH`)
   and writes nothing in that case.

2. **Commit and tag:**

   ```
   git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
   git commit -m "chore(release): bump version to 1.2.0"
   git tag v1.2.0
   git push origin main v1.2.0
   ```

   The tag must be pushed alongside (or after) a branch push that includes its
   commit — GitHub only registers workflows defined in `.github/workflows/` from a
   branch push, not from a tag pointing at a commit GitHub hasn't seen yet.

3. **Watch the Actions run.** Pushing the tag triggers `.github/workflows/release.yml`:
   - `verify-version` fails the whole run **before any build starts** if the tag and
     the four version-bearing files don't all agree (`scripts/check-version.mjs`).
   - `build` runs on a `windows-latest` / `ubuntu-24.04` matrix
     (`fail-fast: false`, `max-parallel: 1`), builds and signs both bundles, and
     stages them into a single **draft** GitHub Release for the tag via
     `tauri-apps/tauri-action@v1`.
   - If one platform fails, the draft still gets the other platform's assets — you
     decide whether to publish, re-run, or fix and re-tag.

4. **Review the draft release.** It contains the Windows `*-setup.exe` + `.sig`,
   the Linux `*.AppImage` + `.sig`, and a `latest.json` with both platform entries.
   Smoke-test the installer if this is a meaningful release.

5. **Publish.** Only after publishing does
   `https://github.com/Vinnissaum/triade/releases/latest/download/latest.json`
   start returning 200 — **while the release is a draft, that URL 404s, and the
   app's "Check for updates" reports `update.check_failed`, never "up to date".**
   This is intentional: it is the safety gate that stops a broken build from
   reaching a running installation before you've verified it (D-51).

On the next launch (or a manual "Check for updates" click), the app compares its
version against the published `latest.json` and, if newer, shows the update dialog
with the download progress bar.

---

## Security Notes

- The signing private key lives in **GitHub Actions secrets**
  (`TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`), read only by
  the `build` job. This repository has **no `pull_request` trigger anywhere** in
  `release.yml` — GitHub never exposes Actions secrets to workflows triggered by a
  fork's pull request, so the key is not reachable from outside contributions
  (D-50). Do not add a `pull_request` trigger to this workflow without re-reading
  this note; `scripts/release-workflow.test.mjs` asserts the trigger's absence as a
  gate, precisely so that change fails CI instead of silently exposing the key.
- The public key embedded in `tauri.conf.json` is intentionally public — the
  updater plugin uses it to verify the installer signature before applying an
  update.
- Releases publish as **drafts**; the maintainer clicks Publish after
  smoke-testing. An auto-published broken build would reach a running church
  installation before anyone could catch it, and rolling back an auto-update is
  painful (D-51).
- If the private key is ever compromised: generate a new key pair, update
  `plugins.updater.pubkey` in `tauri.conf.json`, ship a release, and rotate the
  GitHub secret.

---

## Local Emergency Fallback

`scripts/release.ps1` builds, signs, and emits a `latest.json` **locally, for
Windows only** — no CI, no Linux build, no draft-release automation. Use it only
when GitHub Actions is unavailable and a release cannot wait. It requires the same
`~/.trinity-tauri-private-key` from **One-Time Setup** above (or
`$env:TAURI_SIGNING_PRIVATE_KEY_PATH` pointing elsewhere):

```powershell
.\scripts\release.ps1 -Version "1.2.0" -RepoUrl "https://github.com/Vinnissaum/triade"
```

It writes `dist/latest.json` and prints the manual steps to create the GitHub
Release and upload the two files yourself. Because it only builds the platform
it runs on, an emergency release this way ships Windows only — do not use it as a
substitute for a full tag-push release; follow up with a normal `v*` tag push once
Actions is available again to get a matching Linux build.
