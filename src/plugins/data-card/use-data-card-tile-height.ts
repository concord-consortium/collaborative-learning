import { useEffect, useRef } from "react";
import { kButtonSpace, kExampleDeckHeight } from "./data-card-types";

interface UseDataCardTileHeightProps {
  tileElt: HTMLElement | null;
  height: number;
  currEditAttrId: string;
  modelId: string;
  documentId: string | undefined;
  readOnly: boolean;
  onRequestRowHeight: (id: string, height: number) => void;
  attrCount: number;
  isSingleView: boolean;
}

export const useDataCardTileHeight = ({
  tileElt,
  height,
  currEditAttrId,
  modelId,
  documentId,
  readOnly,
  onRequestRowHeight,
  attrCount,
  isSingleView
}: UseDataCardTileHeightProps) => {

  const attrCtRef = useRef(attrCount);

  useEffect(() => {
    if (!tileElt) return;

    const uiHeight = tileElt.querySelector(".data-card-container")?.scrollHeight || 0;
    const spaceLeft = height ? height - uiHeight : 0;
    const adjustForEdits = !readOnly && (attrCtRef.current < attrCount || spaceLeft < kButtonSpace);
    // documentId is undefined when loading in left-side content tabs
    const loadingInContent = !documentId && readOnly;

    if (loadingInContent) {
      console.log("| loadingInContent...");
      onRequestRowHeight(modelId, Math.max(uiHeight, kExampleDeckHeight));
    }

    else if (isSingleView && adjustForEdits) {
      console.log("| adjustForEdits...");
      onRequestRowHeight(modelId, uiHeight + kButtonSpace);
    }

  }, [attrCount, currEditAttrId, height, modelId, onRequestRowHeight, readOnly, tileElt, documentId, isSingleView]);
};
