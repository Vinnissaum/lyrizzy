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

/// Convert a presentation file (PPTX, PDF, ODP, …) to one PNG per slide.
///
/// LibreOffice's `--convert-to png` only ever exports the **first** page of a
/// multi-page document, so a single CLI call can't produce a full slideshow.
/// We instead go through PDF, which LibreOffice exports faithfully (all pages):
///   1. `src` → PDF via `soffice --headless --convert-to pdf` (skipped when
///      `src` is already a PDF).
///   2. PDF → `slide_000.png`, `slide_001.png`, … via pdfium (one image per page).
///
/// `resource_dir` is the Tauri resource directory, used to locate a bundled
/// pdfium library; rasterization falls back to a system pdfium otherwise.
/// Returns the slide PNG paths in page order.
///
/// Errors: spawn failure, non-zero soffice exit, missing PDF, pdfium load/render
/// failure, or a document with no pages.
pub async fn convert_to_slides(
    soffice: &Path,
    resource_dir: Option<PathBuf>,
    src: &Path,
    out_dir: &Path,
) -> Result<Vec<PathBuf>, String> {
    let is_pdf = src
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false);

    // 1. Obtain a multi-page PDF. For PDF input we render the source directly;
    //    otherwise LibreOffice produces an intermediate PDF inside `out_dir`.
    let (pdf_path, intermediate) = if is_pdf {
        (src.to_path_buf(), false)
    } else {
        (convert_to_pdf(soffice, src, out_dir).await?, true)
    };

    // 2. Rasterize page-by-page. pdfium is synchronous and CPU-bound, and its
    //    handles are not `Send`, so bind + render entirely inside a blocking
    //    task (only `Send` paths cross the await boundary).
    let pdf_for_task = pdf_path.clone();
    let out_for_task = out_dir.to_path_buf();
    let result =
        tokio::task::spawn_blocking(move || {
            rasterize_pdf(resource_dir.as_deref(), &pdf_for_task, &out_for_task)
        })
        .await
        .map_err(|e| format!("rasterization task failed: {e}"))?;

    // Drop the throwaway PDF; keep the original when the source itself was a PDF.
    if intermediate {
        let _ = std::fs::remove_file(&pdf_path);
    }

    result
}

/// Convert `src` to a PDF inside `out_dir` via LibreOffice headless, returning
/// the produced PDF path. LibreOffice names the output `<src_stem>.pdf`.
async fn convert_to_pdf(soffice: &Path, src: &Path, out_dir: &Path) -> Result<PathBuf, String> {
    let output = tokio::process::Command::new(soffice)
        .args(["--headless", "--convert-to", "pdf", "--outdir"])
        .arg(out_dir)
        .arg(src)
        .output()
        .await
        .map_err(|e| format!("failed to spawn soffice: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("soffice exited with error: {stderr}"));
    }

    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "source file has no usable stem".to_string())?;
    let pdf = out_dir.join(format!("{stem}.pdf"));
    if !pdf.exists() {
        return Err("soffice produced no PDF output".to_string());
    }
    Ok(pdf)
}

/// Render every page of `pdf` to `slide_000.png`, `slide_001.png`, … in `out_dir`.
/// Synchronous (pdfium is blocking); call from a blocking context.
fn rasterize_pdf(
    resource_dir: Option<&Path>,
    pdf: &Path,
    out_dir: &Path,
) -> Result<Vec<PathBuf>, String> {
    use pdfium_render::prelude::*;

    let pdfium = bind_pdfium(resource_dir)?;
    let document = pdfium
        .load_pdf_from_file(pdf, None)
        .map_err(|e| format!("failed to open pdf: {e}"))?;

    // Render at a fixed long-edge target so slides are crisp on a 1080p output
    // without ballooning file size; aspect ratio is preserved by pdfium.
    let config = PdfRenderConfig::new()
        .set_target_width(1920)
        .set_maximum_height(1920);

    let mut slides = Vec::new();
    for (i, page) in document.pages().iter().enumerate() {
        let bitmap = page
            .render_with_config(&config)
            .map_err(|e| format!("failed to render page {i}: {e}"))?;
        let dest = out_dir.join(format!("slide_{i:03}.png"));
        bitmap
            .as_image()
            .save_with_format(&dest, image::ImageFormat::Png)
            .map_err(|e| format!("failed to write slide {i}: {e}"))?;
        slides.push(dest);
    }

    if slides.is_empty() {
        return Err("pdf has no pages".to_string());
    }
    Ok(slides)
}

/// Bind to a pdfium dynamic library. Tries, in order: bundled next to the Tauri
/// resources (and a `pdfium/` subdir), a `PDFIUM_LIB_DIR` override, the in-repo
/// `resources/pdfium` dir during `tauri dev` (debug builds only), then a
/// system-installed pdfium.
fn bind_pdfium(resource_dir: Option<&Path>) -> Result<pdfium_render::prelude::Pdfium, String> {
    use pdfium_render::prelude::*;

    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(res) = resource_dir {
        dirs.push(res.to_path_buf());
        dirs.push(res.join("pdfium"));
    }
    if let Ok(dir) = std::env::var("PDFIUM_LIB_DIR") {
        dirs.push(PathBuf::from(dir));
    }
    // `tauri dev` doesn't stage bundled resources, so resource_dir won't hold the
    // library. Fall back to the checked-in copy in the source tree. Debug-only so
    // release builds rely solely on the bundled/ system library.
    #[cfg(debug_assertions)]
    dirs.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources").join("pdfium"));

    for dir in &dirs {
        let lib = Pdfium::pdfium_platform_library_name_at_path(dir);
        if let Ok(bindings) = Pdfium::bind_to_library(&lib) {
            return Ok(Pdfium::new(bindings));
        }
    }

    Pdfium::bind_to_system_library()
        .map(Pdfium::new)
        .map_err(|e| format!("could not load pdfium library: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    /// The checked-in pdfium library (used by `tauri dev`) must be loadable on
    /// the current platform — guards against a missing/corrupt/wrong-arch binary.
    #[test]
    fn checked_in_pdfium_library_loads() {
        use pdfium_render::prelude::*;
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("pdfium");
        let lib = Pdfium::pdfium_platform_library_name_at_path(&dir);
        assert!(
            Pdfium::bind_to_library(&lib).is_ok(),
            "failed to load checked-in pdfium at {lib:?}"
        );
    }

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
