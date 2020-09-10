import { useEffect, useRef } from "react";
import { IDocumentContext } from "../components/document/document-context";
import { DocumentModelType, ISetProperties } from "../models/document/document";
import { usePrevious } from "./use-previous";

export function useDocumentContext(document: DocumentModelType) {
  const prevDocument = usePrevious(document);
  const documentContext = useRef<IDocumentContext>();
  useEffect(() => {
    if (document !== prevDocument) {
      documentContext.current = {
        type: document.type,
        key: document.key,
        title: document.title,
        originDoc: document.originDoc,
        getProperty: (key: string) => document.properties.get(key),
        setProperties: (properties: ISetProperties) => document.setProperties(properties)
      };
    }
  }, [prevDocument, document]);
  return documentContext.current;
}
