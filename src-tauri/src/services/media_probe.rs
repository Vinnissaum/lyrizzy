use crate::domain::media::MediaKind;
use std::path::Path;

/// `(width, height, duration_ms)` returned by [`probe_video_with_cmd`].
pub type VideoDims = (Option<u32>, Option<u32>, Option<i64>);

pub struct MediaMetadata {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub duration_ms: Option<i64>,
    pub mime_type: String,
    pub byte_size: i64,
}

#[derive(Debug)]
pub enum ProbeError {
    Io(std::io::Error),
    ImageDecode(String),
    ToolMissing,
    FfprobeError(String),
}

impl std::fmt::Display for ProbeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(e) => write!(f, "IO: {e}"),
            Self::ImageDecode(e) => write!(f, "image decode: {e}"),
            Self::ToolMissing => write!(f, "ffprobe not found in PATH"),
            Self::FfprobeError(e) => write!(f, "ffprobe: {e}"),
        }
    }
}

pub fn mime_for_ext(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        _ => "application/octet-stream",
    }
}

/// Probe a media file for dimensions, duration, MIME type, and byte size.
///
/// Image probing reads only the file header (no full pixel decode).
/// Video probing spawns `ffprobe`; returns ToolMissing if it's not in PATH.
pub fn probe(path: &Path, kind: MediaKind) -> Result<MediaMetadata, ProbeError> {
    let byte_size = std::fs::metadata(path)
        .map_err(ProbeError::Io)?
        .len() as i64;
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    let mime_type = mime_for_ext(ext).to_string();

    match kind {
        MediaKind::Image => {
            let (width, height) = probe_image_dimensions(path)?;
            Ok(MediaMetadata {
                width: Some(width),
                height: Some(height),
                duration_ms: None,
                mime_type,
                byte_size,
            })
        }
        MediaKind::Video => {
            let ffprobe = std::env::var("FFPROBE_PATH").unwrap_or_else(|_| "ffprobe".to_string());
            let (width, height, duration_ms) = probe_video_with_cmd(path, &ffprobe)?;
            Ok(MediaMetadata {
                width,
                height,
                duration_ms,
                mime_type,
                byte_size,
            })
        }
        // Presentation files are not probed for dimensions — metadata comes from the
        // LibreOffice conversion output (slide count). Return byte_size only.
        MediaKind::Presentation => Ok(MediaMetadata {
            width: None,
            height: None,
            duration_ms: None,
            mime_type,
            byte_size,
        }),
    }
}

fn probe_image_dimensions(path: &Path) -> Result<(u32, u32), ProbeError> {
    image::ImageReader::open(path)
        .map_err(ProbeError::Io)?
        .with_guessed_format()
        .map_err(ProbeError::Io)?
        .into_dimensions()
        .map_err(|e| ProbeError::ImageDecode(e.to_string()))
}

/// Exposed for tests so callers can inject a custom ffprobe binary path.
pub fn probe_video_with_cmd(
    path: &Path,
    cmd: &str,
) -> Result<VideoDims, ProbeError> {
    let output = std::process::Command::new(cmd)
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,duration:format=duration",
            "-of",
            "default=noprint_wrappers=1",
            "-i",
        ])
        .arg(path)
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                ProbeError::ToolMissing
            } else {
                ProbeError::Io(e)
            }
        })?;

    if !output.status.success() {
        return Err(ProbeError::FfprobeError(
            String::from_utf8_lossy(&output.stderr).into_owned(),
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut width: Option<u32> = None;
    let mut height: Option<u32> = None;
    let mut duration_secs: Option<f64> = None;

    for line in stdout.lines() {
        if let Some(v) = line.strip_prefix("width=") {
            width = v.trim().parse().ok();
        } else if let Some(v) = line.strip_prefix("height=") {
            height = v.trim().parse().ok();
        } else if let Some(v) = line.strip_prefix("duration=") {
            let s = v.trim();
            if s != "N/A" {
                duration_secs = s.parse().ok();
            }
        }
    }

    Ok((width, height, duration_secs.map(|s| (s * 1000.0) as i64)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_png(path: &Path, width: u32, height: u32) {
        let img = image::RgbImage::new(width, height);
        img.save(path).expect("save PNG");
    }

    fn make_jpeg(path: &Path, width: u32, height: u32) {
        let img = image::RgbImage::new(width, height);
        img.save(path).expect("save JPEG");
    }

    #[test]
    fn probe_png_returns_correct_dimensions_and_mime() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.png");
        make_png(&path, 800, 600);

        let meta = probe(&path, MediaKind::Image).unwrap();
        assert_eq!(meta.width, Some(800));
        assert_eq!(meta.height, Some(600));
        assert!(meta.duration_ms.is_none());
        assert_eq!(meta.mime_type, "image/png");
        assert!(meta.byte_size > 0);
    }

    #[test]
    fn probe_jpeg_returns_correct_dimensions() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.jpg");
        make_jpeg(&path, 1920, 1080);

        let meta = probe(&path, MediaKind::Image).unwrap();
        assert_eq!(meta.width, Some(1920));
        assert_eq!(meta.height, Some(1080));
        assert_eq!(meta.mime_type, "image/jpeg");
    }

    #[test]
    fn probe_video_tool_missing_for_unknown_binary() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("dummy.mp4");
        std::fs::write(&path, b"not a real video").unwrap();

        let result = probe_video_with_cmd(&path, "this_binary_cannot_exist_xyz_987");
        assert!(
            matches!(result, Err(ProbeError::ToolMissing)),
            "expected ToolMissing, got: {:?}",
            result.err().map(|e| e.to_string())
        );
    }
}
