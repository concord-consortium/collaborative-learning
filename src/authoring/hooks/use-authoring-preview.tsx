import React, { createContext, useContext, useRef, ReactNode } from "react";

export type PreviewUserType = "student" | "teacher";

export interface AuthoringPreview {
  openPreview: (branch: string, unit: string, userType: PreviewUserType) => void;
  reloadAllPreviews: () => void;
}

const AuthoringPreviewContext = createContext<AuthoringPreview | undefined>(undefined);

export const AuthoringPreviewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const windowsRef = useRef<Window[]>([]);

  const openPreview = (branch: string, unit: string, userType: PreviewUserType) => {
    if (!branch || !unit) return;

    const runtimeUrl = new URL("..", window.location.href);
    const params = new URLSearchParams(window.location.search);
    params.set("unit", unit);
    params.set("authoringBranch", branch);
    params.set("fakeUser", userType);
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

  return (
    <AuthoringPreviewContext.Provider value={{ openPreview, reloadAllPreviews }}>
      {children}
    </AuthoringPreviewContext.Provider>
  );
};

export const useAuthoringPreview = (): AuthoringPreview => {
  const context = useContext(AuthoringPreviewContext);
  if (!context) {
    throw new Error("useAuthoringPreview must be used within an AuthoringPreviewProvider");
  }
  return context;
};
