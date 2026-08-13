#!/usr/bin/env node
// Rewrites a tauri-action `latest.json` so every platform URL points at the
// public release CDN instead of the GitHub REST API.
//
// tauri-action builds the release as a draft (release.yml sets
// releaseDraft: true). Draft assets have no usable browser_download_url yet,
// so the generated manifest falls back to
//   https://api.github.com/repos/OWNER/REPO/releases/assets/<id>
// Those URLs keep working after the release is published, but they are served
// by the REST API and therefore share the unauthenticated rate limit of 60
// requests/hour/IP. A church network that has spent its budget gets HTTP 403
// with a JSON body instead of the installer, which the updater surfaces as
// `update.download_failed`. The CDN form has no such limit.
//
// The installer filename is recovered from the minisign trusted comment
// embedded in each signature (`file:<name>`), so no API call is needed.
//
//   node scripts/fix-updater-manifest.mjs latest.json v1.2.1 \
//     --repo-url https://github.com/Vinnissaum/lyrizzy

import { readFileSync, writeFileSync } from "node:fs";

const API_ASSET_URL = /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/releases\/assets\/\d+$/;

/** Pulls `file:<name>` out of a base64 minisign signature's trusted comment. */
export function filenameFromSignature(signature) {
  let decoded;
  try {
    decoded = Buffer.from(signature, "base64").toString("utf8");
  } catch {
    throw new Error("signature is not valid base64");
  }
  const match = /^trusted comment:.*?\bfile:(\S+)/m.exec(decoded);
  if (!match) {
    throw new Error("signature has no `file:` trusted comment");
  }
  return match[1];
}

/**
 * Returns a copy of `manifest` with every platform URL rewritten to
 * `<repoUrl>/releases/download/<tag>/<installer>`. Already-CDN URLs are left
 * alone, so running this twice is a no-op.
 */
export function rewriteManifestUrls(manifest, { repoUrl, tag }) {
  const platforms = manifest?.platforms;
  if (!platforms || Object.keys(platforms).length === 0) {
    throw new Error("manifest has no platforms");
  }

  const base = repoUrl.replace(/\/+$/, "");
  const rewritten = {};
  const changes = [];

  for (const [platform, entry] of Object.entries(platforms)) {
    if (!API_ASSET_URL.test(entry.url)) {
      rewritten[platform] = entry;
      continue;
    }
    let filename;
    try {
      filename = filenameFromSignature(entry.signature);
    } catch (err) {
      throw new Error(`${platform}: ${err.message}`);
    }
    const url = `${base}/releases/download/${tag}/${filename}`;
    rewritten[platform] = { ...entry, url };
    changes.push({ platform, from: entry.url, to: url });
  }

  return { manifest: { ...manifest, platforms: rewritten }, changes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , manifestPath, tag, ...rest] = process.argv;
  const repoFlag = rest.indexOf("--repo-url");
  const repoUrl = repoFlag === -1 ? undefined : rest[repoFlag + 1];

  if (!manifestPath || !tag || !repoUrl) {
    console.error(
      "usage: node scripts/fix-updater-manifest.mjs <latest.json> <tag> --repo-url <url>",
    );
    process.exit(1);
  }

  const input = JSON.parse(readFileSync(manifestPath, "utf8"));
  const { manifest, changes } = rewriteManifestUrls(input, { repoUrl, tag });

  for (const change of changes) {
    console.log(`${change.platform.padEnd(24)} -> ${change.to}`);
  }
  if (changes.length === 0) {
    console.log("No API asset URLs found — manifest already points at the CDN.");
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\n${changes.length} URL(s) rewritten in ${manifestPath}`);
}
