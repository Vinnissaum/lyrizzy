use std::path::Path;

#[derive(Debug)]
pub enum ThumbnailError {
    ToolMissing,
    Failed { stderr_excerpt: String },
}

impl std::fmt::Display for ThumbnailError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ToolMissing => write!(f, "ffmpeg not found in PATH"),
            Self::Failed { stderr_excerpt } => write!(f, "ffmpeg failed: {stderr_excerpt}"),
        }
    }
}

/// Extract a 200×113 JPEG thumbnail at the 1-second mark of a video file.
///
/// Falls back gracefully when ffmpeg is missing — callers should treat
/// `ThumbnailError::ToolMissing` as a non-fatal condition.
pub async fn generate(input: &Path, output: &Path) -> Result<(), ThumbnailError> {
    let cmd = std::env::var("FFMPEG_PATH").unwrap_or_else(|_| "ffmpeg".to_string());
    generate_with_cmd(input, output, &cmd).await
}

/// Testable variant — accepts the ffmpeg binary path directly.
pub async fn generate_with_cmd(
    input: &Path,
    output: &Path,
    cmd: &str,
) -> Result<(), ThumbnailError> {
    let result = tokio::process::Command::new(cmd)
        .args(["-y", "-ss", "00:00:01", "-i"])
        .arg(input)
        .args(["-frames:v", "1", "-vf", "scale=200:-2", "-q:v", "4"])
        .arg(output)
        .output()
        .await
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                ThumbnailError::ToolMissing
            } else {
                ThumbnailError::Failed {
                    stderr_excerpt: e.to_string(),
                }
            }
        })?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        let excerpt: String = stderr.chars().take(500).collect();
        return Err(ThumbnailError::Failed {
            stderr_excerpt: excerpt,
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn tool_missing_for_unknown_binary() {
        let dir = TempDir::new().unwrap();
        let input = dir.path().join("input.mp4");
        let output = dir.path().join("thumb.jpg");
        std::fs::write(&input, b"not a real video").unwrap();

        let result = generate_with_cmd(&input, &output, "this_binary_cannot_exist_xyz_987").await;
        assert!(
            matches!(result, Err(ThumbnailError::ToolMissing)),
            "expected ToolMissing"
        );
    }

    /// Requires ffmpeg in PATH. Run with: cargo test -- --include-ignored
    #[tokio::test]
    #[ignore]
    async fn generates_jpeg_thumbnail_for_fixture_video() {
        let dir = TempDir::new().unwrap();
        // This test requires a real video file at tests/fixtures/sample.mp4
        let input = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/sample.mp4");
        if !input.exists() {
            return; // Skip if fixture not present
        }
        let output = dir.path().join("thumb.jpg");

        generate(&input, &output).await.unwrap();

        assert!(output.exists(), "thumbnail file must exist");
        let magic = std::fs::read(&output).unwrap();
        assert_eq!(&magic[..2], &[0xFF, 0xD8], "JPEG magic bytes expected");
    }
}
