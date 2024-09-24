import React, { CSSProperties, useMemo, useRef } from "react";
import { observer } from "mobx-react-lite";
import useResizeObserver from "use-resize-observer";

import { ITileProps } from "./tile-component";

import NavigatorMoveIcon from "../../assets/icons/navigator-move-icon.svg";

import "./tile-navigator.scss";

interface INavigatorProps {
  children: React.ReactElement<ITileProps>;
}

const navigatorSize = { width: 90, height: 62 };

export const TileNavigator = observer(function TileNavigator({children}: INavigatorProps) {
  const { height=0, model, tileElt } = children.props;
  const tileWidth = tileElt?.clientWidth || 0;
  const tileHeight = tileElt?.clientHeight || 0;
  const scaleX = navigatorSize.width / tileWidth;
  const scaleY = navigatorSize.height / height;
  const scaleFactor = Math.min(scaleX, scaleY);
  const translate = ((1 - scaleFactor) * .5) * 100;
  const zoomLevel = "zoom" in model.content ? model.content.zoom : undefined;
  const displayZoomLevel = typeof zoomLevel === "number" ? `${Math.round(zoomLevel * 100)}%` : "";
  const containerRef = useRef<HTMLDivElement>(null);
  const placementButtonRef = useRef<HTMLButtonElement>(null);

  useResizeObserver({ref: tileElt});

  const tileContentStyle: CSSProperties = useMemo(() => {
    return {
      width: `${tileWidth}px`,
      height: `${tileHeight}px`,
      transform: `translate(${translate}%, ${translate}%) scale(${scaleFactor})`
    };
  }, [scaleFactor, tileHeight, tileWidth, translate]);

  const handlePlacementButtonClick = () => {
    containerRef.current?.classList.add("animate");
    containerRef.current?.classList.toggle("top");
    placementButtonRef.current?.classList.toggle("top");
  };

  return (
    <div ref={containerRef} className="tile-navigator-container" data-testid="tile-navigator-container">
      <div className="tile-navigator" data-testid="tile-navigator">
        <div className="tile-navigator-content-area">
          <div className="tile-navigator-tile-content" style={tileContentStyle}>
            {React.cloneElement(children, { readOnly: true, navigatorAllowed: false })}
          </div>
        </div>
        <div className="zoom-level">
          {displayZoomLevel}
        </div>
        <button
          ref={placementButtonRef}
          className="tile-navigator-placement-button"
          data-testid="tile-navigator-placement-button"
          onClick={handlePlacementButtonClick}
        >
          <NavigatorMoveIcon />
        </button>
      </div>
    </div>
  );
});
