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
  selectedSortId: string | undefined;
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
  selectedSortId
}: UseDataCardTileHeightProps) => {

  const attrCtRef = useRef(attrCount);

  useEffect(() => {
    if (!tileElt) return;
    const uiHeight = tileElt.querySelector(".data-card-container")?.scrollHeight || 0;
    const spaceLeft = height ? height - uiHeight : 0;
    const adjustForEdits = !readOnly && (attrCtRef.current < attrCount || spaceLeft < kButtonSpace);
    // documentId is undefined when loading in left-side content tabs
    const loadingInContent = !documentId && readOnly;

    const weAreLogging = false;
    if (weAreLogging){
      console.log("\n| figuring out if we can and will adjust tile height\n");
      console.log("| tileElt: ", tileElt, "\n");
      console.log("| height: ", height, "\n");
      console.log("| currEditAttrId: ", currEditAttrId, "\n");
      console.log("| attrCount: ", attrCount, "\n");
      console.log("| selectedSortId: ", selectedSortId, "\n");
      console.log("| calc: uiHeight: ", uiHeight, "\n");
      console.log("| calc: spaceLeft: ", spaceLeft, "\n");
      console.log("| calc: adjustForEdits: ", adjustForEdits, "\n");
    }

    if (loadingInContent) {
      onRequestRowHeight(modelId, Math.max(uiHeight, kExampleDeckHeight));
    }

    else if (adjustForEdits) {
      onRequestRowHeight(modelId, uiHeight + kButtonSpace);
    }

  }, [attrCount, currEditAttrId, height, modelId, onRequestRowHeight, readOnly, tileElt, documentId, selectedSortId]);
};
