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
    if (url.includes("/admin/import-signatures")) return jsonResp({ status: "imported", total: 1, added: 1, updated: 0 });
    if (url.includes("/admin/db/signatures")) return jsonResp({ total: 0, items: [] });
    if (url.includes("/admin/signatures")) return jsonResp({ status: "cleared" });
    return jsonResp({});
  });
}

function routedFetchWithRows(rows: unknown[], total = rows.length) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/health")) return jsonResp(HEALTH);
    if (url.includes("/admin/display-theme")) return jsonResp({ theme: "sky" });
    if (url.includes("/admin/pledge-config")) return jsonResp(PLEDGE);
    if (url.includes("/admin/chief-guest-config")) return jsonResp(CG);
    if (url.includes("/admin/import-signatures")) return jsonResp({ status: "imported", total: 1, added: 1, updated: 0 });
    if (url.includes("/admin/db/signatures") && init?.method === "PUT") return jsonResp({ status: "updated" });
    if (url.includes("/admin/db/signatures") && init?.method === "DELETE") return jsonResp({ status: "deleted" });
    if (url.includes("/admin/db/signatures")) return jsonResp({ total, items: rows });
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

  it("imports a SignWall JSON export from the admin panel", async () => {
    const fetchMock = routedFetch();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const { container } = render(<AdminPage />);

    await user.click(await screen.findByRole("button", { name: /Import Signatures - JSON/ }));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(
      [JSON.stringify([{ id: "sig-1", name: "Imported", signature: null, timestamp: 1, is_chief_guest: false }])],
      "signatures.json",
      { type: "application/json" },
    );
    await user.upload(input, file);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/import-signatures",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const call = fetchMock.mock.calls.find((c) => c[0] === "/admin/import-signatures")!;
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual([
      { id: "sig-1", name: "Imported", signature: null, timestamp: 1, is_chief_guest: false },
    ]);
    expect(await screen.findByText("Imported 1 signatures (1 new, 0 updated).")).toBeInTheDocument();
  });

  it("exposes all seven display-wall theme options", async () => {
    render(<AdminPage />);
    for (const label of ["Sky", "Space", "Aurora", "Ocean", "Neon", "Forest", "Sunset"]) {
      expect(await screen.findByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("edits a database row name and posts the trimmed value", async () => {
    const row = { id: "sig-1", name: "Before", timestamp: 1, has_sig: false, is_chief_guest: false };
    const fetchMock = routedFetchWithRows([row]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AdminPage />);

    await screen.findByText("Before");
    await user.click(screen.getByTitle("Edit name"));
    const input = screen.getByDisplayValue("Before");
    await user.clear(input);
    await user.type(input, "  After  ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Name updated.")).toBeInTheDocument());
    const call = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/admin/db/signatures/sig-1"));
    expect(call?.[1]).toEqual(expect.objectContaining({ method: "PUT" }));
    expect(JSON.parse((call?.[1] as RequestInit).body as string)).toEqual({ name: "After" });
  });

  it("toggles chief-guest status from the database table", async () => {
    const row = { id: "sig-2", name: "Guest", timestamp: 1, has_sig: false, is_chief_guest: false };
    const fetchMock = routedFetchWithRows([row]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AdminPage />);

    await screen.findByText("Guest");
    await user.click(screen.getByTitle("Mark as Chief Guest"));

    await waitFor(() => expect(screen.getByText('"Guest" marked as Chief Guest.')).toBeInTheDocument());
    const call = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/admin/db/signatures/sig-2/chief-guest"));
    expect(call?.[1]).toEqual(expect.objectContaining({ method: "PUT" }));
    expect(JSON.parse((call?.[1] as RequestInit).body as string)).toEqual({ is_chief_guest: true });
  });

  it("does not clear audience signatures when confirmation is cancelled", async () => {
    const fetchMock = routedFetch();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => false));
    const user = userEvent.setup();
    render(<AdminPage />);

    const clearButtons = await screen.findAllByRole("button", { name: "Clear" });
    await user.click(clearButtons[0]);

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/admin/signatures",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
