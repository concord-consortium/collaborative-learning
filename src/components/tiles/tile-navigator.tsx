import React, { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import useResizeObserver from "use-resize-observer";
import classNames from "classnames";

import { ITileProps } from "./tile-component";
import { BoundingBox, NavigatableTileModelType, NavigatorDirection } from "../../models/tiles/navigatable-tile-model";

import NavigatorMoveIcon from "../../assets/icons/navigator-move-icon.svg";
import NavigatorScrollIcon from "../../assets/icons/navigator-scroll-icon.svg";

import "./tile-navigator.scss";

interface INavigatorProps {
  objectListPanelWidth: number;
  renderTile: (tileProps: ITileProps) => JSX.Element;
  tileProps: ITileProps;
  onNavigatorPan?: (direction: NavigatorDirection) => void;
}

const navigatorSize = { width: 90, height: 62 };
const defaultSvgDimension = 1500;

const getSvgSize = (contentBoundingBox?: BoundingBox) => {
  if (!contentBoundingBox) {
    return { width: defaultSvgDimension, height: defaultSvgDimension };
  }

  const width = contentBoundingBox.se.x - contentBoundingBox.nw.x + defaultSvgDimension;
  const height = contentBoundingBox.se.y - contentBoundingBox.nw.y + defaultSvgDimension;
  return { width, height };
};

/**
 * The TileNavigator component provides a navigational overlay for tiles by displaying a
 * scaled-down version of the tile's content. It allows the user to move tile content around
 * when it is at a zoom level that makes it larger than the tile's content area.
 */
export const TileNavigator = observer(function TileNavigator(props: INavigatorProps) {
  const { objectListPanelWidth, onNavigatorPan, renderTile, tileProps } = props;
  const { model, tileElt } = tileProps;
  const contentModel = model.content as NavigatableTileModelType;
  const { navigatorPosition, objectsBoundingBox, zoom } = contentModel;
  const svgSize = getSvgSize(objectsBoundingBox);
  const displayZoomLevel = `${Math.round((zoom) * 100)}%`;
  const containerRef = useRef<HTMLDivElement>(null);
  const placementButtonRef = useRef<HTMLButtonElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Adjust the props for the scaled down version of the tile.
  const renderTileProps = {
    ...tileProps,
    navigatorAllowed: false,
    readOnly: true,
    overflowVisible: true,
    svgWidth: svgSize.width,
    svgHeight: svgSize.height,
  };

  // Determine the width and height of the navigator viewport based on a scale factor
  // calculated from the parent tile's dimensions and navigator's dimensions.
  const tileWidth = tileElt?.clientWidth || 0;
  const tileHeight = tileElt?.clientHeight || 0;
  const scaleX = navigatorSize.width / tileWidth;
  const scaleY = navigatorSize.height / tileHeight;
  const scaleFactor = Math.min(scaleX, scaleY);
  const viewportWidth = tileWidth * scaleFactor;
  const viewportHeight = tileHeight * scaleFactor;

  // Define a clip path for the overlay that allows content within the viewport's bounds
  // to show through without being covered by the semi-transparent overlay.
  const clipPath = useMemo(() => {
    const viewportXMargin = 5;
    const viewportYMargin = 7.5;
    const widthRatio = (viewportWidth - viewportXMargin * 2) / navigatorSize.width;
    const heightRatio = viewportHeight / (navigatorSize.height + viewportYMargin * 2);
    const x1_percent = (1 - widthRatio) * 50;
    const y1_percent = (1 - heightRatio) * 50;
    const x2_percent = 100 - x1_percent;
    const y2_percent = 100 - y1_percent;

    return `polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
      ${x1_percent}% ${y1_percent}%,
      ${x1_percent}% ${y2_percent}%,
      ${x2_percent}% ${y2_percent}%,
      ${x2_percent}% ${y1_percent}%,
      ${x1_percent}% ${y1_percent}%
    )`;
  }, [viewportWidth, viewportHeight]);

  const tileOverlayStyle: CSSProperties = useMemo(() => ({
    clipPath
  }), [clipPath]);

  const tileContentStyle: CSSProperties = useMemo(() => ({
    height: `${svgSize.height}px`,
    marginTop: `-${viewportHeight / 2 - scaleFactor}px`,
    marginLeft: `-${viewportWidth / 2 - scaleFactor}px`,
    transform: `scale(${scaleFactor})`,
    width: `${svgSize.width}px`,
  }), [scaleFactor, svgSize.height, svgSize.width, viewportHeight, viewportWidth]);

  const tileViewportStyle: CSSProperties = useMemo(() => ({
    height: `${viewportHeight}px`,
    marginTop: `-${viewportHeight / 2}px`,
    marginLeft: `-${viewportWidth / 2}px`,
    width: `${viewportWidth}px`,
  }), [viewportWidth, viewportHeight]);

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

  const contentFitsViewport = () => {
    const bb = contentModel.objectsBoundingBox;
    if (!bb) return false;

    const heightContained = bb.se.y * contentModel.zoom + contentModel.offsetY <= tileHeight &&
                            bb.nw.y * contentModel.zoom + contentModel.offsetY >= 0;
    const widthContained = bb.se.x * contentModel.zoom + contentModel.offsetX <= tileWidth + objectListPanelWidth &&
                           bb.nw.x * contentModel.zoom + contentModel.offsetX >= 0;

    return heightContained && widthContained;
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

  const containerClasses = classNames("tile-navigator-container", {top: navigatorPosition === "top"});
  const placementButtonClasses = classNames("tile-navigator-placement-button", {top: navigatorPosition === "top"});

  return (
    <div ref={containerRef} className={containerClasses} data-testid="tile-navigator-container">
      <div className="tile-navigator" data-testid="tile-navigator">
        <div className="tile-navigator-content-area">
          <div className="tile-navigator-tile-content" style={tileContentStyle}>
            {renderTile(renderTileProps)}
          </div>
          <div className="tile-navigator-overlay" style={tileOverlayStyle} />
          <div className="tile-navigator-viewport" style={tileViewportStyle} />
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
      {!contentFitsViewport() && onNavigatorPan &&
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
