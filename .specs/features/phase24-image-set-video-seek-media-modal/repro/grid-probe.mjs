import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { readFileSync } from "node:fs";
const CHROME = `${homedir()}/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell`;
const PORT = 9900 + Math.floor(Math.random() * 50);
const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, "--no-sandbox", "--disable-gpu", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 50; i++) { try { await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch {} await sleep(100); }
const html = readFileSync(new URL("./grid.html", import.meta.url), "utf8");
for (const [w, hash] of [[340, ""], [340, "#fixed"]]) {
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const url = "data:text/html;base64," + Buffer.from(html.replace("VAR_W", String(w)).replace("location.hash==='#fixed'", hash ? "true" : "false")).toString("base64");
  await send("Page.navigate", { url }); await sleep(500);
  const r = await send("Runtime.evaluate", { returnByValue: true, expression: `[...document.querySelectorAll('.card')].slice(0,6).map(c=>{const b=c.getBoundingClientRect();const th=c.querySelector('.thumb').getBoundingClientRect();return {top:Math.round(b.top),h:Math.round(b.height),thumbW:Math.round(th.width),thumbH:Math.round(th.height)}})` });
  console.log(w, hash || "(as today)", JSON.stringify(r.result.result.value));
  ws.close();
}
chrome.kill(); process.exit(0);
