import { useEffect, useRef } from "react";
import { urlParams } from "../../utilities/url-params";

export interface AuthoringPreview {
  openPreview: (branch: string, unit: string) => void;
  reloadAllPreviews: () => void;
}

const isAuthoring = window.location.pathname.startsWith("/authoring");

export const useAuthoringPreview = (): AuthoringPreview => {
  const windowsRef = useRef<Window[]>([]);
  const lastAliveRef = useRef<number>(Date.now());

  useEffect(() => {
    if (isAuthoring) {
      const sendHeartbeat = () => {
        windowsRef.current = windowsRef.current.filter(win => {
          if (win && !win.closed) {
            win.postMessage("authoring:alive!", "*");
            return true;
          }
          return false;
        });
      };

      const heartbeatInterval = setInterval(sendHeartbeat, 1000);
      return () => clearInterval(heartbeatInterval);

    } else if (urlParams.authoringBranch) {
      // In runtime authoring preview, show an alert if the authoring window closes
      const handleMessage = (event: MessageEvent) => {
        if (event.data === "authoring:alive!") {
          lastAliveRef.current = Date.now();
        }
      };
      window.addEventListener("message", handleMessage);

      const interval = setInterval(() => {
        if (Date.now() - lastAliveRef.current > 5000) {
          alert([
            "The authoring window has closed or been reloaded and this window will no longer automatically reload.",
            "Please close this window and reopen the preview from the authoring tool."
          ].join("\n\n"));
          clearInterval(interval);
        }
      }, 5000);

      return () => {
        window.removeEventListener("message", handleMessage);
        clearInterval(interval);
      };
    }
  }, []);

  const openPreview = (branch: string, unit: string) => {
    if (!branch || !unit) {
      return;
    }
    const runtimeUrl = new URL("..", window.location.href);
    const params = new URLSearchParams(window.location.search);
    params.set("unit", unit);
    params.set("authoringBranch", branch);
    params.delete("fakeAuthoringAuth");
    runtimeUrl.search = params.toString();

    const win = window.open(runtimeUrl.toString(), "_blank");
    if (win) {
      windowsRef.current.push(win);
    }
  };

  const reloadAllPreviews = () => {
    windowsRef.current = windowsRef.current.filter(win => {
      if (win && !win.closed) {
        win.location.reload();
        return true;
      }
      return false;
    });
  };

  return { openPreview, reloadAllPreviews };
};
