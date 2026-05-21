import classNames from "classnames";
import React from "react";
import { useResizeDetector } from "react-resize-detector";
import { defaultTileTitleFont } from "../../constants";
import { useMeasureText } from "../hooks/use-measure-text";
import { useTileNavigatorContext } from "../hooks/use-tile-navigator-context";
import { GeometryContentComponent, IGeometryContentProps } from "./geometry-content";

interface IProps extends IGeometryContentProps {
  readOnly?: boolean;
  showAllContent: boolean;
}
export const GeometryContentWrapper: React.FC<IProps> = (props) => {
  // Pass this context as a prop to the GeometryContentComponent
  // Since it is a class component and can't read two contexts
  const tileNavigatorContext = useTileNavigatorContext();
  const measureLabelText = useMeasureText(defaultTileTitleFont);
  const { width, height, ref } = useResizeDetector<HTMLDivElement>();
  const size = { width: width ?? null, height: height ?? null };

  return (
    <div className={classNames("geometry-wrapper", { "read-only": props.readOnly })}>
      <div className="geometry-size-me" ref={ref}>
        <GeometryContentComponent size={size} {...props}
          measureText={measureLabelText} tileNavigatorContext={tileNavigatorContext} />
      </div>
    </div>
  );
};
