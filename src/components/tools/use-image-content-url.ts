import { autorun } from "mobx";
import { useContext, useEffect } from "react";
import { IDocumentContext } from "../../models/document/document-types";
import { ImageContentModelType } from "../../models/tools/image/image-content";
import { DocumentContextReact } from "../document/document-context";

type OnUrlChangeFn = (url: string, filename?: string, context?: IDocumentContext) => void;

export function useImageContentUrl(content: ImageContentModelType, onUrlChange: OnUrlChangeFn) {
  const context = useContext(DocumentContextReact);
  useEffect(() => {
    const dispose = autorun(() => {
        const { url, filename } = content;
        url && onUrlChange(url, filename, context);
    });
    return () => dispose();
  }, [content, onUrlChange]); // eslint-disable-line react-hooks/exhaustive-deps
}
