import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OperatorApp } from "./OperatorApp";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { CountdownState, ServiceSet } from "../../types";

const defaultCountdownState: CountdownState = {
  mode: "idle",
  durationMs: 0,
  remainingMs: 0,
  endBehavior: "holdZero",
};

const defaultSet: ServiceSet = {
  id: "set-1",
  name: "Culto Dominical",
  createdAt: 0,
  updatedAt: 0,
  items: [],
};

function setupInvokeMock() {
  vi.mocked(invoke).mockImplementation((cmd) => {
    if (cmd === "get_countdown_state") return Promise.resolve(defaultCountdownState);
    if (cmd === "check_restore_in_progress") return Promise.resolve(false);
    if (cmd === "list_monitors") return Promise.resolve([]);
    if (cmd === "check_ffprobe") return Promise.resolve(true);
    if (cmd === "check_for_updates") return Promise.resolve(null);
    if (cmd === "get_setting") return Promise.reject({ code: "settings.not_found", params: {} });
    if (cmd === "get_or_create_default_set") return Promise.resolve(defaultSet);
    if (cmd === "get_set") return Promise.resolve(defaultSet);
    return Promise.resolve([]);
  });
}

describe("OperatorApp — smoke navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listen).mockResolvedValue(() => {});
    setupInvokeMock();
  });

  it("renders nav tabs with Início instead of Conjuntos", () => {
    render(<OperatorApp />);
    expect(screen.getByRole("button", { name: "Início" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Biblioteca" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cronômetro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mídia" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Backup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configurações" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Janela de Apresentação" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Janela de Stage" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Conjuntos" })).toBeNull();
  });

  it("shows the home set builder by default", async () => {
    render(<OperatorApp />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Apresentar" })).toBeInTheDocument()
    );
  });

  it("navigates to the library section", async () => {
    render(<OperatorApp />);
    fireEvent.click(screen.getByRole("button", { name: "Biblioteca" }));
    await waitFor(() =>
      expect(screen.getByTestId("cta-import-holyrics")).toBeInTheDocument()
    );
    expect(screen.getByTestId("cta-create-song")).toBeInTheDocument();
  });

  it("home nav tab shows the set builder", async () => {
    render(<OperatorApp />);
    fireEvent.click(screen.getByRole("button", { name: "Biblioteca" }));
    fireEvent.click(screen.getByRole("button", { name: "Início" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Apresentar" })).toBeInTheDocument()
    );
  });

  it("navigates to the countdown section", async () => {
    render(<OperatorApp />);
    fireEvent.click(screen.getByRole("button", { name: "Cronômetro" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Cronômetro" })).toBeInTheDocument()
    );
    expect(screen.getByText("Min")).toBeInTheDocument();
    expect(screen.getByText("Seg")).toBeInTheDocument();
  });

  it("navigates to the media section", async () => {
    render(<OperatorApp />);
    fireEvent.click(screen.getByRole("button", { name: "Mídia" }));
    await waitFor(() =>
      expect(screen.getByTestId("add-media-button")).toBeInTheDocument()
    );
    expect(screen.getByTestId("filter-all")).toBeInTheDocument();
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("navigates to the backup section", async () => {
    render(<OperatorApp />);
    fireEvent.click(screen.getByRole("button", { name: "Backup" }));
    await waitFor(() =>
      expect(screen.getByText("Exportar biblioteca")).toBeInTheDocument()
    );
    expect(screen.getByText("Importar biblioteca")).toBeInTheDocument();
  });

  it("navigates to the settings section", async () => {
    render(<OperatorApp />);
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    await waitFor(() =>
      expect(screen.getByText("Geral")).toBeInTheDocument()
    );
    expect(screen.getByText("Idioma")).toBeInTheDocument();
    expect(screen.getByText("Janelas")).toBeInTheDocument();
  });

  it("subscribes to all required events on mount", async () => {
    render(<OperatorApp />);
    await waitFor(() => {
      const events = vi.mocked(listen).mock.calls.map(([event]) => event);
      expect(events).toContain("songs_changed");
      expect(events).toContain("set_changed");
      expect(events).toContain("state_changed");
      expect(events).toContain("countdown_tick");
      expect(events).toContain("locale_changed");
    });
  });
});
