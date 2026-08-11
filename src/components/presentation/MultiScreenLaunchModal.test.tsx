import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MultiScreenLaunchModal } from "./MultiScreenLaunchModal";

describe("MultiScreenLaunchModal", () => {
  afterEach(() => cleanup());

  it("affirmative control calls onAnswer(true)", () => {
    const onAnswer = vi.fn();
    const onCancel = vi.fn();
    render(<MultiScreenLaunchModal onAnswer={onAnswer} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Espelhar as duas"));
    expect(onAnswer).toHaveBeenCalledWith(true);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("negative control calls onAnswer(false)", () => {
    const onAnswer = vi.fn();
    const onCancel = vi.fn();
    render(<MultiScreenLaunchModal onAnswer={onAnswer} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Somente Tela 1"));
    expect(onAnswer).toHaveBeenCalledWith(false);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("Esc calls onCancel and never onAnswer", () => {
    const onAnswer = vi.fn();
    const onCancel = vi.fn();
    render(<MultiScreenLaunchModal onAnswer={onAnswer} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("close control calls onCancel and never onAnswer", () => {
    const onAnswer = vi.fn();
    const onCancel = vi.fn();
    render(<MultiScreenLaunchModal onAnswer={onAnswer} onCancel={onCancel} />);
    fireEvent.click(screen.getByLabelText("Cancelar"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("uses custom screen names from props instead of the hard-coded defaults", () => {
    const onAnswer = vi.fn();
    const onCancel = vi.fn();
    render(
      <MultiScreenLaunchModal
        onAnswer={onAnswer}
        onCancel={onCancel}
        screenNames={["Projetor", "TV Hall"]}
      />,
    );
    expect(screen.getByText("Somente Projetor")).toBeInTheDocument();
    expect(screen.queryByText("Somente Tela 1")).toBeNull();
  });
});
