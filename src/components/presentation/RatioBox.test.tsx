import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { RatioBox } from "./RatioBox";

describe("RatioBox", () => {
  it("renders children inside an absolute content layer", () => {
    const { getByTestId } = render(
      <RatioBox>
        <span data-testid="child">hi</span>
      </RatioBox>,
    );
    const child = getByTestId("child");
    const layer = child.parentElement!;
    expect(layer.className).toContain("absolute");
    expect(layer.className).toContain("inset-0");
  });

  it("uses a padding-ratio spacer (16:9 default) instead of aspect-ratio", () => {
    const { container } = render(
      <RatioBox>
        <span>hi</span>
      </RatioBox>,
    );
    const spacer = container.querySelector("[aria-hidden]") as HTMLElement;
    expect(spacer).toBeTruthy();
    expect(spacer.style.paddingTop).toBe("56.25%");
    // The outer box must not rely on the aspect-ratio property.
    expect(container.firstElementChild!.className).not.toContain("aspect-");
  });

  it("honors a custom ratio", () => {
    const { container } = render(<RatioBox ratioPercent={75} />);
    const spacer = container.querySelector("[aria-hidden]") as HTMLElement;
    expect(spacer.style.paddingTop).toBe("75%");
  });

  it("applies outer and content classes", () => {
    const { container, getByText } = render(
      <RatioBox className="rounded border" contentClassName="custom-layer">
        <span>x</span>
      </RatioBox>,
    );
    expect(container.firstElementChild!.className).toContain("rounded");
    expect(getByText("x").parentElement!.className).toContain("custom-layer");
  });
});
