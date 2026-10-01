import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { FontSize } from "../../types";

vi.mock("../../stores/settings", () => ({
  useSettingsStore: vi.fn(),
}));

import { AnnouncementDialog } from "./AnnouncementDialog";
import { useSettingsStore } from "../../stores/settings";

// jsdom does not implement ResizeObserver, which the preview's SlideStage needs.
class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ResizeObserver = ResizeObserverStub;
  }
});

afterAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).ResizeObserver;
});

const setAnnouncementFontSize = vi.fn();

function mockSettings(fontSize: FontSize = "lg") {
  const state = {
    announcementFontFamily: "sans",
    announcementFontSize: fontSize,
    announcementPreset: "preto-branco",
    announcementPosition: "center",
    announcementMargin: "lg",
    announcementLineSpacing: "normal",
    announcementBoldLevel: "normal",
    setAnnouncementFontSize,
  };
  vi.mocked(useSettingsStore).mockImplementation((sel: any) => sel(state));
}

function renderDialog() {
  const handlers = { onCancel: vi.fn(), onConfirm: vi.fn() };
  render(<AnnouncementDialog {...handlers} />);
  return handlers;
}

const textarea = () => screen.getByPlaceholderText("Digite o texto do aviso…");
const preview = () => screen.getByTestId("announcement-preview");

describe("AnnouncementDialog", () => {
  beforeEach(() => {
    setAnnouncementFontSize.mockReset();
    mockSettings();
  });
  afterEach(cleanup);

  it("focuses the textarea on open", () => {
    renderDialog();
    expect(document.activeElement).toBe(textarea());
  });

  it("previews the placeholder, dimmed, while the text is empty (P19-06)", () => {
    renderDialog();
    expect(preview()).toHaveTextContent("Digite o texto do aviso…");
    expect(preview().querySelector(".opacity-40")).not.toBeNull();
  });

  it("previews the typed text as the wall renders it (P19-05, P19-06)", () => {
    renderDialog();
    fireEvent.change(textarea(), { target: { value: "  Culto às 19h  " } });
    const p = preview().querySelector("p")!;
    expect(p.textContent).toBe("Culto às 19h");
    // WarningBody sizes the text from the announcement setting: lg → 48px.
    expect(p.style.fontSize).toBe("48px");
    expect(preview().querySelector(".opacity-40")).toBeNull();
  });

  it("shows the current size and steps it through the global setting (P19-07, P19-08)", () => {
    renderDialog();
    expect(screen.getByTestId("announcement-size")).toHaveTextContent("Grande");
    fireEvent.click(screen.getByLabelText("Aumentar texto"));
    expect(setAnnouncementFontSize).toHaveBeenLastCalledWith("xl");
    fireEvent.click(screen.getByLabelText("Diminuir texto"));
    expect(setAnnouncementFontSize).toHaveBeenLastCalledWith("md");
  });

  it("disables the stepper at either end of the scale (P19-07)", () => {
    mockSettings("sm");
    renderDialog();
    expect(screen.getByLabelText("Diminuir texto")).toBeDisabled();
    expect(screen.getByLabelText("Aumentar texto")).toBeEnabled();
    cleanup();

    mockSettings("xxl");
    renderDialog();
    expect(screen.getByLabelText("Aumentar texto")).toBeDisabled();
    expect(screen.getByLabelText("Diminuir texto")).toBeEnabled();
  });

  it("confirms the trimmed text, and only when there is some (P19-09)", () => {
    const { onConfirm } = renderDialog();
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    fireEvent.change(textarea(), { target: { value: "   " } });
    expect(confirm).toBeDisabled();

    fireEvent.change(textarea(), { target: { value: " Aviso \n" } });
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("Aviso");
  });

  it("sends on Ctrl+Enter and cancels on Escape (P19-09)", () => {
    const { onConfirm, onCancel } = renderDialog();
    fireEvent.change(textarea(), { target: { value: "Oração" } });
    fireEvent.keyDown(textarea(), { key: "Enter", ctrlKey: true });
    expect(onConfirm).toHaveBeenCalledWith("Oração");

    fireEvent.keyDown(textarea(), { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("cancelling never touches the size setting (P19-08)", () => {
    const { onCancel } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();
    expect(setAnnouncementFontSize).not.toHaveBeenCalled();
  });
});
