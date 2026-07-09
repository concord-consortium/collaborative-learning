// Isolated so the `import.meta.url` worker spawn (a webpack-only construct that Jest's
// CommonJS loader cannot parse) never ends up in a module Jest loads eagerly. The
// service reaches this only through a dynamic import from its default runner, and tests
// inject their own runner, so Jest never loads this file.
import { DownloadEvent, DownloadRunner } from "../../../shared/seismic/seismic-downloader";
import { getLocalBaseUrl, isProxyEnabled } from "../../../shared/seismic/earthscope-client";

/** Default runner: spawns the download Web Worker and forwards its events. */
export const workerRunner: DownloadRunner = (params, onEvent, cancel) => {
  const worker = new Worker(new URL("../../workers/seismic-download-worker.ts", import.meta.url));

  worker.onmessage = (e: MessageEvent<DownloadEvent>) => {
    onEvent(e.data);
    if (e.data.type === "done" || e.data.type === "error") worker.terminate();
  };

  cancel.onCancel(() => {
    worker.postMessage({ type: "cancel" });
    worker.terminate();
  });

  // Resolve the proxy status and base url here, since they default to url params but the worker
  // has no `window`. A caller that sets them explicitly (e.g. seismic-admin) wins.
  const { proxy = isProxyEnabled(), baseUrl = getLocalBaseUrl() } = params;
  worker.postMessage({ type: "download", params: { ...params, proxy, baseUrl } });
};
