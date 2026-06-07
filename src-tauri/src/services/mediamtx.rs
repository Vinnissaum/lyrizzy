/// MediaMTX sidecar service — bridges a camera's RTMP(S) stream to WebRTC so it
/// can play in WebView2 (Chromium dropped RTMP/Flash years ago, so `<video
/// src="rtmp://…">` never works).
///
/// MediaMTX is run as a single managed process configured to *pull* from the
/// camera's RTMP URL on demand and *serve* it over WebRTC (WHEP) on localhost.
/// The frontend then plays the WHEP endpoint in a plain `<video>`.
///
/// We re-write the config and restart the process whenever the target RTMP URL
/// changes (only one camera is presented at a time), which avoids depending on
/// an HTTP client to drive the MediaMTX control API.
use std::path::{Path, PathBuf};

/// Localhost WebRTC (WHEP) port MediaMTX serves readers on.
pub const WEBRTC_PORT: u16 = 8889;
/// Fixed path name for the single proxied camera stream.
pub const PATH_NAME: &str = "cam";

/// Bundled MediaMTX executable file name, per platform.
#[cfg(windows)]
const BUNDLED_BIN: &str = "mediamtx.exe";
#[cfg(not(windows))]
const BUNDLED_BIN: &str = "mediamtx";

/// Resolve the MediaMTX executable path.
///
/// Priority (mirrors the LibreOffice resolver):
/// 1. Bundled: `<resource_dir>/mediamtx/<mediamtx|mediamtx.exe>`
/// 2. `MEDIAMTX_PATH` environment variable
/// 3. `mediamtx` on PATH (probed via `--version`)
pub fn mediamtx_path(resource_dir: Option<&Path>) -> Option<PathBuf> {
    // 1. Bundled binary
    if let Some(res) = resource_dir {
        let bundled = res.join("mediamtx").join(BUNDLED_BIN);
        if bundled.exists() {
            return Some(bundled);
        }
    }

    // 2. MEDIAMTX_PATH env var
    if let Ok(val) = std::env::var("MEDIAMTX_PATH") {
        let p = PathBuf::from(val);
        if p.exists() {
            return Some(p);
        }
    }

    // 3. `mediamtx` on PATH.
    let ok = std::process::Command::new("mediamtx")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    if ok {
        return Some(PathBuf::from("mediamtx"));
    }

    None
}

/// WHEP URL a WebRTC reader connects to for the proxied stream.
pub fn whep_url() -> String {
    format!("http://127.0.0.1:{WEBRTC_PORT}/{PATH_NAME}/whep")
}

/// Render the minimal MediaMTX YAML config that proxies `rtmp_url` to WebRTC.
///
/// All servers except WebRTC are disabled and everything is bound to localhost.
/// `sourceOnDemand` makes MediaMTX connect to the camera only while a reader is
/// attached, so we don't hammer the camera when nothing is being presented.
/// Targets MediaMTX v1.x config keys.
pub fn render_config(rtmp_url: &str) -> String {
    // YAML single-quoted scalar: escape embedded single quotes by doubling them.
    let escaped = rtmp_url.replace('\'', "''");
    format!(
        "logLevel: error\n\
         api: no\n\
         metrics: no\n\
         pprof: no\n\
         playback: no\n\
         rtsp: no\n\
         rtmp: no\n\
         hls: no\n\
         srt: no\n\
         webrtc: yes\n\
         webrtcAddress: 127.0.0.1:{WEBRTC_PORT}\n\
         webrtcEncryption: no\n\
         webrtcLocalUDPAddress: 127.0.0.1:8189\n\
         webrtcLocalTCPAddress: 127.0.0.1:8189\n\
         webrtcIPsFromInterfaces: no\n\
         webrtcAdditionalHosts: [127.0.0.1]\n\
         paths:\n  \
           {PATH_NAME}:\n    \
             source: '{escaped}'\n    \
             sourceOnDemand: yes\n",
    )
}

/// Write the rendered config to `<dir>/mediamtx.yml` and return its path.
pub fn write_config(dir: &Path, rtmp_url: &str) -> std::io::Result<PathBuf> {
    let path = dir.join("mediamtx.yml");
    std::fs::write(&path, render_config(rtmp_url))?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn bundled_bin_name_is_platform_correct() {
        if cfg!(windows) {
            assert_eq!(BUNDLED_BIN, "mediamtx.exe");
        } else {
            assert_eq!(BUNDLED_BIN, "mediamtx");
        }
    }

    #[test]
    fn mediamtx_path_bundled_takes_priority() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path().join("mediamtx");
        std::fs::create_dir_all(&dir).unwrap();
        let exe = dir.join(BUNDLED_BIN);
        std::fs::write(&exe, b"stub").unwrap();

        assert_eq!(mediamtx_path(Some(tmp.path())), Some(exe));
    }

    #[test]
    fn mediamtx_path_env_var_fallback() {
        let tmp = TempDir::new().unwrap();
        let exe = tmp.path().join(BUNDLED_BIN);
        std::fs::write(&exe, b"stub").unwrap();

        std::env::set_var("MEDIAMTX_PATH", exe.to_str().unwrap());
        let result = mediamtx_path(None);
        std::env::remove_var("MEDIAMTX_PATH");

        assert_eq!(result, Some(exe));
    }

    #[test]
    fn whep_url_points_at_localhost_path() {
        assert_eq!(whep_url(), "http://127.0.0.1:8889/cam/whep");
    }

    #[test]
    fn render_config_embeds_source_and_disables_other_servers() {
        let cfg = render_config("rtmp://192.168.100.138/live/stream0");
        assert!(cfg.contains("source: 'rtmp://192.168.100.138/live/stream0'"));
        assert!(cfg.contains("webrtc: yes"));
        assert!(cfg.contains("rtmp: no"));
        assert!(cfg.contains("sourceOnDemand: yes"));
    }

    #[test]
    fn render_config_escapes_single_quotes() {
        let cfg = render_config("rtmp://h/a'b");
        assert!(cfg.contains("source: 'rtmp://h/a''b'"));
    }

    #[test]
    fn write_config_creates_file() {
        let tmp = TempDir::new().unwrap();
        let path = write_config(tmp.path(), "rtmp://h/s").unwrap();
        assert!(path.exists());
        let contents = std::fs::read_to_string(&path).unwrap();
        assert!(contents.contains("rtmp://h/s"));
    }
}
