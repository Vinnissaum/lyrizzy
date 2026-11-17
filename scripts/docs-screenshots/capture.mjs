// Regenerates the user-guide screenshots (docs/public/telas/*.webp) from the
// real UI, mounted against the mocked backend and sample library in app.tsx.
//
//   npm run docs:screenshots                 every scene
//   npm run docs:screenshots -- inicio midia only the scenes named
//
// Needs a Chromium build. It uses CHROME_PATH when set; otherwise it looks for
// Playwright's headless shell (npx playwright install chromium-headless-shell)
// and then for a system Chrome/Chromium.
import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const outDir = join(root, "docs", "public", "telas");

const OPERATOR = { width: 1280, height: 800 };
const WALL = { width: 1280, height: 720 };
const SCALE = 1.5; // 1920 px wide images, sharp when zoomed in the docs
const QUALITY = 85;

// Each scene: the window and starting state (query), page-side steps run in
// order (each an async expression using window.__docs), and an optional clip
// (a page-side expression returning the element to crop to, plus padding).
const scenes = [
  { name: "inicio" },
  { name: "conjunto-itens", steps: [`__docs.click("Abertura do Culto", "*")`, `__docs.waitText("Repetir (loop)", "*")`] },
  {
    name: "gerenciar-conjuntos",
    steps: [`__docs.clickSel('[aria-label="Gerenciar conjuntos"]')`, `__docs.waitText("Gerenciar conjuntos", "h3")`],
    clip: `__docs.dialogOf("Gerenciar conjuntos")`,
  },
  { name: "biblioteca", steps: [`__docs.click("Biblioteca", "header button")`, `__docs.waitText("Graça que Alcança", "*")`] },
  {
    name: "editor-musica",
    steps: [`__docs.click("Biblioteca", "header button")`, `__docs.click("Graça que Alcança", "*")`, `__docs.waitSel("textarea")`],
  },
  {
    name: "holyrics-selecionar",
    steps: [
      `__docs.click("Biblioteca", "header button")`,
      `__docs.click("Importar do Holyrics")`,
      `__docs.click("Escolher arquivo…")`,
      `__docs.waitText("Selecionar músicas", "*")`,
    ],
  },
  { name: "apresentando", query: "present=i-graca&slide=2", wait: `__docs.waitText("Ao vivo", "header")` },
  { name: "telao-letra", window: "presentation", query: "present=i-graca&slide=2" },
  {
    name: "aviso-dialogo",
    query: "present=i-graca&slide=2",
    steps: [
      `__docs.click("Aviso")`,
      `__docs.type("textarea", "Carro placa ABC-1234 com o farol aceso no estacionamento")`,
    ],
    clip: `__docs.dialogOf("Enviar aviso")`,
  },
  {
    name: "cronometro-config",
    query: "scheduled=1",
    size: { width: 1280, height: 1240 }, // tall enough for the whole dialog, schedule included
    steps: [`__docs.click("Configurar / Agendar")`, `__docs.waitText("Configurar cronômetro", "h2, h3")`],
    clip: `__docs.dialogOf("Configurar cronômetro")`,
  },
  { name: "telao-cronometro", window: "presentation", query: "present=i-cd&countdown=running" },
  {
    name: "cronometro-widget",
    query: "scheduled=1",
    wait: `__docs.waitSel('[data-testid="scheduled-countdown-widget"]')`,
    clip: `document.querySelector('[data-testid="scheduled-countdown-widget"]')`,
    pad: { top: 150, left: 380, right: 16, bottom: 16 },
  },
  { name: "midia", steps: [`__docs.click("Mídia", "header button")`, `__docs.click("Fundo Aurora", "*")`, `__docs.waitText("Detalhes", "*")`] },
  { name: "duas-telas", query: "present=i-graca&slide=2&multi=1", wait: `__docs.waitText("Simultânea", "*")` },
  {
    name: "camera-editor",
    size: { width: 1280, height: 1500 }, // the whole editor, both profiles included
    // The camera item's summary line ("Câmera — rtsp://…") opens its editor.
    steps: [`__docs.clickSel("p.text-purple-400")`, `__docs.waitText("Perfis de transmissão", "*")`],
    clip: `__docs.itemOf("Perfis de transmissão")`,
    pad: { top: 12, left: 12, right: 12, bottom: 0 },
  },
  { name: "backup", steps: [`__docs.click("Backup", "header button")`, `__docs.waitText("Exportar biblioteca…")`] },
  {
    name: "revisar-importacao",
    steps: [`__docs.click("Backup", "header button")`, `__docs.click("Selecionar arquivo…")`, `__docs.waitText("Revisar importação", "h3")`],
    clip: `__docs.dialogOf("Revisar importação")`,
  },
  { name: "config-geral", steps: [`__docs.click("Configurações", "header button")`, `__docs.waitText("Nomes dos monitores", "*")`] },
  { name: "config-projecao", steps: [`__docs.click("Configurações", "header button")`, `__docs.click("Projeção")`] },
  { name: "config-atalhos", steps: [`__docs.click("Configurações", "header button")`, `__docs.click("Atalhos")`, `__docs.waitText("Restaurar padrões")`] },
  {
    name: "config-relatorios",
    steps: [`__docs.click("Configurações", "header button")`, `__docs.click("Relatórios")`, `__docs.waitText("Exportar CSV")`],
  },
];

// Helpers available to the steps as window.__docs.
const HELPERS = `
window.__docs = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  async waitFor(fn, what, timeout = 10000) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) {
      const v = fn();
      if (v) return v;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("timed out waiting for " + what);
  },
  // The deepest element matching selector whose text is exactly text.
  find(text, selector = "button") {
    const hits = [...document.querySelectorAll(selector)].filter((e) => e.textContent.trim() === text);
    return hits.length ? hits[hits.length - 1] : null;
  },
  waitText(text, selector = "button", count = 1) {
    return this.waitFor(
      () => [...document.querySelectorAll(selector)].filter((e) => e.textContent.trim() === text).length >= count,
      JSON.stringify(text),
    );
  },
  waitSel(selector) {
    return this.waitFor(() => document.querySelector(selector), selector);
  },
  async click(text, selector = "button") {
    const el = await this.waitFor(() => this.find(text, selector), JSON.stringify(text));
    el.click();
    await this.sleep(350);
  },
  async clickSel(selector) {
    const el = await this.waitSel(selector);
    el.click();
    await this.sleep(350);
  },
  async type(selector, value) {
    const el = await this.waitSel(selector);
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await this.sleep(250);
  },
  // The panel of the modal whose heading reads text: the child of the fixed backdrop.
  dialogOf(text) {
    let el = this.find(text, "h2, h3");
    while (el && el.parentElement && !/(^|\\s)fixed(\\s|$)/.test(el.parentElement.className)) el = el.parentElement;
    return el;
  },
  // The set item card (in the set builder) that contains text, cut to the
  // part of it its scrolling list shows.
  itemOf(text) {
    const el = this.find(text, "*");
    const card = el && el.closest(".rounded-lg.bg-surface");
    if (!card) return null;
    card.scrollIntoView({ block: "start" });
    const list = card.closest(".overflow-y-auto");
    return {
      getBoundingClientRect() {
        const a = card.getBoundingClientRect();
        const b = list ? list.getBoundingClientRect() : a;
        const top = Math.max(a.top, b.top);
        const bottom = Math.min(a.bottom, b.bottom);
        return { left: a.left, top, width: a.width, height: bottom - top };
      },
    };
  },
};
`;

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = join(homedir(), ".cache", "ms-playwright");
  if (existsSync(cache)) {
    const dirs = readdirSync(cache).sort().reverse();
    for (const d of dirs) {
      const candidates = [
        join(cache, d, "chrome-headless-shell-linux64", "chrome-headless-shell"),
        join(cache, d, "chrome-linux64", "chrome"),
        join(cache, d, "chrome-linux", "chrome"),
      ];
      const hit = candidates.find((c) => existsSync(c));
      if (hit) return hit;
    }
  }
  for (const c of ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"]) {
    if (existsSync(c)) return c;
  }
  throw new Error("Chromium not found. Set CHROME_PATH or run: npx playwright install chromium-headless-shell");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const only = process.argv.slice(2);
  const selected = only.length ? scenes.filter((s) => only.includes(s.name)) : scenes;
  if (only.length && selected.length !== only.length) {
    const known = scenes.map((s) => s.name).join(", ");
    throw new Error(`Unknown scene in ${only.join(", ")}. Known: ${known}`);
  }
  mkdirSync(outDir, { recursive: true });

  // Sample media, served where the app expects asset files.
  const mediaDir = join(here, "media");
  const types = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webm": "video/webm" };
  const mediaServer = createHttpServer((req, res) => {
    const name = decodeURIComponent((req.url ?? "").replace(/^\/media\//, "").split("?")[0]);
    const file = join(mediaDir, name);
    if (!name || name.includes("..") || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  await new Promise((r) => mediaServer.listen(0, "127.0.0.1", r));
  const mediaPort = mediaServer.address().port;

  const vite = await createServer({
    root,
    configFile: join(root, "vite.config.ts"),
    server: { port: 1435, strictPort: false, host: "127.0.0.1" },
    logLevel: "warn",
    clearScreen: false,
  });
  await vite.listen();
  const base = vite.resolvedUrls.local[0].replace(/\/$/, "");

  const debugPort = 9300 + Math.floor(Math.random() * 500);
  const chrome = spawn(
    findChrome(),
    [
      `--remote-debugging-port=${debugPort}`,
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--lang=pt-BR",
      "--autoplay-policy=no-user-gesture-required",
      `--host-resolver-rules=MAP asset.localhost 127.0.0.1:${mediaPort}`,
      "about:blank",
    ],
    // Brazilian formats in date fields (dd/mm/aaaa), as on the church's computer.
    { stdio: "ignore", env: { ...process.env, LANG: "pt_BR.UTF-8", LANGUAGE: "pt_BR:pt" } },
  );

  let failures = 0;
  try {
    const page = await connect(debugPort);
    for (const scene of selected) {
      try {
        await capture(page, scene, base);
      } catch (err) {
        failures++;
        console.error(`✗ ${scene.name}: ${err.message}`);
        // What the page showed when the scene failed, to fix its steps.
        const debugFile = join(tmpdir(), `lyrizzy-docs-${scene.name}.webp`);
        const shot = await page.send("Page.captureScreenshot", { format: "webp", quality: 70 }).catch(() => null);
        if (shot) {
          writeFileSync(debugFile, Buffer.from(shot.data, "base64"));
          console.error(`    tela no momento da falha: ${debugFile}`);
        }
        for (const line of page.logs.slice(0, 6)) console.error(`    página: ${line}`);
      }
    }
    page.ws.close();
  } finally {
    chrome.kill();
    await vite.close();
    mediaServer.close();
  }
  if (failures) {
    console.error(`${failures} scene(s) failed`);
    process.exit(1);
  }
}

async function connect(port) {
  let targets = [];
  for (let i = 0; i < 100 && !targets.length; i++) {
    try {
      targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).filter((t) => t.type === "page");
    } catch {
      await sleep(100);
    }
  }
  if (!targets.length) throw new Error("Chromium did not start");
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
    if (m.method === "Runtime.exceptionThrown") {
      logs.push(m.params.exceptionDetails.exception?.description?.split("\n")[0] ?? m.params.exceptionDetails.text);
    }
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      logs.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 240));
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description?.split("\n")[0] ?? r.exceptionDetails.text);
    }
    return r.result?.value;
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await send("Emulation.setLocaleOverride", { locale: "pt-BR" });
  await send("Emulation.setTimezoneOverride", { timezoneId: "America/Sao_Paulo" });
  return { ws, send, evaluate, logs };
}

async function capture(page, scene, base) {
  const { send, evaluate, logs } = page;
  const isWall = scene.window === "presentation";
  const size = scene.size ?? (isWall ? WALL : OPERATOR);
  logs.length = 0;

  await send("Emulation.setDeviceMetricsOverride", { width: size.width, height: size.height, deviceScaleFactor: SCALE, mobile: false });
  const query = [`window=${isWall ? "presentation" : "operator"}`, scene.query].filter(Boolean).join("&");
  await send("Page.navigate", { url: `${base}/scripts/docs-screenshots/index.html?${query}` });

  // Wait for React to mount, then install the helpers.
  for (let i = 0; i < 200; i++) {
    if (await evaluate(`document.readyState === "complete" && !!document.querySelector("#root")?.children.length`)) break;
    await sleep(50);
  }
  await evaluate(`${HELPERS}; true`);
  // Run a page-side step to completion; its value (often a DOM node) stays in the page.
  const run = (expr) => evaluate(`(async () => { await (${expr}); return true; })()`);
  if (!isWall) {
    // Skip the launch splash (it listens for any pointer press).
    await run(`__docs.waitSel('[data-testid="splash-screen"]').catch(() => null)`);
    await run(`window.dispatchEvent(new PointerEvent("pointerdown"))`);
    await run(`__docs.waitFor(() => !document.querySelector('[data-testid="splash-screen"]'), "splash to close")`);
  }
  await run(scene.wait ?? (isWall ? `__docs.sleep(800)` : `__docs.waitSel('header button')`));
  for (const step of scene.steps ?? []) await run(step);

  // Let images decode and layout settle.
  await run(`__docs.waitFor(() => [...document.images].every((i) => i.complete), "images")`);
  await run(`document.fonts.ready`);
  await sleep(600);

  let clip;
  if (scene.clip) {
    const pad = typeof scene.pad === "number" || scene.pad === undefined
      ? { top: scene.pad ?? 16, left: scene.pad ?? 16, right: scene.pad ?? 16, bottom: scene.pad ?? 16 }
      : scene.pad;
    const rect = await evaluate(`(() => {
      const el = ${scene.clip};
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    })()`);
    if (!rect) throw new Error("clip element not found");
    const x = Math.max(0, rect.x - pad.left);
    const y = Math.max(0, rect.y - pad.top);
    const right = Math.min(size.width, rect.x + rect.width + pad.right);
    const bottom = Math.min(size.height, rect.y + rect.height + pad.bottom);
    clip = { x, y, width: right - x, height: bottom - y, scale: 1 };
  }

  const shot = await send("Page.captureScreenshot", { format: "webp", quality: QUALITY, ...(clip ? { clip } : {}) });
  const file = join(outDir, `${scene.name}.webp`);
  writeFileSync(file, Buffer.from(shot.data, "base64"));

  const unhandled = await evaluate(`[...(window.__unhandled ?? [])].join(", ")`);
  console.log(`✓ ${scene.name}.webp${unhandled ? `  (sem mock: ${unhandled})` : ""}`);
  for (const line of logs.slice(0, 6)) console.log(`    página: ${line}`);
}

await main();
