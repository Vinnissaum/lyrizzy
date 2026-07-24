import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowPath = path.resolve(__dirname, "../.github/workflows/ci.yml");
const raw = readFileSync(workflowPath, "utf8");
const workflow = parse(raw);

const onBlock = workflow.on;
const job = workflow.jobs["test-and-compile"];
const steps = job.steps;

const usesStep = (prefix) => steps.find((s) => String(s.uses ?? "").startsWith(prefix));
const runSteps = steps.filter((s) => typeof s.run === "string");
const firstRunIndex = (needle) => runSteps.findIndex((s) => s.run.includes(needle));

describe("ci workflow — triggers (CI-01)", () => {
  it("runs on push with no branch restriction (all branches)", () => {
    expect(Object.prototype.hasOwnProperty.call(onBlock, "push")).toBe(true);
    // `push:` with an empty value = all branches; a branch filter would be an object with `branches`.
    expect(onBlock.push == null || onBlock.push.branches == null).toBe(true);
  });

  it("runs on pull_request", () => {
    expect(Object.prototype.hasOwnProperty.call(onBlock, "pull_request")).toBe(true);
  });

  it("is not restricted to tag pushes like release.yml", () => {
    expect(onBlock.push == null || onBlock.push.tags == null).toBe(true);
  });
});

describe("ci workflow — pinned toolchains, never latest (CI-02)", () => {
  it("pins Node to 24.18.0", () => {
    const node = usesStep("actions/setup-node");
    expect(node).toBeDefined();
    expect(node.with["node-version"]).toBe("24.18.0");
  });

  it("pins the Rust toolchain to 1.96.0", () => {
    const rust = usesStep("dtolnay/rust-toolchain");
    expect(rust).toBeDefined();
    expect(rust.uses).toBe("dtolnay/rust-toolchain@1.96.0");
  });

  it("pins runs-on to ubuntu-24.04", () => {
    expect(job["runs-on"]).toBe("ubuntu-24.04");
  });

  it("never uses a floating 'latest' runner", () => {
    expect(raw).not.toContain("-latest");
  });

  it("never uses the floating Node lts/* alias", () => {
    expect(raw).not.toContain("lts/*");
  });

  it("never uses a floating @stable Rust toolchain", () => {
    expect(raw).not.toContain("rust-toolchain@stable");
  });
});

describe("ci workflow — frontend test + compile (CI-03)", () => {
  it("runs the vitest suite", () => {
    expect(runSteps.some((s) => s.run.includes("vitest"))).toBe(true);
  });

  it("compiles the frontend with npm run build", () => {
    expect(runSteps.some((s) => s.run.includes("npm run build"))).toBe(true);
  });
});

describe("ci workflow — rust test + compile (CI-04)", () => {
  it("runs cargo test", () => {
    expect(runSteps.some((s) => s.run.includes("cargo test"))).toBe(true);
  });

  it("compiles the crate with cargo build", () => {
    expect(runSteps.some((s) => s.run.includes("cargo build"))).toBe(true);
  });

  it("runs npm run build before any cargo step (dist must exist for tauri-build)", () => {
    const buildIdx = firstRunIndex("npm run build");
    const cargoIdx = firstRunIndex("cargo ");
    expect(buildIdx).toBeGreaterThanOrEqual(0);
    expect(cargoIdx).toBeGreaterThanOrEqual(0);
    expect(buildIdx).toBeLessThan(cargoIdx);
  });
});

describe("ci workflow — compile only, no bundling (CI-05)", () => {
  it("never invokes tauri build", () => {
    expect(raw).not.toContain("tauri build");
  });

  it("never invokes the tauri-action bundler", () => {
    expect(raw).not.toContain("tauri-action");
  });
});
