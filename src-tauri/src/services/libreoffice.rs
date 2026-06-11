/// LibreOffice sidecar service — path detection and PPTX/PDF → PNG conversion.
use std::path::{Path, PathBuf};

/// Bundled LibreOffice executable file name, per platform.
/// Windows ships `soffice.exe`; Linux/macOS use the extension-less `soffice`.
#[cfg(windows)]
const BUNDLED_SOFFICE_BIN: &str = "soffice.exe";
#[cfg(not(windows))]
const BUNDLED_SOFFICE_BIN: &str = "soffice";

/// Resolve the LibreOffice executable path.
///
/// Priority:
/// 1. Bundled: `<resource_dir>/soffice/program/<soffice|soffice.exe>`
/// 2. `SOFFICE_PATH` environment variable
/// 3. `soffice` on PATH (probed via `--version`)
/// 4. `libreoffice` on PATH (common on Debian/Ubuntu, where `soffice` may be absent)
/// 5. Well-known install locations (the Windows/macOS installers don't add
///    LibreOffice to PATH, so a default install is otherwise undetectable).
pub fn soffice_path(resource_dir: Option<&Path>) -> Option<PathBuf> {
    // 1. Bundled binary
    if let Some(res) = resource_dir {
        let bundled = res
            .join("soffice")
            .join("program")
            .join(BUNDLED_SOFFICE_BIN);
        if bundled.exists() {
            return Some(bundled);
        }
    }

    // 2. SOFFICE_PATH env var
    if let Ok(val) = std::env::var("SOFFICE_PATH") {
        let p = PathBuf::from(val);
        if p.exists() {
            return Some(p);
        }
    }

    // 3/4. `soffice` then `libreoffice` on PATH.
    for bin in ["soffice", "libreoffice"] {
        let ok = std::process::Command::new(bin)
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        if ok {
            return Some(PathBuf::from(bin));
        }
    }

    // 5. Well-known install locations not on PATH.
    well_known_install_paths().into_iter().find(|p| p.exists())
}

/// Default install locations of the `soffice` executable, per platform.
/// On Windows the installer writes to `Program Files` but does not modify PATH;
/// on macOS the app bundle ships the binary under `Contents/MacOS`.
fn well_known_install_paths() -> Vec<PathBuf> {
    #[cfg(windows)]
    {
        // Honour ProgramFiles / ProgramFiles(x86) when set, with hard-coded
        // fallbacks for the typical English-locale install roots.
        let mut roots: Vec<PathBuf> = Vec::new();
        for var in ["ProgramFiles", "ProgramFiles(x86)", "ProgramW6432"] {
            if let Ok(val) = std::env::var(var) {
                roots.push(PathBuf::from(val));
            }
        }
        roots.push(PathBuf::from(r"C:\Program Files"));
        roots.push(PathBuf::from(r"C:\Program Files (x86)"));
        roots
            .into_iter()
            .map(|r| r.join("LibreOffice").join("program").join("soffice.exe"))
            .collect()
    }
    #[cfg(target_os = "macos")]
    {
        vec![PathBuf::from(
            "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        )]
    }
    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        // Common Linux locations for the off-PATH case (e.g. Flatpak, /opt).
        vec![
            PathBuf::from("/usr/bin/soffice"),
            PathBuf::from("/usr/local/bin/soffice"),
            PathBuf::from("/opt/libreoffice/program/soffice"),
            PathBuf::from("/snap/bin/libreoffice"),
        ]
    }
}

/// Convert a presentation file (PPTX, PDF, etc.) to PNG slides using LibreOffice headless.
///
/// Spawns `soffice --headless --convert-to png --outdir <out_dir> <src>`, then renames
/// all produced PNG files to the canonical `slide_000.png`, `slide_001.png`, … form.
/// Returns the sorted, renamed paths.
///
/// Errors: spawn failure, non-zero exit code, no PNGs produced.
pub async fn convert_to_png(
    soffice: &Path,
    src: &Path,
    out_dir: &Path,
) -> Result<Vec<PathBuf>, String> {
    let output = tokio::process::Command::new(soffice)
        .args(["--headless", "--convert-to", "png", "--outdir"])
        .arg(out_dir)
        .arg(src)
        .output()
        .await
        .map_err(|e| format!("failed to spawn soffice: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("soffice exited with error: {stderr}"));
    }

    let mut pngs: Vec<PathBuf> = std::fs::read_dir(out_dir)
        .map_err(|e| format!("failed to read output dir: {e}"))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("png"))
                .unwrap_or(false)
        })
        .collect();

    if pngs.is_empty() {
        return Err("soffice produced no PNG output".to_string());
    }

    pngs.sort();

    let mut renamed = Vec::with_capacity(pngs.len());
    for (i, src_png) in pngs.iter().enumerate() {
        let dest = out_dir.join(format!("slide_{i:03}.png"));
        std::fs::rename(src_png, &dest)
            .map_err(|e| format!("failed to rename slide {i}: {e}"))?;
        renamed.push(dest);
    }

    Ok(renamed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn soffice_path_bundled_takes_priority() {
        let tmp = TempDir::new().unwrap();
        let prog_dir = tmp.path().join("soffice").join("program");
        std::fs::create_dir_all(&prog_dir).unwrap();
        let exe = prog_dir.join(BUNDLED_SOFFICE_BIN);
        std::fs::write(&exe, b"stub").unwrap();

        let result = soffice_path(Some(tmp.path()));
        assert_eq!(result, Some(exe));
    }

    #[test]
    fn bundled_bin_name_is_platform_correct() {
        if cfg!(windows) {
            assert_eq!(BUNDLED_SOFFICE_BIN, "soffice.exe");
        } else {
            assert_eq!(BUNDLED_SOFFICE_BIN, "soffice");
        }
    }

    #[test]
    fn soffice_path_env_var_fallback() {
        let tmp = TempDir::new().unwrap();
        let exe = tmp.path().join("soffice.exe");
        std::fs::write(&exe, b"stub").unwrap();

        std::env::set_var("SOFFICE_PATH", exe.to_str().unwrap());
        let result = soffice_path(None); // no bundled dir
        std::env::remove_var("SOFFICE_PATH");

        assert_eq!(result, Some(exe));
    }

    #[test]
    fn well_known_install_paths_target_soffice_binary() {
        let paths = well_known_install_paths();
        assert!(!paths.is_empty());
        // Every candidate must point at a soffice executable, not a directory.
        for p in paths {
            let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            assert!(
                name == "soffice" || name == "soffice.exe" || name == "libreoffice",
                "unexpected candidate file name: {name}"
            );
        }
    }

    #[test]
    fn soffice_path_nonexistent_resource_dir_falls_through() {
        let nonexistent = PathBuf::from("/does/not/exist/soffice.exe");
        // Bundled path doesn't exist, SOFFICE_PATH not set, soffice not on PATH in CI
        // — just ensure no panic
        let _ = soffice_path(Some(&nonexistent));
    }
}
