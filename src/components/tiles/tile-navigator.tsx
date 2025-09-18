import React, { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import useResizeObserver from "use-resize-observer";
import classNames from "classnames";
import { isEqual } from "lodash";

import { ITileProps } from "./tile-component";
import { BoundingBox, NavigatableTileModelType, NavigatorDirection } from "../../models/tiles/navigatable-tile-model";
import { TileNavigatorContext } from "./hooks/use-tile-navigator-context";

import NavigatorMoveIcon from "../../assets/icons/navigator-move-icon.svg";
import NavigatorScrollIcon from "../../assets/icons/navigator-scroll-icon.svg";

import "./tile-navigator.scss";

interface INavigatorProps {
  renderTile: (tileProps: ITileProps) => JSX.Element;
  showNavigator?: boolean;
  tileProps: ITileProps;
  onNavigatorPan?: (direction: NavigatorDirection) => void;
  tileVisibleBoundingBox?: BoundingBox;
}

const navigatorSize = { width: 90, height: 62 };

/**
 * The TileNavigator component provides a navigational overlay for tiles by displaying a
 * scaled-down version of the tile's content. It allows the user to move tile content around
 * when it is at a zoom level that makes it larger than the tile's content area.
 */
export const TileNavigator = observer(function TileNavigator(props: INavigatorProps) {
  const { onNavigatorPan, renderTile, showNavigator, tileProps, tileVisibleBoundingBox } = props;
  const { model, tileElt } = tileProps;
  const contentModel = model.content as NavigatableTileModelType;
  const { navigatorPosition, zoom } = contentModel;

  const contentAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const placementButtonRef = useRef<HTMLButtonElement>(null);

  const [navigatorBoundingBox, setNavigatorBoundingBox] = useState<BoundingBox|undefined>(undefined);

  const tileSize = tileElt?.getBoundingClientRect() || { width: 10, height: 10 };

  const displayZoomLevel = `${Math.round((zoom) * 100)}%`;
  const [isAnimating, setIsAnimating] = useState(false);

  // Determine the scale factor of tile to navigator size
  const scaleX = navigatorSize.width / tileSize.width;
  const scaleY = navigatorSize.height / tileSize.height;
  const scaleFactor = Math.min(scaleX, scaleY);

  // This is the sizing for the navigator content area after scaling is applied.
  const viewportWidth = navigatorSize.width / scaleFactor;
  const viewportHeight = navigatorSize.height / scaleFactor;

  // Adjust the props for the scaled down version of the tile.
  const renderTileProps = {
    ...tileProps,
    navigatorAllowed: false,
    showAllContent: true,
    readOnly: true,
    overflowVisible: true,
    scale: scaleFactor,
    tileVisibleBoundingBox,
  };

  // Define a clip path for the overlay that allows content within the viewport's bounds
  // to show through without being covered by the semi-transparent overlay.
  const clipPath = useMemo(() => {
    if (!tileVisibleBoundingBox || !navigatorBoundingBox) {
      return "none";
    }
    // Find the locations of the edges of the tile's visible area inside the navigator's visible area.
    const fullWidth = navigatorBoundingBox.se.x - navigatorBoundingBox.nw.x;
    const fullHeight = navigatorBoundingBox.se.y - navigatorBoundingBox.nw.y;

    const x1_percent = Math.round((tileVisibleBoundingBox.nw.x - navigatorBoundingBox.nw.x)/fullWidth * 100);
    const y1_percent = Math.round((tileVisibleBoundingBox.nw.y - navigatorBoundingBox.nw.y)/fullHeight * 100);
    const x2_percent = Math.round((tileVisibleBoundingBox.se.x - navigatorBoundingBox.nw.x)/fullWidth * 100);
    const y2_percent = Math.round((tileVisibleBoundingBox.se.y - navigatorBoundingBox.nw.y)/fullHeight * 100);

    return `polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
      ${x1_percent}% ${y1_percent}%,
      ${x1_percent}% ${y2_percent}%,
      ${x2_percent}% ${y2_percent}%,
      ${x2_percent}% ${y1_percent}%,
      ${x1_percent}% ${y1_percent}%
    )`;
  }, [tileVisibleBoundingBox, navigatorBoundingBox]);

  const tileOverlayStyle: CSSProperties = useMemo(() => ({
    clipPath
  }), [clipPath]);

  const tileContentStyle: CSSProperties = useMemo(() => ({
    height: `${viewportHeight}px`,
    width: `${viewportWidth}px`,
    transform: `scale(${scaleFactor})`,
  }), [scaleFactor, viewportHeight, viewportWidth]);

  const handlePlacementButtonClick = () => {
    setIsAnimating(true);
    containerRef.current?.classList.add("animate");
    containerRef.current?.classList.toggle("top");
    placementButtonRef.current?.classList.toggle("top");
  };

  const handleNavButtonClick = (direction: NavigatorDirection) => {
    if (onNavigatorPan) {
      onNavigatorPan(direction);
    }
  };

  useResizeObserver({ref: tileElt});

  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => {
        const newPosition = navigatorPosition === "top" ? "bottom" : "top";
        contentModel.setNavigatorPosition(newPosition);
        setIsAnimating(false);
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [contentModel, isAnimating, navigatorPosition]);

  const updateNavigatorBoundingBox = (bb: BoundingBox) => {
    if (!isEqual(bb, navigatorBoundingBox)) {
      setNavigatorBoundingBox(bb);
    }
  };

  const containerClasses = classNames("tile-navigator-container", {top: navigatorPosition === "top"});
  const placementButtonClasses = classNames("tile-navigator-placement-button", {top: navigatorPosition === "top"});

  return (
    <div style={{"visibility": showNavigator ? "visible" : "hidden"}} ref={containerRef} className={containerClasses} data-testid="tile-navigator-container">
      <TileNavigatorContext.Provider value={{ reportVisibleBoundingBox: updateNavigatorBoundingBox }}>
        <div className="tile-navigator" data-testid="tile-navigator">
          <div ref={contentAreaRef} className="tile-navigator-content-area">
            <div className="tile-navigator-tile-content" style={tileContentStyle}>
              {renderTile(renderTileProps)}
            </div>
            <div className="tile-navigator-overlay" style={tileOverlayStyle} />
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
      </TileNavigatorContext.Provider>
      {onNavigatorPan &&
        <div className="navigator-panning-buttons" data-testid="navigator-panning-buttons">
          <button
            className="navigator-panning-button up"
            data-testid="navigator-panning-button-up"
            onClick={() => handleNavButtonClick("up")}
            aria-label="Pan up"
          >
            <NavigatorScrollIcon />
          </button>
          <button
            className="navigator-panning-button right"
            data-testid="navigator-panning-button-right"
            onClick={() => handleNavButtonClick("right")}
            aria-label="Pan right"
          >
            <NavigatorScrollIcon />
          </button>
          <button
            className="navigator-panning-button down"
            data-testid="navigator-panning-button-down"
            onClick={() => handleNavButtonClick("down")}
            aria-label="Pan down"
          >
            <NavigatorScrollIcon />
          </button>
          <button
            className="navigator-panning-button left"
            data-testid="navigator-panning-button-left"
            onClick={() => handleNavButtonClick("left")}
            aria-label="Pan left"
          >
            <NavigatorScrollIcon />
          </button>
        </div>}
    </div>
  );
});
