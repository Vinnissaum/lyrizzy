/**
 * Song search that ignores accents, ç and letter case (P23 S7). The library is
 * in Brazilian Portuguese: typing "so pra" must find "Só pra te Adorar", and
 * "bencao" must find "Manancial de Toda Benção".
 */

/** Lower case, with every diacritic removed ("Benção" → "bencao"). */
export function foldForSearch(text: string): string {
  // NFD splits "ç" into "c" + a combining cedilla, "ã" into "a" + a combining
  // tilde, and so on; the combining marks are then dropped.
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Whether a song matches what was typed: anywhere in its title or its artist,
 * ignoring accents, ç and case on both sides. An empty search matches every
 * song.
 */
export function matchesSongSearch(
  song: { title: string; artist?: string | null },
  query: string,
): boolean {
  const q = foldForSearch(query.trim());
  if (!q) return true;
  return foldForSearch(song.title).includes(q) || foldForSearch(song.artist ?? "").includes(q);
}
