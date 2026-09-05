/// MediaMTX sidecar service — bridges a camera's RTSP stream to WebRTC so it
/// can play in WebView2 (Chromium never speaks RTSP directly, so it doesn't
/// play in a `<video>` element as-is).
///
/// MediaMTX is run as a single managed process configured to ingest the camera
/// stream and *serve* it over WebRTC (WHEP) on localhost. The frontend then
/// plays the WHEP endpoint in a plain `<video>`.
///
/// We re-write the config and restart the process whenever the target source
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

    // 2. MEDIAMTX_PATH env var — accept either the executable itself or a
    //    directory containing it (a common misconfiguration).
    if let Ok(val) = std::env::var("MEDIAMTX_PATH") {
        let p = PathBuf::from(val.trim());
        if p.is_dir() {
            let exe = p.join(BUNDLED_BIN);
            if exe.exists() {
                return Some(exe);
            }
        } else if p.exists() {
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

/// An RTSP camera stream MediaMTX should ingest and re-serve over WebRTC.
pub struct RtspSource {
    pub url: String,
    /// Maps to MediaMTX's `rtspTransport` (e.g. "udp", "tcp"); `None` lets
    /// MediaMTX choose automatically.
    pub transport: Option<String>,
}

/// YAML single-quoted scalar: escape embedded single quotes by doubling them.
fn yaml_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

/// Render the minimal MediaMTX YAML config that bridges `source` to WebRTC.
///
/// Every server except WebRTC is disabled, and WebRTC is bound to localhost.
/// `sourceOnDemand` makes MediaMTX connect to the camera only while a reader
/// is attached, so we don't hammer it when nothing is being presented.
/// Targets MediaMTX v1.x config keys.
pub fn render_config(source: &RtspSource) -> String {
    let transport_line = source
        .transport
        .as_deref()
        .map(|t| format!("    rtspTransport: {t}\n"))
        .unwrap_or_default();
    let path_body = format!(
        "    source: {}\n{transport_line}    sourceOnDemand: yes\n",
        yaml_quote(&source.url)
    );

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
           {PATH_NAME}:\n\
         {path_body}",
    )
}

/// Build the `srt://` source URL MediaMTX dials for a listener camera, from the
/// individual SRT parameters. `latency_ms` and `overhead_bw` are libsrt
/// `latency`/`oheadbw` query params; a passphrase enables encryption.
pub fn build_srt_url(
    host: &str,
    port: u16,
    stream_id: Option<&str>,
    passphrase: Option<&str>,
    latency_ms: Option<u32>,
    overhead_bw: Option<u32>,
) -> String {
    let mut params: Vec<String> = Vec::new();
    if let Some(id) = stream_id.filter(|s| !s.is_empty()) {
        params.push(format!("streamid={}", urlencode(id)));
    }
    if let Some(pass) = passphrase.filter(|s| !s.is_empty()) {
        params.push(format!("passphrase={}", urlencode(pass)));
    }
    if let Some(ms) = latency_ms {
        params.push(format!("latency={ms}"));
    }
    if let Some(bw) = overhead_bw {
        params.push(format!("oheadbw={bw}"));
    }
    if params.is_empty() {
        format!("srt://{host}:{port}")
    } else {
        format!("srt://{host}:{port}?{}", params.join("&"))
    }
}

/// Percent-encode an SRT query value (passphrases/streamids may contain `&`,
/// `=`, spaces, etc.). Keeps unreserved characters per RFC 3986.
fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// Write the rendered config to `<dir>/mediamtx.yml` and return its path.
pub fn write_config(dir: &Path, source: &RtspSource) -> std::io::Result<PathBuf> {
    let path = dir.join("mediamtx.yml");
    std::fs::write(&path, render_config(source))?;
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

        // Both kept in one test: they mutate the same process-wide env var, so
        // splitting them risks a race under parallel test execution.

        // (a) env var points at the executable itself.
        std::env::set_var("MEDIAMTX_PATH", exe.to_str().unwrap());
        let from_file = mediamtx_path(None);

        // (b) env var points at the *directory* containing it.
        std::env::set_var("MEDIAMTX_PATH", tmp.path().to_str().unwrap());
        let from_dir = mediamtx_path(None);

        std::env::remove_var("MEDIAMTX_PATH");

        assert_eq!(from_file, Some(exe.clone()));
        assert_eq!(from_dir, Some(exe));
    }

    #[test]
    fn whep_url_points_at_localhost_path() {
        assert_eq!(whep_url(), "http://127.0.0.1:8889/cam/whep");
    }

    #[test]
    fn render_config_rtsp_embeds_source_and_disables_other_servers() {
        let cfg = render_config(&RtspSource {
            url: "rtsp://192.168.100.138/live/stream0".to_string(),
            transport: None,
        });
        assert!(cfg.contains("source: 'rtsp://192.168.100.138/live/stream0'"));
        assert!(cfg.contains("webrtc: yes"));
        assert!(cfg.contains("rtmp: no"));
        assert!(cfg.contains("srt: no"));
        assert!(cfg.contains("sourceOnDemand: yes"));
    }

    #[test]
    fn render_config_escapes_single_quotes() {
        let cfg = render_config(&RtspSource {
            url: "rtsp://h/a'b".to_string(),
            transport: None,
        });
        assert!(cfg.contains("source: 'rtsp://h/a''b'"));
    }

    #[test]
    fn render_config_rtsp_includes_transport() {
        let cfg = render_config(&RtspSource {
            url: "rtsp://192.168.15.50/1".to_string(),
            transport: Some("udp".to_string()),
        });
        assert!(cfg.contains("source: 'rtsp://192.168.15.50/1'"));
        assert!(cfg.contains("rtspTransport: udp"));
        assert!(cfg.contains("sourceOnDemand: yes"));
    }

    #[test]
    fn render_config_rtsp_omits_transport_when_none() {
        let cfg = render_config(&RtspSource {
            url: "rtsp://h/1".to_string(),
            transport: None,
        });
        assert!(cfg.contains("source: 'rtsp://h/1'"));
        assert!(!cfg.contains("rtspTransport"));
    }

    #[test]
    fn render_config_never_emits_srt_server_block() {
        let cfg = render_config(&RtspSource {
            url: "rtsp://h/1".to_string(),
            transport: None,
        });
        assert!(cfg.contains("srt: no"));
        assert!(!cfg.contains("srtAddress"));
    }

    #[test]
    fn build_srt_url_assembles_query_params() {
        let url = build_srt_url(
            "192.168.100.138",
            9000,
            Some("stream0"),
            Some("s3cr3t"),
            Some(120),
            Some(25),
        );
        assert_eq!(
            url,
            "srt://192.168.100.138:9000?streamid=stream0&passphrase=s3cr3t&latency=120&oheadbw=25"
        );
    }

    #[test]
    fn build_srt_url_omits_empty_params() {
        let url = build_srt_url("host", 9000, None, None, None, None);
        assert_eq!(url, "srt://host:9000");
    }

    #[test]
    fn build_srt_url_percent_encodes_passphrase() {
        let url = build_srt_url("h", 9, None, Some("a b&c"), None, None);
        assert!(url.contains("passphrase=a%20b%26c"));
    }

    #[test]
    fn write_config_creates_file() {
        let tmp = TempDir::new().unwrap();
        let path = write_config(
            tmp.path(),
            &RtspSource {
                url: "rtsp://h/s".to_string(),
                transport: None,
            },
        )
        .unwrap();
        assert!(path.exists());
        let contents = std::fs::read_to_string(&path).unwrap();
        assert!(contents.contains("rtsp://h/s"));
    }
}
