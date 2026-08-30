import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { OperatorApp } from "./OperatorApp";
import i18n from "../../i18n/index";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Song, ServiceSet, PresentationState, SetItem } from "../../types";
import { usePresentationStore } from "../../stores/presentation";
import { useCountdownStore } from "../../stores/countdown";
import { useSettingsStore } from "../../stores/settings";
import type { OutputId } from "../../types";

// jsdom lacks ResizeObserver; SlideStage (rendered by the presentation layout)
// uses it internally.
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const mockSong = (id: string, title: string, artist?: string): Song => ({
  id,
  title,
  artist,
  language: "pt",
  scrimOpacity: 35,
  createdAt: 1000,
  updatedAt: 1000,
  sections: [{ id: "s1", songId: id, label: "E1", type: "verse", body: "corpo", sortOrder: 0, repeatCount: 1 }],
});

const defaultSet: ServiceSet = {
  id: "set-1",
  name: "Culto Dominical",
  createdAt: 0,
  updatedAt: 0,
  items: [],
};

const scheduledCountdownItem = (
  hour: number,
  minute: number,
): SetItem => ({
  id: "cd-item",
  setId: "set-1",
  itemType: "countdown",
  sortOrder: 0,
  countdownConfig: {
    target: { kind: "duration", durationMs: 600_000 },
    endBehavior: "holdZero",
    message: "Começando em breve",
    scheduledStart: { hour, minute },
  },
});

const setWithSchedule = (item: SetItem): ServiceSet => ({
  ...defaultSet,
  items: [item],
});

describe("OperatorApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listen).mockResolvedValue(() => {});
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "get_setting") return Promise.reject({ code: "settings.not_found", params: {} });
      if (cmd === "get_or_create_default_set") return Promise.resolve(defaultSet);
      if (cmd === "get_set") return Promise.resolve(defaultSet);
      if (cmd === "check_for_updates") return Promise.resolve({ status: "upToDate" });
      return Promise.resolve([]);
    });
    // Reset to pt-BR so locale-changing tests don't pollute subsequent tests
    i18n.changeLanguage("pt-BR");
  });

  it("renders the Biblioteca nav button", () => {
    render(<OperatorApp />);
    expect(screen.getByRole("button", { name: "Biblioteca" })).toBeInTheDocument();
  });

  it("shows both library CTAs when navigating to library with no songs", async () => {
    render(<OperatorApp />);
    fireEvent.click(screen.getByRole("button", { name: "Biblioteca" }));
    await waitFor(() => {
      expect(screen.getByTestId("cta-import-holyrics")).toBeInTheDocument();
      expect(screen.getByTestId("cta-create-song")).toBeInTheDocument();
    });
  });

  it("renders song rows in library when listSongs returns songs", async () => {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "get_setting") return Promise.reject({ code: "settings.not_found", params: {} });
      if (cmd === "get_or_create_default_set") return Promise.resolve(defaultSet);
      if (cmd === "get_set") return Promise.resolve(defaultSet);
      if (cmd === "check_for_updates") return Promise.resolve({ status: "upToDate" });
      if (cmd === "list_songs") return Promise.resolve([
        mockSong("1", "Graça Infinita", "Artista A"),
        mockSong("2", "Santo Espírito"),
      ]);
      return Promise.resolve([]);
    });
    render(<OperatorApp />);
    fireEvent.click(screen.getByRole("button", { name: "Biblioteca" }));
    await waitFor(() => {
      expect(screen.getByText("Graça Infinita")).toBeInTheDocument();
      expect(screen.getByText("Santo Espírito")).toBeInTheDocument();
    });
  });

  it("does not render a presentation window button in the toolbar", () => {
    render(<OperatorApp />);
    expect(screen.queryByText("Janela de Apresentação")).toBeNull();
  });

  it("subscribes to songs_changed on mount", async () => {
    render(<OperatorApp />);
    await waitFor(() =>
      expect(vi.mocked(listen)).toHaveBeenCalledWith(
        "songs_changed",
        expect.any(Function)
      )
    );
  });

  it("calls loadLocale at mount — invokes get_setting for app.locale", async () => {
    vi.mocked(invoke).mockImplementation((cmd, args) => {
      if (cmd === "get_setting") {
        const key = (args as { key: string })?.key;
        if (key === "app.locale") return Promise.resolve("en-US");
        return Promise.reject({ code: "settings.not_found", params: {} });
      }
      if (cmd === "get_or_create_default_set") return Promise.resolve(defaultSet);
      if (cmd === "get_set") return Promise.resolve(defaultSet);
      if (cmd === "check_for_updates") return Promise.resolve({ status: "upToDate" });
      return Promise.resolve([]);
    });
    render(<OperatorApp />);
    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_setting", { key: "app.locale" })
    );
    // The settings store locale should reflect the DB value after load
    const { useSettingsStore } = await import("../../stores/settings");
    await waitFor(() =>
      expect(useSettingsStore.getState().locale).toBe("en-US")
    );
  });

  it("nav buttons are disabled while presenting (mode=live) and enabled when idle", async () => {
    const liveState: PresentationState = {
      mode: "live",
      currentItemIndex: 0,
      currentSlideIndex: 0,
      itemSlideCounts: [],
    };

    // Start with idle state (state=null → isPresenting=false)
    act(() => { usePresentationStore.setState({ state: null }); });
    render(<OperatorApp />);

    const navLabels = [
      i18n.t("nav.home"),
      i18n.t("nav.library"),
      i18n.t("nav.media"),
      i18n.t("nav.backup"),
      i18n.t("nav.settings"),
    ];

    // All buttons must be enabled when idle
    for (const label of navLabels) {
      expect(screen.getByRole("button", { name: label })).not.toBeDisabled();
    }

    // Simulate presentation going live
    act(() => { usePresentationStore.setState({ state: liveState }); });

    await waitFor(() => {
      for (const label of navLabels) {
        expect(screen.getByRole("button", { name: label })).toBeDisabled();
      }
    });

    // Simulate presentation ending (back to idle)
    act(() => { usePresentationStore.setState({ state: null }); });

    await waitFor(() => {
      for (const label of navLabels) {
        expect(screen.getByRole("button", { name: label })).not.toBeDisabled();
      }
    });
  });

  describe("monitor setup load + invalidation", () => {
    it("calls list_monitors at boot to load the monitor setup", async () => {
      render(<OperatorApp />);
      await waitFor(() =>
        expect(vi.mocked(invoke)).toHaveBeenCalledWith("list_monitors"),
      );
    });

    it("routes a display.monitor_names setting_changed event into the store", async () => {
      let settingCb: ((key: string, value: string) => void) | null = null;
      vi.mocked(listen).mockImplementation((event: string, cb: any) => {
        if (event === "setting_changed") {
          settingCb = (key: string, value: string) => cb({ payload: { key, value } });
        }
        return Promise.resolve(() => {});
      });

      render(<OperatorApp />);
      await waitFor(() => expect(settingCb).not.toBeNull());

      await act(async () => {
        settingCb!("display.monitor_names", JSON.stringify({ "mon-1": "Projetor" }));
        await Promise.resolve();
      });

      const { useSettingsStore } = await import("../../stores/settings");
      await waitFor(() =>
        expect(useSettingsStore.getState().monitorNames).toEqual({ "mon-1": "Projetor" }),
      );
    });
  });

  describe("update check on launch", () => {
    it("shows the update banner when the launch check returns updateAvailable", async () => {
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === "get_setting") return Promise.reject({ code: "settings.not_found", params: {} });
        if (cmd === "get_or_create_default_set") return Promise.resolve(defaultSet);
        if (cmd === "get_set") return Promise.resolve(defaultSet);
        if (cmd === "check_for_updates") {
          return Promise.resolve({
            status: "updateAvailable",
            info: { version: "9.9.9", currentVersion: "1.0.0" },
          });
        }
        return Promise.resolve([]);
      });

      render(<OperatorApp />);

      await waitFor(() =>
        expect(
          screen.getByText(i18n.t("updates.bannerMessage", { version: "9.9.9" })),
        ).toBeInTheDocument(),
      );
    });

    it("renders no banner, dialog, toast, or error text when the launch check returns skipped", async () => {
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === "get_setting") return Promise.reject({ code: "settings.not_found", params: {} });
        if (cmd === "get_or_create_default_set") return Promise.resolve(defaultSet);
        if (cmd === "get_set") return Promise.resolve(defaultSet);
        if (cmd === "check_for_updates") return Promise.resolve({ status: "skipped" });
        return Promise.resolve([]);
      });

      render(<OperatorApp />);

      await waitFor(() =>
        expect(vi.mocked(invoke)).toHaveBeenCalledWith("check_for_updates", { force: false }),
      );
      await act(async () => { await Promise.resolve(); });

      expect(screen.queryByText(/Nova vers[aã]o dispon[ií]vel/)).toBeNull();
      expect(
        screen.queryByRole("button", { name: i18n.t("updates.updateButton") }),
      ).toBeNull();
    });

    it("renders no banner, dialog, toast, or error text when the launch check rejects", async () => {
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === "get_setting") return Promise.reject({ code: "settings.not_found", params: {} });
        if (cmd === "get_or_create_default_set") return Promise.resolve(defaultSet);
        if (cmd === "get_set") return Promise.resolve(defaultSet);
        if (cmd === "check_for_updates") {
          return Promise.reject({ code: "update.check_failed", params: {} });
        }
        return Promise.resolve([]);
      });

      render(<OperatorApp />);

      await waitFor(() =>
        expect(vi.mocked(invoke)).toHaveBeenCalledWith("check_for_updates", { force: false }),
      );
      await act(async () => { await Promise.resolve(); });

      expect(screen.queryByText(/Nova vers[aã]o dispon[ií]vel/)).toBeNull();
      expect(
        screen.queryByRole("button", { name: i18n.t("updates.updateButton") }),
      ).toBeNull();
    });
  });

  describe("silent re-arm at launch", () => {
    // These tests derive schedules from the current wall clock (now ± 2h). Pin
    // it to midday so the offsets never cross midnight and flip "later today" /
    // "earlier today". Only Date is faked, so waitFor and the async invoke
    // mocks keep running on real timers.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2024, 0, 15, 12, 0, 0, 0));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("arms a later-today scheduled countdown silently (no prompt)", async () => {
      // Pick a trigger time ~2h in the future so it's 'later today' and not
      // close to midnight rollover.
      const future = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const hour = future.getHours();
      const minute = future.getMinutes();
      const item = scheduledCountdownItem(hour, minute);
      const set = setWithSchedule(item);

      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === "get_setting") return Promise.reject({ code: "settings.not_found", params: {} });
        if (cmd === "get_or_create_default_set") return Promise.resolve(set);
        if (cmd === "get_set") return Promise.resolve(set);
        if (cmd === "check_for_updates") return Promise.resolve({ status: "upToDate" });
        if (cmd === "arm_countdown") {
          return Promise.resolve({
            mode: "scheduled",
            durationMs: 600_000,
            remainingMs: 600_000,
            endBehavior: "holdZero",
            takeover: false,
          });
        }
        return Promise.resolve([]);
      });

      const armSpy = vi.spyOn(useCountdownStore.getState(), "arm");

      render(<OperatorApp />);

      await waitFor(() => expect(armSpy).toHaveBeenCalledTimes(1));
      expect(armSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledStart: { hour, minute },
          durationMs: 600_000,
          setId: "set-1",
          itemIndex: 0,
        }),
      );
      // No launch-prompt component rendered.
      expect(screen.queryByTestId("countdown-launch-prompt")).toBeNull();

      armSpy.mockRestore();
    });

    it("does not arm when the schedule is in the past today", async () => {
      const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const item = scheduledCountdownItem(past.getHours(), past.getMinutes());
      const set = setWithSchedule(item);

      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === "get_setting") return Promise.reject({ code: "settings.not_found", params: {} });
        if (cmd === "get_or_create_default_set") return Promise.resolve(set);
        if (cmd === "get_set") return Promise.resolve(set);
        if (cmd === "check_for_updates") return Promise.resolve({ status: "upToDate" });
        return Promise.resolve([]);
      });

      const armSpy = vi.spyOn(useCountdownStore.getState(), "arm");
      render(<OperatorApp />);

      // Give async mount effects a chance to run.
      await waitFor(() =>
        expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_or_create_default_set"),
      );
      await act(async () => { await Promise.resolve(); });
      expect(armSpy).not.toHaveBeenCalled();

      armSpy.mockRestore();
    });

    it("does not arm when there is no scheduled countdown", async () => {
      // defaultSet (empty items) is used by the default beforeEach mock.
      const armSpy = vi.spyOn(useCountdownStore.getState(), "arm");
      render(<OperatorApp />);

      await waitFor(() =>
        expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_or_create_default_set"),
      );
      await act(async () => { await Promise.resolve(); });
      expect(armSpy).not.toHaveBeenCalled();

      armSpy.mockRestore();
    });
  });

  describe("countdown trigger handler", () => {
    it("when not presenting, enters presentation and jumps to the armed item", async () => {
      // Capture the countdown_triggered listener callback.
      let triggerCb: ((e: { payload: unknown }) => void) | null = null;
      vi.mocked(listen).mockImplementation((event: string, cb: any) => {
        if (event === "countdown_triggered") triggerCb = cb;
        return Promise.resolve(() => {});
      });

      const enterSpy = vi.fn().mockResolvedValue(undefined);
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === "get_setting") return Promise.reject({ code: "settings.not_found", params: {} });
        if (cmd === "get_or_create_default_set") return Promise.resolve(defaultSet);
        if (cmd === "get_set") return Promise.resolve(defaultSet);
        if (cmd === "check_for_updates") return Promise.resolve({ status: "upToDate" });
        if (cmd === "enter_presentation") { enterSpy(); return Promise.resolve(); }
        return Promise.resolve([]);
      });

      // Not presenting.
      act(() => { usePresentationStore.setState({ state: null }); });
      // Armed item carries the index to jump to.
      act(() => {
        useCountdownStore.setState({ armedItem: { setId: "set-1", itemIndex: 2 } });
      });

      const jumpSpy = vi
        .spyOn(usePresentationStore.getState(), "jumpToItem")
        .mockResolvedValue(undefined);

      render(<OperatorApp />);
      await waitFor(() => expect(triggerCb).not.toBeNull());

      await act(async () => {
        triggerCb!({ payload: { setId: "set-1", itemIndex: 2 } });
        await Promise.resolve();
      });

      await waitFor(() => expect(enterSpy).toHaveBeenCalled());
      await waitFor(() => expect(jumpSpy).toHaveBeenCalledWith(2));

      jumpSpy.mockRestore();
    });

    it("when already presenting, does not jump (hard takeover overlay covers all)", async () => {
      let triggerCb: ((e: { payload: unknown }) => void) | null = null;
      vi.mocked(listen).mockImplementation((event: string, cb: any) => {
        if (event === "countdown_triggered") triggerCb = cb;
        return Promise.resolve(() => {});
      });

      const liveState: PresentationState = {
        mode: "live",
        currentItemIndex: 0,
        currentSlideIndex: 0,
        itemSlideCounts: [],
      };
      act(() => { usePresentationStore.setState({ state: liveState }); });

      const jumpSpy = vi
        .spyOn(usePresentationStore.getState(), "jumpToItem")
        .mockResolvedValue(undefined);

      render(<OperatorApp />);
      await waitFor(() => expect(triggerCb).not.toBeNull());

      // Ensure the live state is in place at trigger time.
      act(() => { usePresentationStore.setState({ state: liveState }); });

      await act(async () => {
        triggerCb!({ payload: { setId: "set-1", itemIndex: 2 } });
        await Promise.resolve();
      });

      expect(jumpSpy).not.toHaveBeenCalled();
      jumpSpy.mockRestore();
    });
  });

  describe("stopping with multiple screens under individual control", () => {
    // P16-17..P16-25. Drives the real gate through both entry points: the Stop
    // button in the presentation layout and the Esc key.

    // A set with at least one item is required for the presentation layout to
    // render its action bar (and therefore the Stop button) at all.
    const presentingSet: ServiceSet = {
      ...defaultSet,
      items: [
        {
          id: "item-1",
          setId: "set-1",
          itemType: "blank",
          sortOrder: 0,
        } as SetItem,
      ],
    };

    const liveState: PresentationState = {
      mode: "live",
      currentItemIndex: 0,
      currentSlideIndex: 0,
      itemSlideCounts: [1],
      set: presentingSet,
    };

    /** Mount the app with both outputs presenting, then return a way to stop. */
    const mountPresenting = async (opts: {
      multiScreen: boolean;
      mirror: boolean;
      outputs: OutputId[];
    }) => {
      const lifecycleHandlers: ((e: any) => void)[] = [];
      vi.mocked(listen).mockImplementation((event: any, cb: any) => {
        if (event === "presentation_lifecycle") lifecycleHandlers.push(cb);
        return Promise.resolve(() => {});
      });

      render(<OperatorApp />);
      await waitFor(() => expect(lifecycleHandlers.length).toBeGreaterThan(0));

      // Seed AFTER mount: OperatorApp fetches presentation state on mount and
      // would otherwise overwrite the fixture with the mocked empty response.
      act(() => {
        useSettingsStore.setState({
          multiScreenEnabled: opts.multiScreen,
          mirrorEnabled: opts.mirror,
        });
        usePresentationStore.setState({
          state: liveState,
          focusedOutput: "one",
        });
      });

      // Announce each output as presenting, the way Rust does.
      await act(async () => {
        for (const output of opts.outputs) {
          for (const cb of lifecycleHandlers) {
            cb({ payload: { phase: "entered", output } });
          }
        }
        await Promise.resolve();
      });
    };

    const exitCalls = () =>
      vi.mocked(invoke).mock.calls.filter((c) => c[0] === "exit_presentation");

    it("opens the chooser instead of silently stopping the focused screen", async () => {
      await mountPresenting({ multiScreen: true, mirror: false, outputs: ["one", "two"] });

      fireEvent.click(screen.getByTestId("stop-button"));

      expect(screen.getByTestId("stop-presentation-modal")).toBeTruthy();
      expect(exitCalls()).toHaveLength(0);
    });

    it("Esc routes through the same gate as the Stop button (P16-24)", async () => {
      await mountPresenting({ multiScreen: true, mirror: false, outputs: ["one", "two"] });

      fireEvent.keyDown(window, { key: "Escape" });

      expect(screen.getByTestId("stop-presentation-modal")).toBeTruthy();
      expect(exitCalls()).toHaveLength(0);
    });

    it("choosing a screen stops only that output", async () => {
      await mountPresenting({ multiScreen: true, mirror: false, outputs: ["one", "two"] });
      fireEvent.click(screen.getByTestId("stop-button"));

      await act(async () => {
        fireEvent.click(screen.getByTestId("stop-output-two"));
        await Promise.resolve();
      });

      expect(exitCalls()).toHaveLength(1);
      expect(exitCalls()[0][1]).toEqual({ output: "two" });
      expect(screen.queryByTestId("stop-presentation-modal")).toBeNull();
    });

    it("stop-all stops every presenting output", async () => {
      await mountPresenting({ multiScreen: true, mirror: false, outputs: ["one", "two"] });
      fireEvent.click(screen.getByTestId("stop-button"));

      await act(async () => {
        fireEvent.click(screen.getByTestId("stop-all"));
        await Promise.resolve();
      });

      expect(exitCalls()).toHaveLength(2);
      expect(exitCalls().map((c) => (c[1] as any).output).sort()).toEqual(["one", "two"]);
    });

    it("cancelling stops nothing", async () => {
      await mountPresenting({ multiScreen: true, mirror: false, outputs: ["one", "two"] });
      fireEvent.click(screen.getByTestId("stop-button"));

      await act(async () => {
        fireEvent.click(screen.getByTestId("stop-cancel"));
        await Promise.resolve();
      });

      expect(exitCalls()).toHaveLength(0);
      expect(screen.queryByTestId("stop-presentation-modal")).toBeNull();
    });

    it("mirroring stops both screens with no prompt (P16-18)", async () => {
      await mountPresenting({ multiScreen: true, mirror: true, outputs: ["one", "two"] });

      await act(async () => {
        fireEvent.click(screen.getByTestId("stop-button"));
        await Promise.resolve();
      });

      expect(screen.queryByTestId("stop-presentation-modal")).toBeNull();
      expect(exitCalls().map((c) => (c[1] as any).output).sort()).toEqual(["one", "two"]);
    });

    it("a single presenting screen stops immediately (P16-18)", async () => {
      await mountPresenting({ multiScreen: true, mirror: false, outputs: ["one"] });

      await act(async () => {
        fireEvent.click(screen.getByTestId("stop-button"));
        await Promise.resolve();
      });

      expect(screen.queryByTestId("stop-presentation-modal")).toBeNull();
      expect(exitCalls()).toHaveLength(1);
      expect(exitCalls()[0][1]).toEqual({ output: "one" });
    });

    it("multi-screen off never prompts, even with two windows open (P16-18)", async () => {
      await mountPresenting({ multiScreen: false, mirror: false, outputs: ["one", "two"] });

      await act(async () => {
        fireEvent.click(screen.getByTestId("stop-button"));
        await Promise.resolve();
      });

      expect(screen.queryByTestId("stop-presentation-modal")).toBeNull();
      expect(exitCalls()).toHaveLength(1);
    });

    it("an active overlay is cleared first and never raises the chooser (P16-25)", async () => {
      await mountPresenting({ multiScreen: true, mirror: false, outputs: ["one", "two"] });
      act(() => {
        usePresentationStore.setState({
          state: { ...liveState, mode: "live", overlay: { kind: "announcement", text: "oi" } as any },
        });
      });

      await act(async () => {
        fireEvent.keyDown(window, { key: "Escape" });
        await Promise.resolve();
      });

      expect(screen.queryByTestId("stop-presentation-modal")).toBeNull();
      expect(exitCalls()).toHaveLength(0);
      expect(
        vi.mocked(invoke).mock.calls.filter((c) => c[0] === "clear_overlay").length,
      ).toBeGreaterThan(0);
    });
  });

  afterEach(() => {
    // Reset presentation store state after each test
    act(() => { usePresentationStore.setState({ state: null }); });
    act(() => { useCountdownStore.setState({ armedItem: null }); });
  });
});
