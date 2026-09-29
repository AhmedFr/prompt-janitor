import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NavigationContext } from "@/App/navigation/NavigationContext";
import { BackButton } from "./BackButton";

afterEach(cleanup);

const nav = (canGoBack: boolean, back = vi.fn()) => ({ canGoBack, back }) as never;

describe("BackButton", () => {
  it("goes back when there is somewhere to go", () => {
    const back = vi.fn();
    render(
      <NavigationContext.Provider value={nav(true, back)}>
        <BackButton />
      </NavigationContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(back).toHaveBeenCalled();
  });

  it("renders nothing at the start of history", () => {
    render(
      <NavigationContext.Provider value={nav(false)}>
        <BackButton />
      </NavigationContext.Provider>,
    );
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("renders nothing outside the shell", () => {
    render(<BackButton />);
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });
});
