/// <reference lib="webworker" />
import { fetchAvailability, fetchRawSeismicData, EarthscopeOptions } from "../../shared/seismic/earthscope-client";
import { createOpfsCache } from "../../shared/seismic/opfs-seismic-cache";
import { downloadRange, DownloadParams, DownloaderDeps } from "../../shared/seismic/seismic-downloader";

export interface DownloadRequest { type: "download"; params: DownloadParams; }
export interface CancelRequest { type: "cancel"; }
export type WorkerRequest = DownloadRequest | CancelRequest;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let abort: AbortController | null = null;
const cache = createOpfsCache();

function makeDeps(options: EarthscopeOptions): DownloaderDeps {
  return {
    fetchAvailability: (q, signal) => fetchAvailability(q, { ...options, signal }),
    fetchRaw: async (q, signal) => {
      const response = await fetchRawSeismicData(q, { ...options, signal });
      return response.arrayBuffer();
    },
    cache,
  };
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg.type === "cancel") {
    abort?.abort();
    return;
  }
  if (msg.type === "download") {
    abort?.abort();
    abort = new AbortController();
    await downloadRange(makeDeps(msg.params), { ...msg.params, signal: abort.signal }, e => ctx.postMessage(e));
  }
};
