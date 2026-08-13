import { describe, it, expect } from "vitest";
import { filenameFromSignature, rewriteManifestUrls } from "./fix-updater-manifest.mjs";

const REPO = "https://github.com/Vinnissaum/lyrizzy";

/** Builds a base64 minisign signature carrying `file:<name>`. */
function signatureFor(name) {
  return Buffer.from(
    [
      "untrusted comment: signature from tauri secret key",
      "RUTTmuWFmR9OTbX/zTi29v1TV4KZzuLTclO5vshEGALZQOgPUbbqbtYIPqGwLq0xA8iWffs9YTG/toTFklcvqG4yt5ZYiLufGww=",
      `trusted comment: timestamp:1786657005\tfile:${name}`,
      "OclvJx8qi73M9fol69qwS2pFl7mcNz8xPJsG6u8iNqL5I5XaYO7fKSHM2RUkScGhny54y3obVk/oybWZIUlvAw==",
      "",
    ].join("\n"),
  ).toString("base64");
}

const apiUrl = (id) => `https://api.github.com/repos/Vinnissaum/lyrizzy/releases/assets/${id}`;

function manifestFixture() {
  return {
    version: "1.2.1",
    notes: "Baixe o instalador para a sua plataforma abaixo.",
    pub_date: "2026-08-13T21:46:40.356Z",
    platforms: {
      "windows-x86_64": {
        signature: signatureFor("Lyrizzy_1.2.1_x64-setup.exe"),
        url: apiUrl(513540956),
      },
      "windows-x86_64-msi": {
        signature: signatureFor("Lyrizzy_1.2.1_x64_en-US.msi"),
        url: apiUrl(513540941),
      },
      "linux-x86_64": {
        signature: signatureFor("Lyrizzy_1.2.1_amd64.AppImage"),
        url: apiUrl(513548667),
      },
    },
  };
}

describe("filenameFromSignature", () => {
  it("recovers the installer name from the trusted comment", () => {
    expect(filenameFromSignature(signatureFor("Lyrizzy_1.2.1_x64-setup.exe"))).toBe(
      "Lyrizzy_1.2.1_x64-setup.exe",
    );
  });

  it("throws when the trusted comment carries no file name", () => {
    const noFile = Buffer.from("trusted comment: timestamp:1786657005\nsig\n").toString("base64");
    expect(() => filenameFromSignature(noFile)).toThrow(/no `file:` trusted comment/);
  });
});

describe("rewriteManifestUrls", () => {
  it("rewrites every API asset URL to the release CDN", () => {
    const { manifest } = rewriteManifestUrls(manifestFixture(), { repoUrl: REPO, tag: "v1.2.1" });

    expect(manifest.platforms["windows-x86_64"].url).toBe(
      `${REPO}/releases/download/v1.2.1/Lyrizzy_1.2.1_x64-setup.exe`,
    );
    expect(manifest.platforms["windows-x86_64-msi"].url).toBe(
      `${REPO}/releases/download/v1.2.1/Lyrizzy_1.2.1_x64_en-US.msi`,
    );
    expect(manifest.platforms["linux-x86_64"].url).toBe(
      `${REPO}/releases/download/v1.2.1/Lyrizzy_1.2.1_amd64.AppImage`,
    );
  });

  it("leaves no api.github.com URL behind", () => {
    const { manifest } = rewriteManifestUrls(manifestFixture(), { repoUrl: REPO, tag: "v1.2.1" });
    expect(JSON.stringify(manifest)).not.toContain("api.github.com");
  });

  it("preserves version, notes and signatures untouched", () => {
    const input = manifestFixture();
    const { manifest } = rewriteManifestUrls(input, { repoUrl: REPO, tag: "v1.2.1" });

    expect(manifest.version).toBe("1.2.1");
    expect(manifest.notes).toBe(input.notes);
    expect(manifest.pub_date).toBe(input.pub_date);
    for (const key of Object.keys(input.platforms)) {
      expect(manifest.platforms[key].signature).toBe(input.platforms[key].signature);
    }
  });

  it("reports what it changed", () => {
    const { changes } = rewriteManifestUrls(manifestFixture(), { repoUrl: REPO, tag: "v1.2.1" });
    expect(changes).toHaveLength(3);
    expect(changes[0]).toMatchObject({ platform: "windows-x86_64", from: apiUrl(513540956) });
  });

  it("is idempotent — a CDN manifest passes through unchanged", () => {
    const once = rewriteManifestUrls(manifestFixture(), { repoUrl: REPO, tag: "v1.2.1" });
    const twice = rewriteManifestUrls(once.manifest, { repoUrl: REPO, tag: "v1.2.1" });

    expect(twice.changes).toHaveLength(0);
    expect(twice.manifest).toEqual(once.manifest);
  });

  it("tolerates a trailing slash on the repo URL", () => {
    const { manifest } = rewriteManifestUrls(manifestFixture(), {
      repoUrl: `${REPO}/`,
      tag: "v1.2.1",
    });
    expect(manifest.platforms["windows-x86_64"].url).toBe(
      `${REPO}/releases/download/v1.2.1/Lyrizzy_1.2.1_x64-setup.exe`,
    );
  });

  it("names the offending platform when a signature is unusable", () => {
    const broken = manifestFixture();
    broken.platforms["linux-x86_64"].signature = Buffer.from("no comment here").toString("base64");
    expect(() => rewriteManifestUrls(broken, { repoUrl: REPO, tag: "v1.2.1" })).toThrow(
      /linux-x86_64/,
    );
  });

  it("rejects a manifest with no platforms", () => {
    expect(() => rewriteManifestUrls({ version: "1.2.1", platforms: {} }, { repoUrl: REPO, tag: "v1.2.1" })).toThrow(
      /no platforms/,
    );
  });
});
