import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { SlideStage } from "./SlideStage";

// jsdom does not implement ResizeObserver — provide a minimal stub so the
// component can mount without throwing.
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

describe("SlideStage", () => {
  it("renders its children", () => {
    render(
      <SlideStage>
        <span>hello stage</span>
      </SlideStage>
    );
    expect(screen.getByText("hello stage")).toBeInTheDocument();
  });

  it("inner stage element has width 1280 and height 720", () => {
    render(
      <SlideStage>
        <span>content</span>
      </SlideStage>
    );
    const stage = screen.getByTestId("slide-stage");
    expect(stage).toBeInTheDocument();
    // Dimensions are applied via inline style
    expect(stage).toHaveStyle({ width: "1280px", height: "720px" });
  });

  it("applies the provided backgroundColor to the wrapper", () => {
    const { container } = render(
      <SlideStage backgroundColor="#ff0000">
        <span>colored</span>
      </SlideStage>
    );
    // The wrapper is the outermost div rendered by SlideStage
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveStyle({ backgroundColor: "#ff0000" });
  });

  it("defaults backgroundColor to #000000 when not provided", () => {
    const { container } = render(
      <SlideStage>
        <span>default bg</span>
      </SlideStage>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveStyle({ backgroundColor: "#000000" });
  });
});
