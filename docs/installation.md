# Trinity Lyrics v2 — Final Product Installation

How the finished app is built into an installer and deployed onto the machine that
actually runs a service (operator screen + projector/TV). This is the end-user
deployment path — distinct from `docs/release.md`, which covers signing and the
auto-updater.

> **If you only read one thing:** the dual-monitor presentation window **cannot be
> tested from WSL / VS Code Remote–WSL**. See [§0](#0-why-the-second-window-does-not-work-under-wsl).
> Build a native installer and run it on the real machine.

---

## 0. Why the second window does not work under WSL

When you run `npm run tauri dev` from VS Code inside WSL, the app runs under **WSLg**:

- WSLg renders Linux GUI apps through a **Weston (Wayland)** compositor and streams
  them to Windows over **RDP** (`WAYLAND_DISPLAY=wayland-0`).
- The "monitors" WSLg exposes are **virtual RDP displays** (`rdp-0`, `rdp-2` in
  `xrandr --listmonitors`), not the physical monitors attached to the PC.
- On Wayland a client **cannot position its own top-level window**, so the
  place-then-fullscreen path in `enter_presentation` lands on the primary surface.
  This is documented directly in the code: `src-tauri/src/commands/window.rs`
  (`fullscreen_on_monitor_linux`).

**Consequence:** monitor auto-detection, `set_position`, and fullscreen-on-monitor are
all unreliable or meaningless under WSLg. A black or mispositioned presentation window
in WSL tells you **nothing** about whether the feature works in production.

**To actually test the second window, use one of:**

| Environment | Multi-monitor presentation |
| --- | --- |
| **Native Windows build** (recommended target) | ✅ works — WebView2, real monitors |
| **Native Linux desktop** (X11, real dual monitors) | ✅ works — GTK `fullscreen_on_monitor` |
| **Native Linux desktop** (Wayland) | ⚠️ X11/Xwayland path needed; test on hardware |
| **WSLg (VS Code Remote–WSL)** | ❌ cannot validate — virtual RDP displays |

The production target for the church is a **native Windows install** (see
`docs/release.md`, which is Windows-first: `.msi` / NSIS `.exe`).

---

## 1. Build the installer

You build the installer on a machine matching the **target OS** (Tauri does not
cross-compile installers). The simplest path: build Windows installers on Windows.

### 1a. Windows (primary target)

Prerequisites:
- Rust ≥ 1.82 (`rustup`), the MSVC build tools (Visual Studio C++ workload)
- Node.js ≥ 20 + npm
- WebView2 Runtime (preinstalled on Windows 10/11; the installer also bootstraps it)

```powershell
npm install
npm run tauri build
```

Output:
- `src-tauri/target/release/bundle/msi/Trinity Lyrics_<version>_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/Trinity Lyrics_<version>_x64-setup.exe`

Either installer is fine for end users. The `.exe` (NSIS) is the smaller, friendlier
double-click install. Sign it per `docs/release.md` if shipping through the updater.

### 1b. Linux (alternative target)

Build on a **native** Linux desktop (not WSL). Install the build + runtime
prerequisites listed in `docs/linux-compat.md §1` first, then:

```bash
npm install
npm run tauri build
```

Output (under `src-tauri/target/release/bundle/`):
- `deb/trinity-lyrics_<version>_amd64.deb`
- `appimage/trinity-lyrics_<version>_amd64.AppImage`
- `rpm/…` where rpm tooling is present

---

## 2. Install on the service machine

### Windows
1. Copy the `.exe` (or `.msi`) to the PC that drives the projector/TV.
2. Double-click and follow the installer. It installs WebView2 if missing.
3. Launch **Trinity Lyrics** from the Start menu.

### Linux
```bash
# Debian/Ubuntu
sudo apt install ./trinity-lyrics_<version>_amd64.deb
# or, portable:
chmod +x trinity-lyrics_<version>_amd64.AppImage
./trinity-lyrics_<version>_amd64.AppImage
```
Also install the **runtime tools** from `docs/linux-compat.md §1` (LibreOffice for
PPTX/PDF import; FFmpeg + GStreamer plugins for video backgrounds) — these are not
bundled.

---

## 3. Dual-monitor setup on the service machine

The presentation feature assumes two displays: the **operator** screen (laptop/desk
monitor) and the **presentation** screen (projector or TV).

1. Connect both displays.
2. In the OS display settings, set the arrangement to **Extend** (NOT Mirror/Duplicate).
   - Windows: `Win + P` → **Extend**.
   - Mirroring defeats the whole point — both screens would show the operator UI.
3. Pick which display is **primary**. The app auto-targets the **first non-primary**
   monitor for the presentation window (`resolve_target_index` in
   `src-tauri/src/commands/window.rs`). Make the operator's screen the primary so the
   projector becomes the presentation target.
4. If auto-detection lands on the wrong screen, use the in-app **monitor picker**
   (passes `monitor_index` to `enter_presentation`) to override.

---

## 4. Verify the presentation window (acceptance test)

Run this on the **native** install with two real monitors connected:

- [ ] App launches; operator window appears on the primary screen.
- [ ] Load a service set with at least one item (empty sets are rejected with
      `presentation.empty_set`).
- [ ] Enter presentation → a **fullscreen** window appears on the **second** monitor.
- [ ] Operator screen still shows the full control UI (not duplicated).
- [ ] Changing the active slide on the operator updates the presentation screen.
- [ ] Images and videos load in the presentation window (asset:// — see
      `docs/linux-compat.md §5`).
- [ ] On Linux: H.264 MP4 plays only with GStreamer plugins installed; prefer WebM.
- [ ] `Esc` (from either window) exits presentation cleanly; no stuck windows.
- [ ] Single-monitor fallback: with one display, the presentation window opens
      `always_on_top` over the operator (`should_pin_on_top`).

If a step fails on native hardware, that's a real bug worth filing. If it only fails in
WSL, it's [§0](#0-why-the-second-window-does-not-work-under-wsl) — not a bug.

---

## 5. Where data lives

The SQLite database and imported media are stored per-user via Tauri's
`app_data_dir()`:

| OS | Path |
| --- | --- |
| Windows | `%APPDATA%\com.igreja-trindade.trinity-lyrics\` |
| Linux | `~/.local/share/com.igreja-trindade.trinity-lyrics/` (or `TrinityLyrics`) |

Migrations in `src-tauri/migrations/` run automatically at startup. Back up this
directory to preserve songs, sets, and media (see `commands/backup.rs`).

---

## Related docs
- `docs/release.md` — signing, GitHub Releases, and the auto-updater
- `docs/linux-compat.md` — Linux build/runtime prerequisites and codec notes
- `docs/TDD-v2.md` — architecture and design
