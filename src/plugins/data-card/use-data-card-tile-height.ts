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
}

export const useDataCardTileHeight = ({
  tileElt,
  height,
  currEditAttrId,
  modelId,
  documentId,
  readOnly,
  onRequestRowHeight,
  attrCount
}: UseDataCardTileHeightProps) => {

  const attrCtRef = useRef(attrCount);

  useEffect(() => {
    if (!tileElt) return;

    const uiHeight = tileElt.querySelector(".data-card-container")?.scrollHeight || 0;
    const spaceLeft = height ? height - uiHeight : 0;

    if (attrCtRef.current < attrCount) {
      attrCtRef.current = attrCount;
      if (!readOnly) {
        if (spaceLeft < kButtonSpace) {
          onRequestRowHeight(modelId, uiHeight + kButtonSpace);
        }
      }
    } else {
      if (!documentId && readOnly) {
        onRequestRowHeight(modelId, Math.max(uiHeight, kExampleDeckHeight));
      }
      if (!readOnly) {
        if (spaceLeft < kButtonSpace) {
          onRequestRowHeight(modelId, uiHeight + kButtonSpace);
        }
      }
    }
  }, [attrCount, currEditAttrId, height, modelId, onRequestRowHeight, readOnly, tileElt, documentId]);
};
