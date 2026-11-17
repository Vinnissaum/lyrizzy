// Serves one video three ways, to compare how Chromium seeks on each:
//   /handler/v.webm  - like src-tauri/src/protocol/asset.rs today: ignores Range,
//                      200 with the whole file and only Content-Type
//   /chunked/v.webm  - the same, without a Content-Length (chunked)
//   /ranged/v.webm   - honours Range with 206, Accept-Ranges and Content-Range
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const [file, port] = process.argv.slice(2);
const data = readFileSync(file);
const log = [];

createServer((req, res) => {
  log.push(`${req.url} range=${req.headers.range ?? "-"}`);
  if (req.url === "/log") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(log.join("\n"));
    return;
  }
  if (req.url === "/" || req.url.startsWith("/page")) {
    const mode = new URL(req.url, "http://x").searchParams.get("mode") ?? "handler";
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!doctype html><video id="v" src="/${mode}/v.webm" autoplay muted playsinline></video>`);
    return;
  }
  if (req.url === "/handler/v.webm") {
    res.writeHead(200, { "Content-Type": "video/webm", "Content-Length": data.length });
    res.end(data);
    return;
  }
  if (req.url === "/chunked/v.webm") {
    res.writeHead(200, { "Content-Type": "video/webm" });
    res.write(data);
    res.end();
    return;
  }
  if (req.url === "/ranged/v.webm") {
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
    if (!m) {
      res.writeHead(200, { "Content-Type": "video/webm", "Content-Length": data.length, "Accept-Ranges": "bytes" });
      res.end(data);
      return;
    }
    const start = m[1] === "" ? 0 : Number(m[1]);
    const end = m[2] === "" ? data.length - 1 : Math.min(Number(m[2]), data.length - 1);
    res.writeHead(206, {
      "Content-Type": "video/webm",
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${start}-${end}/${data.length}`,
      "Content-Length": end - start + 1,
    });
    res.end(data.subarray(start, end + 1));
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(Number(port), "127.0.0.1");
