import { describe, expect, it } from "vitest";
import { RING_OUTER_R, shieldSvg } from "./shield";

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

/** Every url(#id) and href="#id" in the markup points at an id it defines. */
function danglingRefs(svg: string): string[] {
  const defined = new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const used = [
    ...[...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]),
    ...[...svg.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]),
  ];
  return used.filter((ref) => !defined.has(ref));
}

describe("shieldSvg", () => {
  it("is a decorative, uninscribed window on the full canvas by default", () => {
    const svg = shieldSvg();
    expect(svg).toContain('viewBox="0 0 1024 1024"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain("filter=");
    expect(svg).not.toContain('class="lz-tile"');
    // Ring, three arcs, three spokes, Deus and the three persons.
    expect(count(svg, 'class="lz-ring"')).toBe(1);
    expect(count(svg, 'class="lz-arc ')).toBe(3);
    expect(count(svg, 'class="lz-spoke ')).toBe(3);
    expect(count(svg, 'class="lz-node ')).toBe(4);
  });

  it("carries the Scutum Fidei inscriptions when asked", () => {
    const svg = shieldSvg({ labels: true });
    for (const word of ["PATER", "FILIUS", "SPIRITUS", "SANCTUS", "DEUS"]) {
      expect(count(svg, `>${word}<`)).toBe(1);
    }
    expect(count(svg, ">EST<")).toBe(3);
    expect(count(svg, ">NON · EST<")).toBe(3);
  });

  it("names itself as an image when given a title", () => {
    const svg = shieldSvg({ title: "Lyrizzy" });
    expect(svg).toContain('role="img" aria-label="Lyrizzy"');
    expect(svg).toContain("<title>Lyrizzy</title>");
    expect(svg).not.toContain("aria-hidden");
  });

  it("crops the viewBox to the ring plus the margin, centred", () => {
    const r = RING_OUTER_R + 10;
    expect(shieldSvg({ margin: 10 })).toContain(`viewBox="${512 - r} ${512 - r} ${2 * r} ${2 * r}"`);
  });

  it("prefixes every id and resolves every reference in every variant", () => {
    const svg = shieldSvg({ labels: true, glow: true, tile: true, idPrefix: "zz" });
    const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.startsWith("zz-"))).toBe(true);
    for (const options of [{}, { labels: true }, { glow: true, tile: true }, { labels: true, glow: true }]) {
      expect(danglingRefs(shieldSvg(options))).toEqual([]);
    }
  });
});
