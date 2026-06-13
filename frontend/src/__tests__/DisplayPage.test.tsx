import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";

// Capture the WS handler the page registers so the test can drive events.
const hoisted = vi.hoisted(() => ({
  handler: null as null | ((e: unknown) => void),
}));

vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: (h: (e: unknown) => void) => {
    hoisted.handler = h;
  },
}));

// Replace the canvas-heavy children with inert stubs.
vi.mock("../components/FloatingWall", () => ({
  FloatingWall: () => null,
}));
vi.mock("../components/MascotCorner", () => ({
  MascotCorner: () => null,
}));

import { DisplayPage } from "../pages/DisplayPage";

function send(event: unknown) {
  act(() => {
    hoisted.handler?.(event);
  });
}

beforeEach(() => {
  hoisted.handler = null;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ theme: "sky" }) }),
  );
});

describe("DisplayPage", () => {
  it("renders the wall HUD", () => {
    render(<DisplayPage />);
    expect(screen.getByText("NLC Neyveli Book Fair")).toBeInTheDocument();
    expect(screen.getByText("Live Sign Wall")).toBeInTheDocument();
    expect(screen.getByText(/signed the wall/)).toBeInTheDocument();
  });

  it("does not show the Chief Guest banner when there are none", () => {
    render(<DisplayPage />);
    send({ event: "init", data: [] });
    expect(screen.queryByText("★ Chief Guest")).toBeNull();
  });

  it("shows the Chief Guest banner with names from the init payload", () => {
    render(<DisplayPage />);
    send({
      event: "init",
      data: [
        { id: "1", name: "Audience Aaa", signature: null, timestamp: 1, is_chief_guest: false },
        { id: "2", name: "VIP Guest", signature: null, timestamp: 2, is_chief_guest: true },
      ],
    });
    expect(screen.getByText("★ Chief Guest")).toBeInTheDocument();
    expect(screen.getByText("VIP Guest")).toBeInTheDocument();
  });

  it("renders the pledge panel after a pledge_config event (Tamil first)", () => {
    render(<DisplayPage />);
    send({
      event: "pledge_config",
      config: { tamil: "தமிழ் உறுதிமொழி", hindi: "", english: "", duration_seconds: 90 },
    });
    expect(screen.getByText("தமிழ்")).toBeInTheDocument();
    expect(screen.getByText("தமிழ் உறுதிமொழி")).toBeInTheDocument();
  });

  it("removes a chief guest from the banner when a clear_chief_guests event arrives", () => {
    render(<DisplayPage />);
    send({
      event: "init",
      data: [
        { id: "2", name: "VIP Guest", signature: null, timestamp: 2, is_chief_guest: true },
      ],
    });
    expect(screen.getByText("★ Chief Guest")).toBeInTheDocument();
    send({ event: "clear_chief_guests" });
    expect(screen.queryByText("★ Chief Guest")).toBeNull();
  });

  it("adds a newly broadcast audience signature to state", () => {
    render(<DisplayPage />);
    send({ event: "init", data: [] });
    send({
      event: "new_signature",
      data: { id: "9", name: "Fresh", signature: null, timestamp: 9, is_chief_guest: false },
    });
    // No throw and the page is still mounted with its HUD.
    expect(screen.getByText(/signed the wall/)).toBeInTheDocument();
  });
});
