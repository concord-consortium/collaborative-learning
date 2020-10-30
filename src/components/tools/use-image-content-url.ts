import { autorun } from "mobx";
import { useContext, useEffect, useRef } from "react";
import { IDocumentContext } from "../../models/document/document-types";
import { ImageContentModelType } from "../../models/tools/image/image-content";
import { DocumentContextReact } from "../document/document-context";

type OnUrlChangeFn = (url: string, context?: IDocumentContext) => void;

export function useImageContentUrl(content: ImageContentModelType, onUrlChange: OnUrlChangeFn) {
  const context = useContext(DocumentContextReact);
  const syncedChanges = useRef(0);
  useEffect(() => {
    const dispose = autorun(() => {
      if (content.changeCount > syncedChanges.current) {
        onUrlChange(content.url, context);
        syncedChanges.current = content.changeCount;
      }
    });
    return () => dispose();
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps
}
