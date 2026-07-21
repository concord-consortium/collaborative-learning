import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminHeader } from "./admin-header";
import { SeismicAdminStore } from "../seismic-admin-store";
import { SeismicAdminStoreContext } from "../hooks/use-seismic-admin-stores";

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
    expect(store.selected.size).toBe(0);
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
