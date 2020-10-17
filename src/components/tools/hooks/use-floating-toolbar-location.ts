import { useEffect, useRef, useState } from "react";
import { getToolbarLocation } from "../../utilities/tile-utils";
import { IRegisterToolApiProps } from "../tool-tile";

interface IFloatingToolbarArgs extends IRegisterToolApiProps {
  documentContent?: HTMLElement | null;
  toolTile?: HTMLElement | null;
  toolbarHeight: number;
  minToolContent?: number;
  enabled: boolean;
}

/*
 * Custom hook which determines the correct location for the floating
 * toolbar relative to its associated tile.
 */
export const useFloatingToolbarLocation = ({
        onRegisterToolApi, onUnregisterToolApi,
        documentContent, toolTile,
        toolbarHeight, minToolContent, enabled
      }: IFloatingToolbarArgs) => {

  const [ , setScrollCount] = useState(0);
  const [tileOffset, setTileOffset] = useState<{ left: number, bottom: number }>({ left: 0, bottom: 0 });
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    onRegisterToolApi({
      handleDocumentScroll: () => {
        if (enabledRef.current) {
          // force redraw
          setScrollCount(count => count + 1);
        }
      },
      handleTileResize: (entry: ResizeObserverEntry) => {
        const { contentRect } = entry;
        setTileOffset({ left: contentRect.left, bottom: contentRect.bottom });
      }
    });
    return () => onUnregisterToolApi();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { left, top } = getToolbarLocation({
                          documentContent,
                          toolTile,
                          toolbarHeight,
                          minToolContent,
                          toolLeft: tileOffset.left,
                          toolBottom: tileOffset.bottom
                        });
  const isValid = (left != null) && (top != null) && (top >= 0);
  return { isValid, left, top };
};
