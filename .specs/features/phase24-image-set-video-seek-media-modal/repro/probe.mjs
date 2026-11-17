// Drives headless Chromium over CDP: for each serving mode, plays the video,
// then pauses, resumes and seeks the way MediaSlideRenderer does on a command,
// and reads what the element did.
import { spawn } from "node:child_process";
import { homedir } from "node:os";

const [serverPort] = process.argv.slice(2);
const CHROME = `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`;
const PORT = 9800 + Math.floor(Math.random() * 100);
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, "--no-sandbox", "--disable-gpu",
  "--autoplay-policy=no-user-gesture-required", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 50; i++) { try { await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch {} await sleep(100); }

async function page(url) {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
  await send("Page.navigate", { url });
  return { evaluate, close: () => ws.close() };
}

const STATE = `(() => { const v = document.getElementById('v'); const s = []; for (let i = 0; i < v.seekable.length; i++) s.push([v.seekable.start(i), v.seekable.end(i)]); return { t: +v.currentTime.toFixed(2), paused: v.paused, duration: v.duration, seekable: s }; })()`;
const seekTo = (sec) => `new Promise((r) => { const v = document.getElementById('v'); v.addEventListener('seeked', () => r(+v.currentTime.toFixed(2)), { once: true }); v.currentTime = ${sec}; setTimeout(() => r('no seeked event, at ' + v.currentTime.toFixed(2)), 3000); })`;

for (const mode of ["handler", "chunked", "ranged"]) {
  const p = await page(`http://127.0.0.1:${serverPort}/page?mode=${mode}`);
  await sleep(3000);
  const playing = await p.evaluate(STATE);
  await p.evaluate(`document.getElementById('v').pause()`);
  await sleep(1000);
  const paused = await p.evaluate(STATE);
  await p.evaluate(`document.getElementById('v').play()`);
  await sleep(1000);
  const resumed = await p.evaluate(STATE);
  const afterSeek10 = await p.evaluate(seekTo(10));
  await sleep(300);
  const afterSkip = await p.evaluate(`(() => { const v = document.getElementById('v'); return v.currentTime; })()`).then(async (now) => p.evaluate(seekTo(`${now} + 10`)));
  console.log(JSON.stringify({ mode, playing, paused, resumed, afterSeek10, afterSkipPlus10: afterSkip }));
  p.close();
}
console.log((await (await fetch(`http://127.0.0.1:${serverPort}/log`)).text()));
chrome.kill();
process.exit(0);
