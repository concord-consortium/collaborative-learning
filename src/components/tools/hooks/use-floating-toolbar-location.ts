import { useEffect, useRef, useState } from "react";
import { getToolbarLocation, IGetToolbarLocationBaseArgs } from "../../utilities/tile-utils";
import { IRegisterToolApiProps } from "../tool-tile";
import { useForceUpdate } from "./use-force-update";

interface IFloatingToolbarArgs extends IRegisterToolApiProps, IGetToolbarLocationBaseArgs {
  enabled: boolean;
}

/*
 * Custom hook which determines the correct location for the floating
 * toolbar relative to its associated tile.
 */
export const useFloatingToolbarLocation = ({
        onRegisterToolApi, onUnregisterToolApi,
        documentContent, toolTile, enabled, ...others
      }: IFloatingToolbarArgs) => {

  const [tileOffset, setTileOffset] = useState<{ left: number, bottom: number }>({ left: 0, bottom: 0 });
  const forceUpdate = useForceUpdate();
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    onRegisterToolApi({
      handleDocumentScroll: () => {
        enabledRef.current && forceUpdate();
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
                          toolLeft: tileOffset.left,
                          toolBottom: tileOffset.bottom,
                          ...others
                        });
  const isValid = (left != null) && (top != null) && (top >= 0);
  return isValid ? { left, top } : undefined;
};
