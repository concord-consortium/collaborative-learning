import { useEffect, useRef } from "react";
import { DocumentModelType, getDocumentContext } from "../models/document/document";
import { IDocumentContext } from "../models/document/document-types";
import { usePrevious } from "./use-previous";

export function useDocumentContext(document: DocumentModelType) {
  const prevDocument = usePrevious(document);
  const documentContext = useRef<IDocumentContext>(getDocumentContext(document));
  useEffect(() => {
    if (document !== prevDocument) {
      documentContext.current = getDocumentContext(document);
    }
  }, [prevDocument, document]);
  return documentContext.current;
}
