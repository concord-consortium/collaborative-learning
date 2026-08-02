import { render, screen } from "@testing-library/react";
import React from "react";
import { SeismicAdminStore } from "../seismic-admin-store";
import * as portalAuth from "../utils/portal-auth";
import { App } from "./app";

jest.mock("../utils/admin-firebase", () => ({
  initAdminFirebase: jest.fn(async () => undefined),
}));
jest.mock("../utils/load-catalog", () => ({
  loadCatalog: jest.fn(async () => ({ stations: [], models: [] })),
}));

const { loadCatalog } = jest.requireMock("../utils/load-catalog");

describe("App auto-login", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, "", "/seismic-admin/");
    jest.clearAllMocks();
    jest.restoreAllMocks();
    // The store's default cache reads OPFS on refresh; keep the test off real storage.
    jest.spyOn(SeismicAdminStore.prototype, "refresh").mockResolvedValue(undefined);
  });

  it("redirects through the portal before loading the catalog when the last login is fresh", () => {
    localStorage.setItem("seismic-admin-portal-last-login",
      JSON.stringify({ portal: "https://learn.concord.org", time: Date.now() }));
    const attemptSpy = jest.spyOn(portalAuth, "attemptAutoLogin").mockReturnValue(true);

    render(<App />);

    expect(attemptSpy).toHaveBeenCalled();
    expect(loadCatalog).not.toHaveBeenCalled();
    // The page shows the loading state while the browser navigates away.
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it("proceeds without redirecting when there is no fresh login record", async () => {
    const attemptSpy = jest.spyOn(portalAuth, "attemptAutoLogin");

    render(<App />);

    expect(loadCatalog).toHaveBeenCalled();
    expect(attemptSpy).toHaveReturnedWith(false);
    // The app renders once the catalog resolves and the store exists.
    expect(await screen.findByRole("button", { name: /Log in/i })).toBeInTheDocument();
  });
});
