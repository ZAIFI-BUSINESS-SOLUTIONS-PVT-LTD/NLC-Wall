import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminPage } from "../pages/AdminPage";

const HEALTH = { status: "ok", count: 2, audience_count: 1, cg_count: 1 };
const PLEDGE = { tamil: "", hindi: "", english: "", duration_seconds: 90 };
const CG = { enabled: false, retention_mode: "forever", retention_until: null };

function jsonResp(body: unknown) {
  return Promise.resolve({ ok: true, json: async () => body } as Response);
}

function routedFetch() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/health")) return jsonResp(HEALTH);
    if (url.includes("/admin/display-theme")) return jsonResp({ theme: "sky" });
    if (url.includes("/admin/pledge-config")) return jsonResp(PLEDGE);
    if (url.includes("/admin/chief-guest-config")) return jsonResp(CG);
    if (url.includes("/admin/db/signatures")) return jsonResp({ total: 0, items: [] });
    if (url.includes("/admin/signatures")) return jsonResp({ status: "cleared" });
    return jsonResp({});
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", routedFetch());
  vi.stubGlobal("confirm", vi.fn(() => true));
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminPage", () => {
  it("renders the admin header", () => {
    render(<AdminPage />);
    expect(screen.getByText("Admin Panel")).toBeInTheDocument();
    expect(screen.getByText("Live Sign Wall")).toBeInTheDocument();
  });

  it("shows the live stats fetched from /health", async () => {
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText("Audience")).toBeInTheDocument();
    });
    // audience_count = 1, cg_count = 1, total = 2
    expect(screen.getByText("Total Signed").previousSibling ?? document.body).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(2); // audience + cg
      expect(screen.getByText("2")).toBeInTheDocument(); // total
    });
  });

  it("renders the empty database state", async () => {
    render(<AdminPage />);
    expect(
      await screen.findByText("No signatures in database yet."),
    ).toBeInTheDocument();
  });

  it("posts a new display theme when a theme button is clicked", async () => {
    const fetchMock = routedFetch();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AdminPage />);

    await user.click(await screen.findByRole("button", { name: /Space/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/display-theme",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const call = fetchMock.mock.calls.find(
      (c) => c[0] === "/admin/display-theme" && (c[1] as RequestInit)?.method === "POST",
    )!;
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ theme: "space" });
  });

  it("clears the audience wall after confirmation", async () => {
    const fetchMock = routedFetch();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AdminPage />);

    // The first "Clear" button is the audience-wall clear in the Danger Zone.
    const clearButtons = await screen.findAllByRole("button", { name: "Clear" });
    await user.click(clearButtons[0]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/signatures",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  it("exposes all seven display-wall theme options", async () => {
    render(<AdminPage />);
    for (const label of ["Sky", "Space", "Aurora", "Ocean", "Neon", "Forest", "Sunset"]) {
      expect(await screen.findByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });
});
