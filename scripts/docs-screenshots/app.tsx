// Screenshot harness for the user guide (docs/). Mounts the real Lyrizzy UI
// (src/main.tsx) against a mocked backend holding the sample library from
// data.ts. Driven by capture.mjs; each scene picks its starting state here:
//
//   ?window=operator|presentation   which window to render
//   &present=<set item id>&slide=N   start presenting at that item and slide
//   &multi=1                         second screen (Tela 2) enabled
//   &scheduled=1                     countdown armed for later today
//   &countdown=running               countdown counting on the wall
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import {
  buildSets,
  ccliRows,
  holyricsFile,
  importPlan,
  keyBindings,
  media,
  monitorNames,
  monitors,
  slidesForItem,
  songById,
  songs,
} from "./data";

const q = new URLSearchParams(location.search);
const role = q.get("window") === "presentation" ? "presentation" : "operator";
const presentAt = q.get("present");
const multi = q.get("multi") === "1";
const scheduled = q.get("scheduled") === "1";
const countdownRunning = q.get("countdown") === "running";

// Segoe UI, the app's font on Windows, is missing on Linux, and the fallback
// (DejaVu Sans) is much wider. Ubuntu Sans has close metrics.
const family = `"Segoe UI", "Ubuntu Sans", Arial, sans-serif`;
const style = document.createElement("style");
style.textContent = `:root { --font-sans: ${family}; --default-font-family: ${family}; }`;
document.head.appendChild(style);

const sets = buildSets({ scheduled });
const activeSet = sets[0];

const settings: Record<string, string> = {
  "app.locale": "pt-BR",
  "ui.theme": "dark",
  "presentation.font_size": "lg",
  "presentation.font_family": "sans",
  "presentation.preset": "preto-branco",
  "presentation.position": "center",
  "presentation.margin": "md",
  "presentation.line_spacing": "normal",
  "presentation.bold_level": "semibold",
  "presentation.show_title_slide": "true",
  "presentation.author_in_parens": "true",
  "presentation.blackout_after_song": "true",
  "presentation.repeat_mode": "duplicate",
  "announcement.font_family": "sans",
  "announcement.font_size": "lg",
  "announcement.preset": "preto-branco",
  "announcement.position": "center",
  "announcement.margin": "md",
  "announcement.line_spacing": "normal",
  "announcement.bold_level": "semibold",
  "output.multi_screen_enabled": String(multi),
  "output.mirror_enabled": "false",
  "output.launch_policy": "ask",
  "display.monitor_names": JSON.stringify(monitorNames),
  "camera.jitter_buffer_ms": "0",
  "ui.active_set_id": activeSet.id,
};

const assetUrl = (file: string) => `http://asset.localhost/media/${file}`;

function liveState(itemId: string, slide: number) {
  const all = activeSet.items.map(slidesForItem);
  const i = Math.max(0, activeSet.items.findIndex((x) => x.id === itemId));
  const item = activeSet.items[i] as { itemType: string; songId?: string };
  const song = item.itemType === "song" ? songById(item.songId) : undefined;
  const bg = song && "backgroundId" in song ? media.find((m) => m.id === song.backgroundId) : undefined;
  return {
    mode: "live",
    set: activeSet,
    currentItemIndex: i,
    currentSlideIndex: slide,
    itemSlideCounts: all.map((s) => s.length),
    allSlidesPerItem: all,
    currentSlide: all[i][slide],
    nextSlide: all[i][slide + 1] ?? all[i + 1]?.[0] ?? null,
    background: bg
      ? { mediaKind: "image", assetUrl: assetUrl(bg.fileName), scrimOpacity: song!.scrimOpacity, restartOnSectionBoundary: false }
      : undefined,
  };
}

const idle = { mode: "idle", currentItemIndex: 0, currentSlideIndex: 0, set: null, itemSlideCounts: [] };
let state: unknown = presentAt ? liveState(presentAt, Number(q.get("slide") ?? 0)) : idle;

function countdownState() {
  const base = {
    durationMs: 300_000,
    message: "O culto começa em…",
    endBehavior: "advanceSet",
    position: "center",
    messageScale: 100,
    digitsScale: 100,
    takeover: false,
  };
  if (countdownRunning) {
    const remainingMs = 4 * 60_000 + 32_000;
    return { ...base, mode: "running", remainingMs, targetEpochMs: Date.now() + remainingMs, sourceItemId: "i-cd" };
  }
  const start = (activeSet.items[0] as { countdownConfig?: { scheduledStart?: { hour: number; minute: number } } })
    .countdownConfig?.scheduledStart;
  if (scheduled && start) {
    const at = new Date();
    at.setHours(start.hour, start.minute, 0, 0);
    return { ...base, mode: "scheduled", scheduledStartEpochMs: at.getTime(), remainingMs: at.getTime() - Date.now() };
  }
  return { ...base, mode: "idle", remainingMs: 300_000 };
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const unhandled = new Set<string>();
(window as unknown as { __unhandled: Set<string> }).__unhandled = unhandled;

mockWindows(role);
mockIPC(
  (cmd, args: any) => {
    switch (cmd) {
      case "get_setting":
        return settings[args?.key] ?? null;
      case "set_setting":
        settings[args?.key] = args?.value;
        return null;
      case "get_presentation_state":
        return args?.output === "two" ? idle : state;
      case "list_songs": {
        const search = fold(String(args?.params?.search ?? "").trim());
        return search
          ? songs.filter((s) => fold(`${s.title} ${s.artist} ${s.sections.map((x) => x.body).join(" ")}`).includes(search))
          : songs;
      }
      case "get_song":
        return songById(args?.id) ?? null;
      case "list_sets":
        return sets;
      case "get_set":
        return sets.find((s) => s.id === args?.id) ?? activeSet;
      case "get_or_create_default_set":
        return activeSet;
      case "list_media": {
        const kind = args?.params?.kind;
        const search = fold(String(args?.params?.search ?? ""));
        return media.filter((m) => (!kind || m.kind === kind) && fold(m.displayName).includes(search));
      }
      case "get_media_references":
        return { songs: [], setItems: [], sections: [] };
      case "get_countdown_state":
      case "start_countdown":
      case "arm_countdown":
        return countdownState();
      case "list_monitors":
        return multi ? monitors : monitors.slice(0, 2);
      case "get_key_bindings":
        return keyBindings;
      case "get_app_version":
        return "1.10.0";
      case "check_for_updates":
        return { status: "upToDate" };
      case "check_restore_in_progress":
        return false;
      case "check_ffprobe":
      case "check_libreoffice":
      case "check_mediamtx":
        return true;
      case "get_set_play_count":
        return 0;
      case "preview_ccli_export":
        return ccliRows;
      case "parse_holyrics_file":
        return holyricsFile;
      case "plan_artifact_import":
        return importPlan;
      case "plugin:dialog|open": {
        const extensions: string[] = args?.options?.filters?.[0]?.extensions ?? [];
        return extensions.includes("json")
          ? "C:\\Users\\Louvor\\Downloads\\musicas-holyrics.json"
          : "C:\\Users\\Louvor\\Downloads\\culto-de-jovens.tlz";
      }
      case "go_to_item":
        state = liveState(activeSet.items[args?.itemIndex]?.id ?? "", args?.slideIndex ?? 0);
        return state;
      case "set_presentation_mode":
        state = { ...(state as object), mode: args?.mode };
        return state;
      default:
        unhandled.add(cmd);
        return cmd.startsWith("list_") ? [] : null;
    }
  },
  { shouldMockEvents: true },
);

await import("../../src/main.tsx");
