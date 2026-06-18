import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";

vi.mock("../pages/InputPage", () => ({
  InputPage: () => <div>Input Route</div>,
}));

vi.mock("../pages/DisplayPage", () => ({
  DisplayPage: () => <div>Display Route</div>,
}));

vi.mock("../pages/AdminPage", () => ({
  AdminPage: () => <div>Admin Route</div>,
}));

import { App } from "../App";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    window.history.pushState({}, "", "/");
  });

  it("routes / to the input page", () => {
    render(<App />);
    expect(screen.getByText("Input Route")).toBeInTheDocument();
  });

  it("routes /display to the display page", () => {
    window.history.pushState({}, "", "/display");
    render(<App />);
    expect(screen.getByText("Display Route")).toBeInTheDocument();
  });

  it("routes /admin to the admin page", () => {
    window.history.pushState({}, "", "/admin");
    render(<App />);
    expect(screen.getByText("Admin Route")).toBeInTheDocument();
  });

  it("redirects unknown routes back to input", () => {
    window.history.pushState({}, "", "/unknown");
    render(<App />);
    expect(screen.getByText("Input Route")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("reacts to storage theme updates from another tab", () => {
    render(<App />);

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "theme", newValue: "dark" }));
    });

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
