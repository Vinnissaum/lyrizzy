import { describe, it, expect } from "vitest";
import { foldForSearch, matchesSongSearch } from "./songSearch";

// P23 S7: song search ignores accents, ç and case (Brazilian Portuguese titles).

const song = (title: string, artist?: string) => ({ title, artist });
const LIBRARY = [
  song("Só pra te Adorar", "Diante do Trono"),
  song("Manancial de Toda Benção", "Ministério Ipiranga"),
  song("Coração Igual ao Teu", "Diante do Trono"),
  song("Ao Único", "Aline Barros"),
  song("Sonda-me", "João Alexandre"),
];
const found = (query: string) => LIBRARY.filter((s) => matchesSongSearch(s, query)).map((s) => s.title);

describe("song search (P23 S7)", () => {
  it("ignores accents, ç and case on both sides", () => {
    expect(found("so pra")).toEqual(["Só pra te Adorar"]);
    expect(found("So pra")).toEqual(["Só pra te Adorar"]);
    expect(found("bencao")).toEqual(["Manancial de Toda Benção"]);
    expect(found("BENÇÃO")).toEqual(["Manancial de Toda Benção"]);
    expect(found("coracao")).toEqual(["Coração Igual ao Teu"]);
    expect(found("unico")).toEqual(["Ao Único"]);
    // The artist is searched too.
    expect(found("joao")).toEqual(["Sonda-me"]);
    // Typed with the accent, as today.
    expect(found("só pra")).toEqual(["Só pra te Adorar"]);
    // Anywhere in the title, not only at a word's start.
    expect(found("cao")).toEqual(["Manancial de Toda Benção", "Coração Igual ao Teu"]);
    expect(found("adorar")).toEqual(["Só pra te Adorar"]);
    expect(found("xyz")).toEqual([]);
    // Empty, or only spaces: every song.
    expect(found("")).toHaveLength(5);
    expect(found("   ")).toHaveLength(5);
    // A song with no artist is still searched by title.
    expect(matchesSongSearch(song("Benção"), "bencao")).toBe(true);
    expect(matchesSongSearch(song("Benção"), "trono")).toBe(false);
  });

  it("folds every Portuguese accented letter", () => {
    const pairs: Array<[string, string]> = [
      ["á", "a"], ["à", "a"], ["â", "a"], ["ã", "a"], ["é", "e"], ["ê", "e"], ["í", "i"],
      ["ó", "o"], ["ô", "o"], ["õ", "o"], ["ú", "u"], ["ü", "u"], ["ç", "c"],
    ];
    for (const [accented, plain] of pairs) {
      expect(foldForSearch(accented), accented).toBe(plain);
      expect(foldForSearch(accented.toUpperCase()), accented.toUpperCase()).toBe(plain);
    }
    expect(foldForSearch("Manancial de Toda Benção")).toBe("manancial de toda bencao");
    // Other characters are kept, lower-cased.
    expect(foldForSearch("Sonda-me (Ao Vivo) 2X")).toBe("sonda-me (ao vivo) 2x");
  });
});
