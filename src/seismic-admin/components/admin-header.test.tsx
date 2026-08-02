import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminHeader } from "./admin-header";
import { SeismicAdminStore } from "../seismic-admin-store";
import { SeismicAdminStoreContext } from "../hooks/use-seismic-admin-stores";
import * as portalAuth from "../utils/portal-auth";

function makeStore() {
  const listStations = jest.fn(async () => [{ network: "AK", station: "K204", channel: "HNZ" }]);
  const scanCachedDays = jest.fn(async () => new Set<number>());
  const store = new SeismicAdminStore({
    cache: {
      listStations,
      scanCachedDays,
      stationRawBytes: async () => 0,
      deleteDaysInRange: async () => {},
    } as any,
  });
  return { store, listStations, scanCachedDays };
}

function renderHeader(store: SeismicAdminStore) {
  return render(
    <SeismicAdminStoreContext.Provider value={store}>
      <AdminHeader />
    </SeismicAdminStoreContext.Provider>
  );
}

describe("AdminHeader", () => {
  beforeEach(() => window.localStorage.clear());

  it("renders a checkbox per station (selected by default) and toggles selection", async () => {
    const { store } = makeStore();
    await store.refresh();
    renderHeader(store);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(store.selectedStations.size).toBe(0);
  });

  it("applies a date change immediately", async () => {
    const { store, scanCachedDays } = makeStore();
    await store.refresh();
    const scansAfterRefresh = scanCachedDays.mock.calls.length;
    renderHeader(store);

    fireEvent.change(screen.getByLabelText(/Start/), { target: { value: "2026-02-01" } });

    expect(store.startDate).toBe("2026-02-01");
    await waitFor(() => expect(scanCachedDays.mock.calls.length).toBeGreaterThan(scansAfterRefresh));
  });

  it("ignores a cleared date input", async () => {
    const { store } = makeStore();
    await store.refresh();
    renderHeader(store);

    fireEvent.change(screen.getByLabelText(/Start/), { target: { value: "" } });
    expect(store.startDate).toBe("2026-01-01");
  });

  describe("model selection", () => {
    const twoModels = [
      { label: "Compact", metadataUrl: "https://x/compact.json" },
      { label: "Large", metadataUrl: "https://x/large.json" },
    ];

    function makeModelStore() {
      const store = new SeismicAdminStore({
        cache: {
          listStations: async () => [{ network: "AK", station: "K204", channel: "HNZ" }],
          scanCachedDays: async () => new Set<number>(),
          stationRawBytes: async () => 0,
          deleteDaysInRange: async () => {},
        } as any,
        models: twoModels,
      });
      return store;
    }

    it("renders a checked checkbox per model and toggles selection", async () => {
      const store = makeModelStore();
      await store.refresh();
      renderHeader(store);

      expect(screen.getByRole("checkbox", { name: "Compact" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Large" })).toBeChecked();

      fireEvent.click(screen.getByRole("checkbox", { name: "Compact" }));
      expect(store.selectedModels.has("https://x/compact.json")).toBe(false);
      expect(screen.getByRole("checkbox", { name: "Compact" })).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Large" })).toBeChecked();
    });

    it("reflects a selection restored into the store", async () => {
      const store = makeModelStore();
      store.toggleModel("https://x/large.json");
      await store.refresh();
      renderHeader(store);

      expect(screen.getByRole("checkbox", { name: "Compact" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Large" })).not.toBeChecked();
    });

    it("never disables the last checked model — zero selected is legal", async () => {
      const store = makeModelStore();
      await store.refresh();
      renderHeader(store);

      fireEvent.click(screen.getByRole("checkbox", { name: "Large" }));
      expect(screen.getByRole("checkbox", { name: "Compact" })).toBeEnabled();

      fireEvent.click(screen.getByRole("checkbox", { name: "Compact" }));
      expect(store.selectedModels.size).toBe(0);
      expect(screen.getByRole("checkbox", { name: "Compact" })).toBeEnabled();
      expect(screen.getByRole("checkbox", { name: "Large" })).toBeEnabled();
    });
  });

  describe("portal login", () => {
    it("shows a login button when portal auth is not ready", async () => {
      const { store } = makeStore();
      await store.refresh();
      renderHeader(store);

      expect(screen.getByRole("button", { name: "Log in with Portal" })).toBeInTheDocument();
      expect(screen.queryByText("Portal: signed in")).toBeNull();
    });

    it("navigates to the authorize URL on click", async () => {
      // jsdom only implements hash navigation, so observe the href assignment through one.
      const authorizeSpy = jest.spyOn(portalAuth, "buildAuthorizeUrl").mockReturnValue("#portal-login");
      const { store } = makeStore();
      await store.refresh();
      renderHeader(store);

      try {
        fireEvent.click(screen.getByRole("button", { name: "Log in with Portal" }));
        expect(authorizeSpy).toHaveBeenCalled();
        expect(window.location.hash).toBe("#portal-login");
      } finally {
        authorizeSpy.mockRestore();
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    });

    it("shows a signed-in indicator instead of the button once portal auth is ready", async () => {
      const { store } = makeStore();
      await store.refresh();
      store.setPortalAuth(async () => "fake-jwt");
      renderHeader(store);

      expect(screen.queryByRole("button", { name: "Log in with Portal" })).toBeNull();
      expect(screen.getByText("Portal: signed in")).toBeInTheDocument();
    });
  });

  it("disables the checkbox of the only selected station", async () => {
    const store = new SeismicAdminStore({
      cache: {
        listStations: async () => [
          { network: "AK", station: "K204", channel: "HNZ" },
          { network: "AK", station: "M205", channel: "HNZ" },
        ],
        scanCachedDays: async () => new Set<number>(),
        stationRawBytes: async () => 0,
        deleteDaysInRange: async () => {},
      } as any,
    });
    await store.refresh(); // selects both
    renderHeader(store);
    expect(screen.getByRole("checkbox", { name: "AK K204 HNZ" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "AK M205 HNZ" })).toBeEnabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "AK M205 HNZ" }));
    expect(screen.getByRole("checkbox", { name: "AK K204 HNZ" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "AK M205 HNZ" })).toBeEnabled();
  });
});
