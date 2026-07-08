import { isDirectory } from "../file-system";
import { dayToYearDoy } from "./seismic-day";
import { StationData } from "./seismic-types";
import { getStationPrefix, parseStationPrefix } from "./tile-addressing";

export interface SeismicCache {
  writeDayChunk(station: StationData, day: number, bytes: ArrayBuffer): Promise<void>;
  readDayChunk(station: StationData, day: number): Promise<ArrayBuffer | null>;
  scanCachedDays(station: StationData, startDay: number, endDay: number): Promise<Set<number>>;
  listStations(): Promise<StationData[]>;
  stationRawBytes(station: StationData, startDay: number, endDay: number): Promise<number>;
  deleteDaysInRange(station: StationData, startDay: number, endDay: number): Promise<void>;
}

const ROOT_DIR = "seismic-cache";

function fileName(day: number): string {
  const { doy } = dayToYearDoy(day);
  return `${String(doy).padStart(3, "0")}.mseed`;
}

/**
 * Create a station-first OPFS cache:
 *   /seismic-cache/{network}_{station}/{channel}/{year}/{doy}.mseed
 *
 * `getRoot` returns the root directory handle; defaults to OPFS. Tests inject a fake.
 */
export function createOpfsCache(
  getRoot: () => Promise<FileSystemDirectoryHandle> = () => navigator.storage.getDirectory()
): SeismicCache {

  async function channelYearDir(station: StationData, day: number, create: boolean) {
    const { year } = dayToYearDoy(day);
    let dir = await getRoot();
    for (const name of [ROOT_DIR, getStationPrefix(station), station.channel, String(year)]) {
      dir = await dir.getDirectoryHandle(name, { create });
    }
    return dir;
  }

  function isNotFound(err: unknown): boolean {
    return err instanceof Error && err.name === "NotFoundError";
  }

  return {
    async writeDayChunk(station, day, data) {
      const dir = await channelYearDir(station, day, true);
      const handle = await dir.getFileHandle(fileName(day), { create: true });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
    },

    async readDayChunk(station, day) {
      try {
        const dir = await channelYearDir(station, day, false);
        const handle = await dir.getFileHandle(fileName(day), { create: false });
        const file = await handle.getFile();
        return await file.arrayBuffer();
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },

    async scanCachedDays(station, startDay, endDay) {
      const cached = new Set<number>();
      for (let day = startDay; day <= endDay; day++) {
        try {
          const dir = await channelYearDir(station, day, false);
          await dir.getFileHandle(fileName(day), { create: false });
          cached.add(day);
        } catch (err) {
          if (!isNotFound(err)) throw err;
        }
      }
      return cached;
    },

    async listStations() {
      const out: StationData[] = [];
      let seismicRoot: FileSystemDirectoryHandle;

      try {
        seismicRoot = await (await getRoot()).getDirectoryHandle(ROOT_DIR, { create: false });
      } catch (err) {
        if (isNotFound(err)) return out;
        throw err;
      }

      // Walk /seismic-cache/{network}_{station}/{channel}/…
      for await (const [dirName, stationHandle] of seismicRoot.entries()) {
        if (!isDirectory(stationHandle)) continue;
        const parsed = parseStationPrefix(dirName);
        if (!parsed) continue;
        for await (const [channel, channelHandle] of stationHandle.entries()) {
          if (isDirectory(channelHandle)) out.push({ ...parsed, channel });
        }
      }

      return out;
    },

    async stationRawBytes(station, startDay, endDay) {
      let total = 0;
      for (let day = startDay; day <= endDay; day++) {
        try {
          const dir = await channelYearDir(station, day, false);
          const handle = await dir.getFileHandle(fileName(day), { create: false });
          total += (await handle.getFile()).size;
        } catch (err) {
          if (!isNotFound(err)) throw err;
        }
      }
      return total;
    },

    async deleteDaysInRange(station, startDay, endDay) {
      for (let day = startDay; day <= endDay; day++) {
        try {
          const dir = await channelYearDir(station, day, false);
          await dir.removeEntry(fileName(day));
        } catch (err) {
          if (!isNotFound(err)) throw err;
        }
      }
    },
  };
}
