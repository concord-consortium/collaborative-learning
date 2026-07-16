import React from "react";
import { render, screen } from "@testing-library/react";
import { AdminBody } from "./admin-body";
import { SeismicAdminStore } from "../seismic-admin-store";
import { SeismicAdminStoreContext } from "../hooks/use-seismic-admin-stores";
import { getStationChannelPrefix } from "../../../shared/seismic/tile-addressing";

const stationA = { network: "AK", station: "K204", channel: "HNZ" };
const stationB = { network: "AK", station: "M205", channel: "HNZ" };

function makeStore() {
  const store = new SeismicAdminStore({
    cache: {
      listStations: async () => [stationA, stationB],
      scanCachedDays: async () => new Set<number>([1, 2, 3]),
      stationRawBytes: async () => 1536,
      deleteDaysInRange: async () => {},
    } as any,
  });
  return { store };
}

function renderBody(store: SeismicAdminStore) {
  return render(
    <SeismicAdminStoreContext.Provider value={store}>
      <AdminBody />
    </SeismicAdminStoreContext.Provider>
  );
}

describe("AdminBody", () => {
  beforeEach(() => window.localStorage.clear());

  it("renders a section per selected station plus an all-stations section when more than one is selected", async () => {
    const { store } = makeStore();
    await store.refresh(); // selects both stations by default

    renderBody(store);

    expect(screen.getByText("AK K204 HNZ")).toBeInTheDocument();
    expect(screen.getByText("AK M205 HNZ")).toBeInTheDocument();
    expect(screen.getByText("All selected stations (2)")).toBeInTheDocument();
  });

  it("renders only a single station section and no all-stations section when one is selected", async () => {
    const { store } = makeStore();
    await store.refresh();
    store.toggle(getStationChannelPrefix(stationB)); // deselect one, leaving one selected

    renderBody(store);

    expect(screen.getByText("AK K204 HNZ")).toBeInTheDocument();
    expect(screen.queryByText("AK M205 HNZ")).not.toBeInTheDocument();
    expect(screen.queryByText(/All selected stations/)).not.toBeInTheDocument();
  });
});
