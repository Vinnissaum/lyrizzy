import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowPath = path.resolve(__dirname, "../.github/workflows/publish-manifest.yml");
const workflow = parse(readFileSync(workflowPath, "utf8"));

const job = workflow.jobs["rewrite-updater-urls"];
const rewriteStep = job.steps.find((s) => String(s.name ?? "").startsWith("Rewrite latest.json"));
const verifyStep = job.steps.find((s) => String(s.name ?? "").startsWith("Verify every installer"));

describe("publish-manifest workflow — trigger and permissions", () => {
  it("runs when a release is published, not on tag push", () => {
    expect(workflow.on.release.types).toEqual(["published"]);
    expect(workflow.on).not.toHaveProperty("push");
  });

  it("never declares a pull_request trigger", () => {
    expect(workflow.on).not.toHaveProperty("pull_request");
    expect(JSON.stringify(workflow)).not.toContain("pull_request");
  });

  it("grants only contents: write permission", () => {
    expect(workflow.permissions.contents).toBe("write");
  });

  it("never references the signing secrets — it only rewrites URLs", () => {
    expect(JSON.stringify(workflow)).not.toContain("TAURI_SIGNING_PRIVATE_KEY");
  });

  it("serializes concurrent runs per release tag", () => {
    expect(workflow.concurrency.group).toContain("github.event.release.tag_name");
  });
});

describe("publish-manifest workflow — rewrite step", () => {
  it("invokes the rewriter with the published tag and repo URL", () => {
    expect(rewriteStep.run).toContain("scripts/fix-updater-manifest.mjs");
    expect(rewriteStep.env.TAG).toContain("github.event.release.tag_name");
    expect(rewriteStep.env.REPO_URL).toContain("github.repository");
  });

  it("re-uploads the manifest over the existing asset", () => {
    expect(rewriteStep.run).toContain("gh release upload");
    expect(rewriteStep.run).toContain("--clobber");
  });

  it("fails the run if any api.github.com URL survives the rewrite", () => {
    expect(rewriteStep.run).toContain("api\\.github\\.com");
    expect(rewriteStep.run).toContain("::error::");
  });

  it("exits cleanly when the release carries no latest.json", () => {
    expect(rewriteStep.run).toContain("nothing to rewrite");
  });

  it("uses strict bash so a failed gh call aborts the step", () => {
    expect(rewriteStep.run).toContain("set -euo pipefail");
  });
});

describe("publish-manifest workflow — verification step", () => {
  it("checks the published manifest rather than the local copy", () => {
    expect(verifyStep.run).toContain("gh release download");
    expect(verifyStep.run).toContain("published.json");
  });

  it("requires every installer URL to answer HTTP 200", () => {
    expect(verifyStep.run).toContain("200");
    expect(verifyStep.run).toContain("::error::");
  });
});
