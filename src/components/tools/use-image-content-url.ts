import { autorun } from "mobx";
import { useContext, useEffect, useRef } from "react";
import { IDocumentContext } from "../../models/document/document-types";
import { ImageContentModelType } from "../../models/tools/image/image-content";
import { DocumentContextReact } from "../document/document-context";

type OnUrlChangeFn = (url: string, filename?: string, context?: IDocumentContext) => void;

export function useImageContentUrl(content: ImageContentModelType, onUrlChange: OnUrlChangeFn) {
  const context = useContext(DocumentContextReact);
  const syncedChanges = useRef(0);
  useEffect(() => {
    const dispose = autorun(() => {
      if (content.changeCount > syncedChanges.current) {
        const { url, filename } = content;
        url && onUrlChange(url, filename, context);
        syncedChanges.current = content.changeCount;
      }
    });
    return () => dispose();
  }, [content, onUrlChange]); // eslint-disable-line react-hooks/exhaustive-deps
}
