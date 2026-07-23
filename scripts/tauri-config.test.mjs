import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const confPath = path.resolve(__dirname, "../src-tauri/tauri.conf.json");
const conf = JSON.parse(readFileSync(confPath, "utf8"));

describe("tauri.conf.json — updater artifacts", () => {
  it("enables createUpdaterArtifacts so tauri build emits .sig files", () => {
    expect(conf.bundle.createUpdaterArtifacts).toBe(true);
  });
});

describe("tauri.conf.json — updater endpoint", () => {
  it("points at the real Vinnissaum/triade GitHub Releases latest.json", () => {
    expect(conf.plugins.updater.endpoints).toEqual([
      "https://github.com/Vinnissaum/triade/releases/latest/download/latest.json",
    ]);
  });

  it("does not point at the OWNER/REPO placeholder", () => {
    expect(JSON.stringify(conf.plugins.updater.endpoints)).not.toContain("OWNER/REPO");
  });
});

describe("tauri.conf.json — updater pubkey", () => {
  it("is non-empty and not the placeholder string", () => {
    const pubkey = conf.plugins.updater.pubkey;
    expect(pubkey).toBeTruthy();
    expect(pubkey).not.toContain("PLACEHOLDER");
  });

  it("base64-decodes without throwing to a minisign public key block", () => {
    const pubkey = conf.plugins.updater.pubkey;
    let decoded;
    expect(() => {
      decoded = Buffer.from(pubkey, "base64").toString("utf8");
    }).not.toThrow();
    expect(decoded).toContain("minisign public key");
  });
});

describe("tauri.conf.json — updater install behavior", () => {
  it("uses passive Windows install mode (no UAC prompt, progress bar shown)", () => {
    expect(conf.plugins.updater.windows.installMode).toBe("passive");
  });

  it("keeps the built-in updater dialog disabled — the app drives its own UI", () => {
    expect(conf.plugins.updater.dialog).toBe(false);
  });
});
