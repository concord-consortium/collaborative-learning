import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StationSection } from "./station-section";
import { SeismicAdminStore } from "../seismic-admin-store";
import { SeismicAdminStoreContext } from "../hooks/use-seismic-admin-stores";
import { getStationChannelPrefix } from "../../../shared/seismic/tile-addressing";
import { utcDay } from "../../../shared/seismic/seismic-day";

const opfsStation = { network: "AK", station: "K204", channel: "HNZ" };

// The store persists filters (setRange/toggles) to localStorage; isolate the tests.
beforeEach(() => window.localStorage.clear());

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

    fireEvent.click(screen.getByRole("button", { name: "Delete raw data" }));
    // confirm modal appears with its own Delete button
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteDaysInRange).toHaveBeenCalled());
  });
});

describe("StationSection coverage rows", () => {
  const compact = { label: "Compact", metadataUrl: "https://x/compact.json" };
  const large = { label: "Large", metadataUrl: "https://x/large.json" };
  const day0 = utcDay(2026, 1, 1)!;
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));

  function makeCoverageStore(overrides: any = {}) {
    const eventService = {
      getUncoveredRanges: jest.fn(async (_s: any, _m: string, _r: any) =>
        [] as Array<{ start: number; end: number }>),
      loadEvents: jest.fn(async (_s: any, _m: string, _r: any) =>
        [{ windowStart: 1 }, { windowStart: 2 }] as any[]),
    };
    const store = new SeismicAdminStore({
      cache: {
        listStations: async () => [opfsStation],
        scanCachedDays: async () => new Set<number>(),
        stationRawBytes: async () => 0,
        deleteDaysInRange: jest.fn(async () => {}),
      } as any,
      models: [compact],
      fetchMetadata: jest.fn(async () => ({ id: "compact-v1" } as any)),
      eventService,
      ...overrides,
    });
    store.setRange("2026-01-01", "2026-01-03");   // 3 days
    return { store, eventService };
  }

  it("renders one loaded coverage row per selected model", async () => {
    const { store } = makeCoverageStore({ models: [compact, large] });
    await store.refresh();
    store.setAuthReady();
    await flush();
    const { container } = renderSection(store, getStationChannelPrefix(opfsStation));

    expect(container.querySelectorAll(".data-section.coverage").length).toBe(2);
    expect(screen.getByText("Compact")).toBeInTheDocument();
    expect(screen.getByText("Large")).toBeInTheDocument();
    expect(screen.getAllByText("3 / 3 days · 2 events").length).toBe(2);
    expect(container.querySelectorAll(".data-section.coverage .raw-timeline").length).toBe(2);
  });

  it("shows a three-state timeline including partial days", async () => {
    const { store, eventService } = makeCoverageStore();
    eventService.getUncoveredRanges.mockResolvedValue([{ start: day0 + 600, end: day0 + 1200 }]);
    await store.refresh();
    store.setAuthReady();
    await flush();
    const { container } = renderSection(store, getStationChannelPrefix(opfsStation));

    expect(screen.getByText("2 / 3 days · 2 events")).toBeInTheDocument();
    expect(container.querySelectorAll(".data-section.coverage .segment.partial").length).toBe(1);
  });

  it("shows zero stats and no timeline while a pair's coverage is pending", async () => {
    const { store } = makeCoverageStore();
    await store.refresh();   // auth never becomes ready, so coverage stays pending
    const { container } = renderSection(store, getStationChannelPrefix(opfsStation));

    expect(screen.getByText("0 / 3 days · 0 events")).toBeInTheDocument();
    expect(container.querySelector(".data-section.coverage .raw-timeline")).toBeNull();
  });

  it("shows zero stats and no timeline when coverage failed to load", async () => {
    const { store, eventService } = makeCoverageStore();
    eventService.getUncoveredRanges.mockRejectedValue(new Error("offline"));
    await store.refresh();
    store.setAuthReady();
    await flush();
    const { container } = renderSection(store, getStationChannelPrefix(opfsStation));

    expect(screen.getByText("0 / 3 days · 0 events")).toBeInTheDocument();
    expect(container.querySelector(".data-section.coverage .raw-timeline")).toBeNull();
  });

  it("shows per-model aggregate lines with no timeline bars for all stations", async () => {
    const { store } = makeCoverageStore();
    await store.refresh();
    store.setAuthReady();
    await flush();
    const { container } = render(
      <SeismicAdminStoreContext.Provider value={store}>
        <StationSection />
      </SeismicAdminStoreContext.Provider>
    );

    expect(screen.getByText("Compact")).toBeInTheDocument();
    expect(screen.getByText("3 / 3 days · 2 events")).toBeInTheDocument();
    expect(container.querySelector(".data-section.coverage .raw-timeline")).toBeNull();
  });

  describe("update button", () => {
    const key = getStationChannelPrefix(opfsStation);
    const wholeDayGap = { start: day0, end: day0 + 24 * 60 * 60 };

    it("is disabled before auth is ready", async () => {
      const { store } = makeCoverageStore();
      await store.refresh();
      renderSection(store, key);

      expect(screen.getByRole("button", { name: "Update station" })).toBeDisabled();
    });

    it("is disabled when no models are selected", async () => {
      const { store } = makeCoverageStore({ models: [] });
      await store.refresh();
      store.setAuthReady();
      await flush();
      renderSection(store, key);

      expect(screen.getByRole("button", { name: "Update station" })).toBeDisabled();
    });

    it("is disabled when the station is fully covered", async () => {
      const { store } = makeCoverageStore();   // no gaps → fully covered
      await store.refresh();
      store.setAuthReady();
      await flush();
      renderSection(store, key);

      expect(screen.getByRole("button", { name: "Update station" })).toBeDisabled();
    });

    it("is enabled when authenticated with a selected model and uncovered days", async () => {
      const { store, eventService } = makeCoverageStore();
      eventService.getUncoveredRanges.mockResolvedValue([wholeDayGap]);
      await store.refresh();
      store.setAuthReady();
      await flush();
      renderSection(store, key);

      expect(screen.getByRole("button", { name: "Update station" })).toBeEnabled();
    });

    // mobx binds store actions as read-only properties, so the click tests
    // observe the real actions' effects (deps calls + feedback) instead of spying.
    const updateDeps = () => ({
      downloadStation: jest.fn(async () => {}),
      processCoverage: jest.fn(async () => ({ processed: 0, skipped: 0, total: 0 })),
    });

    it("dispatches a single-station update on click", async () => {
      const deps = updateDeps();
      const { store, eventService } = makeCoverageStore(deps);
      eventService.getUncoveredRanges.mockResolvedValue([wholeDayGap]);
      await store.refresh();
      store.setAuthReady();
      await flush();
      renderSection(store, key);

      fireEvent.click(screen.getByRole("button", { name: "Update station" }));
      await waitFor(() => expect(store.feedback).toBe("Finished updating AK K204 HNZ."));
      expect(deps.processCoverage).toHaveBeenCalledTimes(1);
    });

    it("dispatches an all-selected update for the all-stations section on click", async () => {
      const deps = updateDeps();
      const { store, eventService } = makeCoverageStore(deps);
      eventService.getUncoveredRanges.mockResolvedValue([wholeDayGap]);
      await store.refresh();
      store.setAuthReady();
      await flush();
      render(
        <SeismicAdminStoreContext.Provider value={store}>
          <StationSection />
        </SeismicAdminStoreContext.Provider>
      );

      fireEvent.click(screen.getByRole("button", { name: "Update all stations" }));
      await waitFor(() => expect(store.feedback).toBe("Finished updating 1 station."));
      expect(deps.processCoverage).toHaveBeenCalledTimes(1);
    });

    it("disables Update all stations when no stations are selected", async () => {
      const { store, eventService } = makeCoverageStore();
      eventService.getUncoveredRanges.mockResolvedValue([wholeDayGap]);
      await store.refresh();
      store.setAuthReady();
      await flush();
      store.toggleStation(key);   // deselect the only station
      render(
        <SeismicAdminStoreContext.Provider value={store}>
          <StationSection />
        </SeismicAdminStoreContext.Provider>
      );

      expect(store.selectedStations.size).toBe(0);
      expect(screen.getByRole("button", { name: "Update all stations" })).toBeDisabled();
    });

    it("disables all action buttons while an operation is running", async () => {
      let finish!: () => void;
      const processCoverage = jest.fn(() => new Promise(res => {
        finish = () => res({ processed: 0, skipped: 0, total: 0 });
      }));
      const { store, eventService } = makeCoverageStore({
        downloadStation: jest.fn(async () => {}),
        processCoverage,
      });
      eventService.getUncoveredRanges.mockResolvedValue([wholeDayGap]);
      await store.refresh();
      store.setAuthReady();
      await flush();
      renderSection(store, key);

      const updateButton = screen.getByRole("button", { name: "Update station" });
      const downloadButton = screen.getByRole("button", { name: /download missing raw/i });
      const deleteButton = screen.getByRole("button", { name: "Delete raw data" });
      expect(updateButton).toBeEnabled();
      expect(downloadButton).toBeEnabled();
      expect(deleteButton).toBeEnabled();

      fireEvent.click(updateButton);
      await waitFor(() => expect(updateButton).toBeDisabled());
      expect(downloadButton).toBeDisabled();
      expect(deleteButton).toBeDisabled();

      finish();
      await waitFor(() => expect(deleteButton).toBeEnabled());
      expect(downloadButton).toBeEnabled();
    });
  });

  it("updates a station's coverage row when its stats load after rendering", async () => {
    const { store } = makeCoverageStore();
    await store.refresh();
    renderSection(store, getStationChannelPrefix(opfsStation));
    expect(screen.getByText("0 / 3 days · 0 events")).toBeInTheDocument();

    // Auth becomes ready after mount; the row must react to the coverage load.
    store.setAuthReady();
    await waitFor(() => expect(screen.getByText("3 / 3 days · 2 events")).toBeInTheDocument());
  });
});
