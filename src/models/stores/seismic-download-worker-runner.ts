// Isolated so the `import.meta.url` worker spawn (a webpack-only construct that Jest's
// CommonJS loader cannot parse) never ends up in a module Jest loads eagerly. The
// service reaches this only through a dynamic import from its default runner, and tests
// inject their own runner, so Jest never loads this file.
import { DownloadEvent } from "../../../shared/seismic/seismic-downloader";
import type { DownloadRunner } from "./seismic-download-service";

/** Default runner: spawns the download Web Worker and forwards its events. */
export const workerRunner: DownloadRunner = (params, onEvent, cancel) => {
  const worker = new Worker(new URL("../../workers/seismic-download-worker.ts", import.meta.url));
  worker.onmessage = (e: MessageEvent<DownloadEvent>) => {
    onEvent(e.data);
    if (e.data.type === "done" || e.data.type === "error") worker.terminate();
  };
  cancel.onCancel(() => { worker.postMessage({ type: "cancel" }); worker.terminate(); });
  worker.postMessage({ type: "download", params });
};
