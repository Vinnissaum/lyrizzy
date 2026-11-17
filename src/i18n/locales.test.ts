import { describe, it, expect } from "vitest";
import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

/** Recursively collect all dot-notation keys from a nested object. */
function flattenKeys(obj: Record<string, unknown>, prefix = ""): Set<string> {
  const keys = new Set<string>();
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      for (const sub of flattenKeys(v as Record<string, unknown>, full)) {
        keys.add(sub);
      }
    } else {
      keys.add(full);
    }
  }
  return keys;
}

describe("locale key parity", () => {
  it("en-US and pt-BR have identical key sets in both directions", () => {
    const enKeys = flattenKeys(enUS as unknown as Record<string, unknown>);
    const ptKeys = flattenKeys(ptBR as unknown as Record<string, unknown>);

    const missingFromPt = [...enKeys].filter((k) => !ptKeys.has(k));
    const missingFromEn = [...ptKeys].filter((k) => !enKeys.has(k));

    const problems: string[] = [];
    for (const k of missingFromPt) problems.push(`missing from pt-BR: ${k}`);
    for (const k of missingFromEn) problems.push(`missing from en-US: ${k}`);

    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("both locales define the about open-source and contribute keys with non-empty values", () => {
    const enObj = enUS as unknown as { about: Record<string, string> };
    const ptObj = ptBR as unknown as { about: Record<string, string> };
    for (const key of ["openSource", "contribute"] as const) {
      expect(enObj.about[key], `en-US about.${key}`).toBeTruthy();
      expect(ptObj.about[key], `pt-BR about.${key}`).toBeTruthy();
    }
  });

  it("both locales define the new Phase 13 update/about keys", () => {
    const required = [
      "updates.checking",
      "updates.checkErrorWithCode",
      "updates.downloading",
      "updates.downloadingUnknown",
      "updates.alreadyInProgress",
      "about.version",
    ];
    const enKeys = flattenKeys(enUS as unknown as Record<string, unknown>);
    const ptKeys = flattenKeys(ptBR as unknown as Record<string, unknown>);
    const missing = required.filter((k) => !enKeys.has(k) || !ptKeys.has(k));
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("row edit label in both locales", () => {
    type LiveSet = { presentation: { liveSet: Record<string, string> } };
    expect((ptBR as unknown as LiveSet).presentation.liveSet.edit).toBe("Editar música");
    expect((enUS as unknown as LiveSet).presentation.liveSet.edit).toBe("Edit song");
  });

  it("phase 23 labels in both locales", () => {
    const at = (tree: unknown, path: string): unknown =>
      path.split(".").reduce<unknown>((node, k) => (node as Record<string, unknown> | undefined)?.[k], tree);
    const expected: Record<string, [string, string]> = {
      "home.overlay.uploadImage": ["Enviar imagem do computador", "Upload image from computer"],
      "media.dropzone.uploading": ["Importando {{current}}/{{total}}…", "Importing {{current}}/{{total}}…"],
      "home.overlay.uploadFailed_one": ["{{count}} arquivo não foi importado", "{{count}} file was not imported"],
      "home.overlay.uploadFailed_other": ["{{count}} arquivos não foram importados", "{{count}} files were not imported"],
      "presentation.liveSet.reorder": ["Reordenar", "Reorder"],
      "presentation.liveSet.editCountdown": ["Editar cronômetro", "Edit countdown"],
      "presentation.liveVideo.label": ["Vídeo", "Video"],
      "presentation.liveVideo.pause": ["Pausar", "Pause"],
      "presentation.liveVideo.resume": ["Retomar", "Resume"],
      "presentation.liveVideo.restart": ["Reiniciar", "Restart"],
      "presentation.liveVideo.back10": ["−10 s", "−10 s"],
      "presentation.liveVideo.forward10": ["+10 s", "+10 s"],
      "presentation.liveVideo.mute": ["Silenciar", "Mute"],
      "presentation.liveVideo.unmute": ["Ativar som", "Unmute"],
      "presentation.liveVideo.position": ["Posição do vídeo", "Video position"],
      "presentation.liveVideo.failed": ["Não foi possível reproduzir o vídeo", "The video could not be played"],
      "countdown.schedule.unavailableWhileCounting": [
        "Indisponível enquanto um cronômetro está em andamento",
        "Unavailable while a countdown is running",
      ],
    };
    for (const [key, [pt, en]] of Object.entries(expected)) {
      expect(at(ptBR, key), `pt-BR ${key}`).toBe(pt);
      expect(at(enUS, key), `en-US ${key}`).toBe(en);
    }
    // The two refusals this phase can show have a message in both.
    for (const key of ["error.set.reorder_mismatch", "error.countdown.target_passed"]) {
      for (const [name, tree] of [["pt-BR", ptBR], ["en-US", enUS]] as const) {
        const message = at(tree, key);
        expect(typeof message === "string" && message.length > 0, `${name} ${key}`).toBe(true);
      }
    }
  });
});
