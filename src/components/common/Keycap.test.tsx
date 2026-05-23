import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Keycap } from "./Keycap";

const shortcut = (key: string, ctrl = false, shift = false, alt = false) => ({
  key,
  ctrl,
  shift,
  alt,
});

describe("Keycap", () => {
  it("renders Escape as ESC", () => {
    render(<Keycap shortcut={shortcut("Escape")} />);
    expect(screen.getByText("ESC")).toBeTruthy();
  });

  it("renders Space for space key", () => {
    render(<Keycap shortcut={shortcut(" ")} />);
    expect(screen.getByText("Space")).toBeTruthy();
  });

  it("renders arrow glyphs", () => {
    const { unmount } = render(<Keycap shortcut={shortcut("ArrowRight")} />);
    expect(screen.getByText("→")).toBeTruthy();
    unmount();

    render(<Keycap shortcut={shortcut("ArrowLeft")} />);
    expect(screen.getByText("←")).toBeTruthy();
  });

  it("renders ArrowUp and ArrowDown glyphs", () => {
    const { unmount } = render(<Keycap shortcut={shortcut("ArrowUp")} />);
    expect(screen.getByText("↑")).toBeTruthy();
    unmount();

    render(<Keycap shortcut={shortcut("ArrowDown")} />);
    expect(screen.getByText("↓")).toBeTruthy();
  });

  it("renders modifier+Escape as Ctrl+ESC", () => {
    render(<Keycap shortcut={shortcut("Escape", true)} />);
    expect(screen.getByText("Ctrl")).toBeTruthy();
    expect(screen.getByText("ESC")).toBeTruthy();
  });

  it("renders regular single-char key uppercased", () => {
    render(<Keycap shortcut={shortcut("a")} />);
    expect(screen.getByText("A")).toBeTruthy();
  });

  it("renders multi-char key with first letter capitalised", () => {
    render(<Keycap shortcut={shortcut("enter")} />);
    expect(screen.getByText("Enter")).toBeTruthy();
  });
});
