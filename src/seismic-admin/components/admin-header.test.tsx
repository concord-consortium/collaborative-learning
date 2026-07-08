import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdminHeader } from "./admin-header";
import { SeismicAdminStore } from "../seismic-admin-store";
import { SeismicAdminStoreContext } from "../hooks/use-seismic-admin-stores";

function makeStore(listStations = jest.fn(async () => [{ network: "AK", station: "K204", channel: "HNZ" }])) {
  const store = new SeismicAdminStore({
    cache: {
      listStations,
      scanCachedDays: async () => new Set<number>(),
      stationRawBytes: async () => 0,
      deleteDaysInRange: async () => {},
    } as any,
  });
  return { store, listStations };
}

function renderHeader(store: SeismicAdminStore) {
  return render(
    <SeismicAdminStoreContext.Provider value={store}>
      <AdminHeader />
    </SeismicAdminStoreContext.Provider>
  );
}

describe("AdminHeader", () => {
  it("renders a checkbox per station (selected by default) and toggles selection", async () => {
    const { store } = makeStore();
    await store.refresh();
    renderHeader(store);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(store.selected.size).toBe(0);
  });

  it("keeps Apply disabled until the range changes, then applies + refreshes", async () => {
    const { store, listStations } = makeStore();
    // initial load — listStations called once
    await store.refresh();
    renderHeader(store);

    const apply = screen.getByRole("button", { name: "Apply" });
    expect(apply).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Start/), { target: { value: "2026-02-01" } });
    expect(apply).toBeEnabled();

    fireEvent.click(apply);
    // setRange applied the draft range
    expect(store.startDate).toBe("2026-02-01");
    // refresh ran again (initial + apply)
    expect(listStations).toHaveBeenCalledTimes(2);
  });
});
