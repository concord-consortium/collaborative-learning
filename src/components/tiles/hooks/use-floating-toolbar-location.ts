import { useEffect, useState } from "react";
import { useCurrent } from "../../../hooks/use-current";
import { getToolbarLocation, IGetToolbarLocationBaseArgs } from "../../utilities/tile-utils";
import { TileResizeEntry } from "../tile-api";
import { IRegisterTileApiProps } from "../tile-component";
import { useForceUpdate } from "./use-force-update";

export interface IFloatingToolbarProps extends IRegisterTileApiProps {
  documentContent?: HTMLElement | null;
  tileElt?: HTMLElement | null;
  scale?: number;
  onIsEnabled: () => boolean;
}

interface IFloatingToolbarArgs extends IRegisterTileApiProps, IGetToolbarLocationBaseArgs {
  enabled: boolean;
  paletteHeight?: number;
}

/*
 * Custom hook which determines the correct location for the floating
 * toolbar relative to its associated tile.
 */
export const useFloatingToolbarLocation = ({
        onRegisterTileApi, onUnregisterTileApi,
        documentContent, tileElt, enabled, paletteHeight, ...others
      }: IFloatingToolbarArgs) => {

  const [tileOffset, setTileOffset] = useState<{ left: number, bottom: number }>({ left: 0, bottom: 0 });
  const forceUpdate = useForceUpdate();
  const enabledRef = useCurrent(enabled && !!documentContent && !!tileElt);

  useEffect(() => {
    onRegisterTileApi({
      handleDocumentScroll: () => {
        enabledRef.current && forceUpdate();
      },
      handleTileResize: (entry: TileResizeEntry) => {
        const { contentRect } = entry;
        setTileOffset({ left: contentRect.left, bottom: contentRect.bottom });
      }
    }, "layout");
    return () => onUnregisterTileApi("layout");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { left, top, spaceBelow } = getToolbarLocation({
                          documentContent,
                          tileElt,
                          toolLeft: tileOffset.left,
                          toolBottom: tileOffset.bottom,
                          ...others
                        });
  const flipPalettes = paletteHeight && (spaceBelow != null) ? paletteHeight > spaceBelow : false;
  const isValid = (left != null) && (top != null) && (top >= 0);
  return isValid ? { left, top, flipPalettes } : undefined;
};
