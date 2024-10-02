import React, { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import useResizeObserver from "use-resize-observer";
import classNames from "classnames";

import { ITileProps } from "./tile-component";
import { NavigatableTileModelType } from "../../models/tiles/navigatable-tile-model";

import NavigatorMoveIcon from "../../assets/icons/navigator-move-icon.svg";

import "./tile-navigator.scss";

interface INavigatorProps {
  renderTile: (tileProps: ITileProps) => JSX.Element;
  tileProps: ITileProps;
}

const navigatorSize = { width: 90, height: 62 };

/**
 * The TileNavigator component provides a navigational overlay for tiles by displaying a
 * scaled-down version of the tile's content. It allows the user to move tile content around
 * when it is at a zoom level that makes it larger than the tile's content area.
 */
export const TileNavigator = observer(function TileNavigator({renderTile, tileProps}: INavigatorProps) {
  const { height=0, model, tileElt } = tileProps;
  // Set `readyOnly` to true and `navigatorAllowed` to false so the tile content can't be interacted with
  // in the navigator and the navigator can't lead to infinite instances of itself.
  const safeProps = { ...tileProps, readOnly: true, navigatorAllowed: false };
  const tileWidth = tileElt?.clientWidth || 0;
  const tileHeight = tileElt?.clientHeight || 0;
  const scaleX = navigatorSize.width / tileWidth;
  const scaleY = navigatorSize.height / height;
  const scaleFactor = Math.min(scaleX, scaleY);
  // Calculate the percent value needed to center the scaled tile content via translate() CSS transform
  const translateValue = ((1 - scaleFactor) * .5) * 100;
  const zoomLevel = "zoom" in model.content ? model.content.zoom : undefined;
  const displayZoomLevel = typeof zoomLevel === "number" ? `${Math.round(zoomLevel * 100)}%` : "";
  const navigatorPosition = (model.content as NavigatableTileModelType).navigatorPosition;
  const containerRef = useRef<HTMLDivElement>(null);
  const placementButtonRef = useRef<HTMLButtonElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useResizeObserver({ref: tileElt});

  const tileContentStyle: CSSProperties = useMemo(() => {
    return {
      width: `${tileWidth}px`,
      height: `${tileHeight}px`,
      transform: `translate(${translateValue}%, ${translateValue}%) scale(${scaleFactor})`
    };
  }, [scaleFactor, tileHeight, tileWidth, translateValue]);

  useEffect(() => {
    if (isAnimating) {
      // Allow the animation to complete before updating the model
      const timer = setTimeout(() => {
        const newPosition = navigatorPosition === "top" ? "bottom" : "top";
        (model.content as NavigatableTileModelType).setNavigatorPosition(newPosition);
        setIsAnimating(false);
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [isAnimating, model.content, navigatorPosition]);

  const handlePlacementButtonClick = () => {
    setIsAnimating(true);
    containerRef.current?.classList.add("animate");
    containerRef.current?.classList.toggle("top");
    placementButtonRef.current?.classList.toggle("top");
  };

  const containerClasses = classNames("tile-navigator-container", {top: navigatorPosition === "top"});
  const placementButtonClasses = classNames("tile-navigator-placement-button", {top: navigatorPosition === "top"});

  return (
    <div ref={containerRef} className={containerClasses} data-testid="tile-navigator-container">
      <div className="tile-navigator" data-testid="tile-navigator">
        <div className="tile-navigator-content-area">
          <div className="tile-navigator-tile-content" style={tileContentStyle}>
            {renderTile(safeProps)}
          </div>
        </div>
        <div className="zoom-level">
          {displayZoomLevel}
        </div>
        <button
          ref={placementButtonRef}
          className={placementButtonClasses}
          data-testid="tile-navigator-placement-button"
          onClick={handlePlacementButtonClick}
          aria-label={`Move navigator panel ${navigatorPosition === "top" ? "down" : "up"}`}
        >
          <NavigatorMoveIcon />
        </button>
      </div>
    </div>
  );
});
