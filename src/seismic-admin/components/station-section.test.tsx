import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StationSection } from "./station-section";
import { SeismicAdminStore } from "../seismic-admin-store";
import { SeismicAdminStoreContext } from "../hooks/use-seismic-admin-stores";
import { getStationChannelPrefix } from "../../../shared/seismic/tile-addressing";

const opfsStation = { network: "AK", station: "K204", channel: "HNZ" };

function makeStore(deleteDaysInRange = jest.fn(async () => {})) {
  const store = new SeismicAdminStore({
    cache: {
      listStations: async () => [opfsStation],
      scanCachedDays: async () => new Set<number>([1, 2, 3]),
      stationRawBytes: async () => 1536,
      deleteDaysInRange,
    } as any,
  });
  return { store, deleteDaysInRange };
}

function renderSection(store: SeismicAdminStore, stationKey: string) {
  return render(
    <SeismicAdminStoreContext.Provider value={store}>
      <StationSection stationKey={stationKey} />
    </SeismicAdminStoreContext.Provider>
  );
}

describe("StationSection", () => {
  it("enables Download missing raw for a station with no location", async () => {
    const { store } = makeStore();
    await store.refresh();
    renderSection(store, getStationChannelPrefix(opfsStation));

    expect(screen.getByRole("button", { name: /download missing raw/i })).toBeEnabled();
  });

  it("deletes raw data after the confirm modal is accepted", async () => {
    const { store, deleteDaysInRange } = makeStore();
    await store.refresh();
    renderSection(store, getStationChannelPrefix(opfsStation));

    fireEvent.click(screen.getByRole("button", { name: "Delete raw" }));
    // confirm modal appears with its own Delete button
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteDaysInRange).toHaveBeenCalled());
  });
});
