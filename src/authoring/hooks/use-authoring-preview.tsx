import React, { createContext, useContext, useRef, ReactNode } from "react";
import { uniqueId } from "../../utilities/js-utils";

export type PreviewUserType = "student" | "teacher";

export interface AuthoringPreview {
  // `fresh` launches the preview as a brand-new fake user (unique id) so its documents are created from
  // scratch — needed to see template changes, since templates are only applied when a document is created.
  openPreview: (branch: string, unit: string, userType: PreviewUserType, problem?: string, fresh?: boolean) => void;
  reloadAllPreviews: () => void;
}

const AuthoringPreviewContext = createContext<AuthoringPreview | undefined>(undefined);

export const AuthoringPreviewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const windowsRef = useRef<Window[]>([]);

  const openPreview =
      (branch: string, unit: string, userType: PreviewUserType, problem?: string, fresh?: boolean) => {
    if (!branch || !unit) return;

    const runtimeUrl = new URL("..", window.location.href);
    const params = new URLSearchParams(window.location.search);
    params.set("unit", unit);
    params.set("authoringBranch", branch);
    // A unique id makes this a new user with no existing documents, so creation-time content (templates)
    // is applied fresh. Without it the preview reuses the default dev user and its persisted documents.
    params.set("fakeUser", fresh ? `${userType}:${uniqueId()}` : userType);
    if (problem) {
      params.set("problem", problem);
    }
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
