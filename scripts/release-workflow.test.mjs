import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowPath = path.resolve(__dirname, "../.github/workflows/release.yml");
const workflow = parse(readFileSync(workflowPath, "utf8"));

const onBlock = workflow.on;

const buildJob = workflow.jobs.build;
const verifyJob = workflow.jobs["verify-version"];
const tauriActionStep = buildJob.steps.find((s) => String(s.uses ?? "").startsWith("tauri-apps/tauri-action"));

describe("release workflow — trigger and secret exposure", () => {
  it("triggers on v* tags", () => {
    expect(onBlock.push.tags).toContain("v*");
  });

  it("never declares a pull_request trigger", () => {
    // This is the property that keeps the signing secret away from fork PRs (D-50).
    expect(onBlock).not.toHaveProperty("pull_request");
    expect(JSON.stringify(workflow)).not.toContain("pull_request");
  });

  it("grants only contents: write permission", () => {
    expect(workflow.permissions.contents).toBe("write");
  });

  it("declares a concurrency group keyed on the ref", () => {
    expect(workflow.concurrency).toBeDefined();
    expect(workflow.concurrency.group).toContain("github.ref");
  });
});

describe("release workflow — job structure", () => {
  it("gates the build job behind verify-version", () => {
    expect(buildJob.needs).toBe("verify-version");
  });

  it("verify-version runs scripts/check-version.mjs against the pushed tag", () => {
    const runStep = verifyJob.steps.find((s) => typeof s.run === "string");
    expect(runStep.run).toContain("scripts/check-version.mjs");
    expect(runStep.run).toContain("github.ref_name");
  });

  it("builds an exact two-platform matrix: windows-latest and ubuntu-24.04", () => {
    expect(buildJob.strategy.matrix.platform).toEqual(["windows-latest", "ubuntu-24.04"]);
  });

  it("never targets the deprecating ubuntu-22.04 runner", () => {
    expect(JSON.stringify(workflow)).not.toContain("ubuntu-22.04");
  });

  it("does not fail fast and serializes uploads with max-parallel 1", () => {
    expect(buildJob.strategy["fail-fast"]).toBe(false);
    expect(buildJob.strategy["max-parallel"]).toBe(1);
  });
});

describe("release workflow — tauri-action inputs", () => {
  it("pins the action to tauri-apps/tauri-action@v1", () => {
    expect(tauriActionStep).toBeDefined();
    expect(tauriActionStep.uses).toBe("tauri-apps/tauri-action@v1");
  });

  it("publishes as a draft, non-prerelease, with updater artifacts uploaded", () => {
    expect(tauriActionStep.with.releaseDraft).toBe(true);
    expect(tauriActionStep.with.prerelease).toBe(false);
    expect(tauriActionStep.with.uploadUpdaterJson).toBe(true);
  });

  it("prefers the NSIS bundle for the updater JSON over MSI", () => {
    expect(tauriActionStep.with.updaterJsonPreferNsis).toBe(true);
  });

  it("tags the release using the pushed ref name", () => {
    expect(tauriActionStep.with.tagName).toContain("github.ref_name");
  });

  it("references both signing secrets in the action's env", () => {
    expect(tauriActionStep.env.TAURI_SIGNING_PRIVATE_KEY).toContain("secrets.TAURI_SIGNING_PRIVATE_KEY");
    expect(tauriActionStep.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD).toContain(
      "secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
    );
  });
});
