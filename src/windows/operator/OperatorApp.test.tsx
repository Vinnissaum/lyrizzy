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

  afterEach(() => {
    // Reset presentation store state after each test
    act(() => { usePresentationStore.setState({ state: null }); });
    act(() => { useCountdownStore.setState({ armedItem: null }); });
  });
});
