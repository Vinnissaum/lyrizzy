import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { OperatorPresentationLayout } from "./OperatorPresentationLayout";
import { usePresentationStore } from "../../stores/presentation";
import { useLibraryStore } from "../../stores/library";
import { useCountdownStore } from "../../stores/countdown";
import type { PresentationState, ServiceSet, SetItem } from "../../types";

// P23 S5: a countdown row's edit control, end to end through the real set
// list, the real countdown dialog and the real stores. Only the backend
// (invoke, listen) and the panes this slice does not touch are stubbed. The
// stubbed backend answers `update_set_item` as the real one does: it patches
// the item into the loaded set and emits `state_changed`.

const listeners = new Map<string, Array<(e: { payload: unknown }) => void>>();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, cb: (e: { payload: unknown }) => void) => {
    listeners.set(event, [...(listeners.get(event) ?? []), cb]);
    return Promise.resolve(() => {});
  }),
  emit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));
vi.mock("./StrophesGrid", () => ({
  StrophesGrid: () => <div data-testid="strophes-grid-stub" />,
}));
vi.mock("./LivePreview", () => ({
  LivePreview: () => <div data-testid="live-preview-stub" />,
}));
vi.mock("./OutputSwitcher", () => ({
  OutputSwitcher: () => null,
}));
vi.mock("./MicSwitch", () => ({
  MicSwitch: () => null,
}));
vi.mock("./StreamProfileSwitcher", () => ({
  StreamProfileSwitcher: () => null,
}));

import { invoke } from "@tauri-apps/api/core";

const items: SetItem[] = [
  { id: "item-song", setId: "set-1", itemType: "song", songId: "song-1", sortOrder: 0 },
  {
    id: "item-cd",
    setId: "set-1",
    itemType: "countdown",
    sortOrder: 1,
    countdownConfig: {
      target: { kind: "duration", durationMs: 600_000 },
      name: "Regressivo",
      message: "Começamos em",
      endBehavior: "holdZero",
      position: "center",
      messageScale: 100,
      digitsScale: 100,
    },
  },
];

const set: ServiceSet = { id: "set-1", name: "Culto", createdAt: 0, updatedAt: 0, items };

/** Live on the song, strophe 2. */
let state: PresentationState;
let refuse: { code: string; params: Record<string, string> } | null;

function emit(event: string, payload: unknown) {
  for (const cb of listeners.get(event) ?? []) cb({ payload });
}

function backend() {
  vi.mocked(invoke).mockImplementation((cmd: string, args?: any) => {
    switch (cmd) {
      case "list_songs":
        return Promise.resolve([
          { id: "song-1", title: "AJUNTAMENTO", artist: "", language: "pt", scrimOpacity: 35, createdAt: 0, updatedAt: 0 },
        ]);
      case "get_presentation_state":
        return Promise.resolve(args?.output === "two" ? { ...state, set: null, mode: "idle" } : state);
      case "update_set_item": {
        if (refuse) return Promise.reject(refuse);
        const p = args.payload;
        const next = state.set!.items!.map((i) =>
          i.id === p.id ? { ...i, countdownConfig: p.countdownConfig } : i,
        );
        state = { ...state, set: { ...state.set!, items: next } };
        emit("state_changed", { output: "one", state });
        return Promise.resolve(next.find((i) => i.id === p.id));
      }
      default:
        return Promise.resolve([]);
    }
  });
}

const called = (cmd: string) => vi.mocked(invoke).mock.calls.some(([c]) => c === cmd);
const callsOf = (cmd: string) => vi.mocked(invoke).mock.calls.filter(([c]) => c === cmd);
const setPane = () => screen.getByText("Conjunto").closest("div")!.parentElement as HTMLElement;
const dialog = () => screen.getByTestId("countdown-schedule-modal");

async function present() {
  render(<OperatorPresentationLayout />);
  // The operator window's own subscription, as OperatorApp mounts it.
  await act(async () => {
    await usePresentationStore.getState().subscribe("one");
  });
  await waitFor(() => expect(within(setPane()).getByText("AJUNTAMENTO")).toBeInTheDocument());
}

function openRowEditor(name = "Regressivo") {
  fireEvent.click(screen.getByRole("button", { name: `Editar cronômetro ${name}` }));
  return dialog();
}

describe("Live countdown row edit (P23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listeners.clear();
    refuse = null;
    state = { mode: "live", currentItemIndex: 0, currentSlideIndex: 2, itemSlideCounts: [4, 1], set };
    backend();
    useLibraryStore.setState({ songs: [], allSongs: null, search: "", activeSetId: "set-1" });
    usePresentationStore.setState({ state, focusedOutput: "one", output: "one", pendingSelection: null });
    useCountdownStore.setState({
      state: { mode: "idle", durationMs: 0, remainingMs: 0, endBehavior: "holdZero", messageScale: 100, digitsScale: 100 },
      armedItem: null,
    });
  });

  it("row edit opens that countdown without moving the wall", async () => {
    await present();
    const before = vi.mocked(invoke).mock.calls.length;

    const d = openRowEditor();

    expect(d).toHaveTextContent("Configurar cronômetro");
    expect(within(d).getByLabelText("Nome")).toHaveValue("Regressivo");
    expect(within(d).getByDisplayValue("10:00")).toBeInTheDocument();
    expect(within(d).getByDisplayValue("Começamos em")).toBeInTheDocument();
    // Opening sends nothing that moves the wall or the countdown.
    const sent = vi.mocked(invoke).mock.calls.slice(before).map(([c]) => c);
    for (const cmd of ["go_to_item", "start_countdown", "arm_countdown", "reset_countdown", "update_set_item"]) {
      expect(sent).not.toContain(cmd);
    }
    expect(setPane().querySelector('[aria-current="true"]')).toHaveTextContent("AJUNTAMENTO");
    expect(screen.getByText(/^Estrofes — /)).toHaveTextContent("Estrofes — AJUNTAMENTO");
  });

  it("row edit saves the countdown and closes", async () => {
    await present();
    const d = openRowEditor();

    fireEvent.change(within(d).getByDisplayValue("10:00"), { target: { value: "07:30" } });
    fireEvent.change(within(d).getByDisplayValue("Começamos em"), { target: { value: "Já vamos começar" } });
    fireEvent.click(within(d).getByText("Salvar"));

    await waitFor(() => expect(screen.queryByTestId("countdown-schedule-modal")).not.toBeInTheDocument());
    expect(callsOf("update_set_item")).toHaveLength(1);
    const payload = (callsOf("update_set_item")[0][1] as any).payload;
    expect(payload.id).toBe("item-cd");
    expect(payload.countdownConfig).toMatchObject({
      target: { kind: "duration", durationMs: 450_000 },
      name: "Regressivo",
      message: "Já vamos começar",
      endBehavior: "holdZero",
      position: "center",
    });
    // The backend carries the edit to the wall; the dialog arms and resets nothing.
    expect(called("arm_countdown")).toBe(false);
    expect(called("reset_countdown")).toBe(false);
    expect(called("go_to_item")).toBe(false);
  });

  it("a refused save keeps the dialog open with the error", async () => {
    refuse = { code: "countdown.target_passed", params: {} };
    await present();
    const d = openRowEditor();

    fireEvent.change(within(d).getByDisplayValue("Começamos em"), { target: { value: "novo texto" } });
    fireEvent.click(within(d).getByText("Salvar"));

    await waitFor(() =>
      expect(within(dialog()).getByRole("alert")).toHaveTextContent("O horário deste cronômetro já passou"),
    );
    expect(callsOf("update_set_item")).toHaveLength(1);
    // Still open, with what the operator typed.
    expect(within(dialog()).getByDisplayValue("novo texto")).toBeInTheDocument();
    expect(within(setPane()).getByText("Regressivo")).toBeInTheDocument();
  });

  it("a renamed countdown relabels its row", async () => {
    await present();
    const d = openRowEditor();

    fireEvent.change(within(d).getByLabelText("Nome"), { target: { value: "Abertura" } });
    fireEvent.click(within(d).getByText("Salvar"));

    await waitFor(() => expect(within(setPane()).getByText("Abertura")).toBeInTheDocument());
    expect(within(setPane()).queryByText("Regressivo")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar cronômetro Abertura" })).toBeInTheDocument();
    expect(screen.queryByTestId("countdown-schedule-modal")).not.toBeInTheDocument();
  });

  it("reopening after a save shows what was saved", async () => {
    await present();
    let d = openRowEditor();
    fireEvent.change(within(d).getByDisplayValue("10:00"), { target: { value: "07:30" } });
    fireEvent.click(within(d).getByText("Salvar"));
    await waitFor(() => expect(screen.queryByTestId("countdown-schedule-modal")).not.toBeInTheDocument());

    d = openRowEditor();

    expect(within(d).getByDisplayValue("07:30")).toBeInTheDocument();
    expect(within(d).getByDisplayValue("Começamos em")).toBeInTheDocument();
  });

  it("Cancelar writes nothing", async () => {
    await present();
    const d = openRowEditor();
    fireEvent.change(within(d).getByDisplayValue("Começamos em"), { target: { value: "descartado" } });

    fireEvent.click(within(d).getByText("Cancelar"));

    expect(screen.queryByTestId("countdown-schedule-modal")).not.toBeInTheDocument();
    expect(called("update_set_item")).toBe(false);
    expect(called("reset_countdown")).toBe(false);
    expect(called("go_to_item")).toBe(false);
    expect(within(setPane()).getByText("Regressivo")).toBeInTheDocument();
  });

  it("Parar closes the countdown dialog", async () => {
    await present();
    openRowEditor();

    fireEvent.click(screen.getByTestId("stop-button"));

    expect(screen.queryByTestId("countdown-schedule-modal")).not.toBeInTheDocument();
    expect(called("update_set_item")).toBe(false);
  });
});
