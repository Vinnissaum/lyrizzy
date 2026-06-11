/// FFmpeg / FFprobe sidecar resolution — mirrors `libreoffice::soffice_path` and
/// `mediamtx::mediamtx_path` so all three external tools are located the same way.
///
/// `ffmpeg` generates video thumbnails (see `thumbnail.rs`); `ffprobe` reads
/// video metadata on import (see `media_probe.rs`). Neither is bundled by
/// default, and the Windows/macOS builds typically don't add them to `PATH`, so
/// we also probe the usual install locations.
use std::path::{Path, PathBuf};

/// Bundled executable file names, per platform.
#[cfg(windows)]
const FFMPEG_BIN: &str = "ffmpeg.exe";
#[cfg(not(windows))]
const FFMPEG_BIN: &str = "ffmpeg";

#[cfg(windows)]
const FFPROBE_BIN: &str = "ffprobe.exe";
#[cfg(not(windows))]
const FFPROBE_BIN: &str = "ffprobe";

/// Resolve the `ffmpeg` executable path. See [`resolve`] for the lookup order.
pub fn ffmpeg_path(resource_dir: Option<&Path>) -> Option<PathBuf> {
    resolve(resource_dir, FFMPEG_BIN, "FFMPEG_PATH")
}

/// Resolve the `ffprobe` executable path. See [`resolve`] for the lookup order.
pub fn ffprobe_path(resource_dir: Option<&Path>) -> Option<PathBuf> {
    resolve(resource_dir, FFPROBE_BIN, "FFPROBE_PATH")
}

/// Shared resolver for `ffmpeg`/`ffprobe`. Priority (mirrors the LibreOffice
/// resolver):
/// 1. Bundled: `<resource_dir>/ffmpeg/<bin>`
/// 2. The `env_var` override (`FFMPEG_PATH` / `FFPROBE_PATH`) — accepts either
///    the executable itself or a directory containing it.
/// 3. The bare command on `PATH` (probed via `-version`).
/// 4. Well-known install locations not on `PATH`.
fn resolve(resource_dir: Option<&Path>, bin: &str, env_var: &str) -> Option<PathBuf> {
    // 1. Bundled binary (both ffmpeg and ffprobe ship side-by-side under `ffmpeg/`).
    if let Some(res) = resource_dir {
        let bundled = res.join("ffmpeg").join(bin);
        if bundled.exists() {
            return Some(bundled);
        }
    }

    // 2. Env override — executable path or a directory containing it.
    if let Ok(val) = std::env::var(env_var) {
        let p = PathBuf::from(val.trim());
        if p.is_dir() {
            let exe = p.join(bin);
            if exe.exists() {
                return Some(exe);
            }
        } else if p.exists() {
            return Some(p);
        }
    }

    // 3. On PATH (probe by running `-version`).
    let bare = bin.strip_suffix(".exe").unwrap_or(bin);
    let ok = std::process::Command::new(bare)
        .arg("-version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    if ok {
        return Some(PathBuf::from(bare));
    }

    // 4. Well-known install locations not on PATH.
    well_known_install_paths(bin).into_iter().find(|p| p.exists())
}

/// Default install locations of the ffmpeg/ffprobe executables, per platform.
fn well_known_install_paths(bin: &str) -> Vec<PathBuf> {
    #[cfg(windows)]
    {
        // The common Windows ffmpeg layout is `<root>\ffmpeg\bin\<bin>`.
        let mut roots: Vec<PathBuf> = Vec::new();
        for var in ["ProgramFiles", "ProgramFiles(x86)", "ProgramW6432"] {
            if let Ok(val) = std::env::var(var) {
                roots.push(PathBuf::from(val));
            }
        }
        roots.push(PathBuf::from(r"C:\Program Files"));
        roots.push(PathBuf::from(r"C:\Program Files (x86)"));
        roots.push(PathBuf::from(r"C:\"));
        roots
            .into_iter()
            .map(|r| r.join("ffmpeg").join("bin").join(bin))
            .collect()
    }
    #[cfg(target_os = "macos")]
    {
        vec![
            PathBuf::from(format!("/opt/homebrew/bin/{bin}")),
            PathBuf::from(format!("/usr/local/bin/{bin}")),
        ]
    }
    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        vec![
            PathBuf::from(format!("/usr/bin/{bin}")),
            PathBuf::from(format!("/usr/local/bin/{bin}")),
            PathBuf::from(format!("/snap/bin/{bin}")),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn env_override_points_at_executable() {
        let tmp = tempfile::TempDir::new().unwrap();
        let exe = tmp.path().join(FFMPEG_BIN);
        std::fs::write(&exe, b"#!/bin/sh\n").unwrap();
        std::env::set_var("FFMPEG_PATH", exe.to_str().unwrap());
        assert_eq!(ffmpeg_path(None).as_deref(), Some(exe.as_path()));
        std::env::remove_var("FFMPEG_PATH");
    }

    #[test]
    fn env_override_accepts_directory() {
        let tmp = tempfile::TempDir::new().unwrap();
        let exe = tmp.path().join(FFPROBE_BIN);
        std::fs::write(&exe, b"#!/bin/sh\n").unwrap();
        std::env::set_var("FFPROBE_PATH", tmp.path().to_str().unwrap());
        assert_eq!(ffprobe_path(None).as_deref(), Some(exe.as_path()));
        std::env::remove_var("FFPROBE_PATH");
    }

    #[test]
    fn bundled_binary_wins() {
        let tmp = tempfile::TempDir::new().unwrap();
        let dir = tmp.path().join("ffmpeg");
        std::fs::create_dir_all(&dir).unwrap();
        let exe = dir.join(FFMPEG_BIN);
        std::fs::write(&exe, b"#!/bin/sh\n").unwrap();
        assert_eq!(ffmpeg_path(Some(tmp.path())).as_deref(), Some(exe.as_path()));
    }
}
