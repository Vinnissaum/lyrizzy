import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageRenderer } from "./StageRenderer";
import { usePresentationStore } from "../../stores/presentation";
import { useCountdownStore } from "../../stores/countdown";
import type { PresentationState, CountdownState } from "../../types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const defaultCountdown: CountdownState = {
  mode: "idle", durationMs: 0, remainingMs: 0, endBehavior: "holdZero",
};

function setPresState(state: PresentationState | null) {
  usePresentationStore.setState({ state });
}

function setCountdownState(state: CountdownState) {
  useCountdownStore.setState({ state });
}

const baseState: PresentationState = {
  mode: "idle",
  currentItemIndex: 0,
  currentSlideIndex: 0,
  itemSlideCounts: [],
};

describe("StageRenderer", () => {
  beforeEach(() => {
    setPresState(null);
    setCountdownState(defaultCountdown);
  });

  it("shows no-set placeholder when state is null", () => {
    render(<StageRenderer />);
    expect(screen.getByText("Sem conjunto carregado")).toBeInTheDocument();
  });

  it("renders two previews when a set is loaded", () => {
    setPresState({
      ...baseState,
      mode: "live",
      set: {
        id: "s1", name: "Test Set", createdAt: 0, updatedAt: 0,
        items: [{ id: "i1", setId: "s1", itemType: "song", sortOrder: 0 }],
      },
      currentSlide: { lines: ["Amazing grace"], sectionLabel: "Estrofe 1", sectionId: "sec1" },
      nextSlide: undefined,
      itemSlideCounts: [2],
    });
    render(<StageRenderer />);
    expect(screen.getByText("Atual")).toBeInTheDocument();
    expect(screen.getByText("Próximo")).toBeInTheDocument();
  });

  it("shows end-of-service in next preview when nextSlide is null", () => {
    setPresState({
      ...baseState,
      mode: "live",
      set: {
        id: "s1", name: "Test Set", createdAt: 0, updatedAt: 0,
        items: [{ id: "i1", setId: "s1", itemType: "song", sortOrder: 0 }],
      },
      currentSlide: { lines: ["Last slide"], sectionLabel: "Estrofe", sectionId: "sec1" },
      nextSlide: undefined,
      itemSlideCounts: [1],
    });
    render(<StageRenderer />);
    expect(screen.getByText("Fim do culto")).toBeInTheDocument();
  });

  it("shows blank indicator when mode is blank", () => {
    setPresState({
      ...baseState,
      mode: "blank",
      set: {
        id: "s1", name: "Test Set", createdAt: 0, updatedAt: 0,
        items: [{ id: "i1", setId: "s1", itemType: "song", sortOrder: 0 }],
      },
      itemSlideCounts: [1],
    });
    render(<StageRenderer />);
    expect(screen.getByText("Tela apagada")).toBeInTheDocument();
  });

  it("shows frozen indicator when mode is frozen", () => {
    setPresState({
      ...baseState,
      mode: "frozen",
      set: {
        id: "s1", name: "Test Set", createdAt: 0, updatedAt: 0,
        items: [{ id: "i1", setId: "s1", itemType: "song", sortOrder: 0 }],
      },
      itemSlideCounts: [1],
    });
    render(<StageRenderer />);
    expect(screen.getByText("Tela congelada")).toBeInTheDocument();
  });
});
