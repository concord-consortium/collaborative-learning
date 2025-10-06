import { useRef } from "react";

export interface AuthoringPreview {
  openPreview: (branch: string, unit: string) => void;
  reloadAllPreviews: () => void;
}

export const useAuthoringPreview = (): AuthoringPreview => {
  const windowsRef = useRef<Window[]>([]);

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
