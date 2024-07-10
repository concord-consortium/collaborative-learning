import classNames from "classnames";
import React from "react";
import { SizeMe, SizeMeProps } from "react-sizeme";
import { defaultTileTitleFont } from "../../constants";
import { useMeasureText } from "../hooks/use-measure-text";
import { GeometryContentComponent, IGeometryContentProps } from "./geometry-content";

interface IProps extends IGeometryContentProps{
  readOnly?: boolean;
}
export const GeometryContentWrapper: React.FC<IProps> = (props) => {
  const measureLabelText = useMeasureText(defaultTileTitleFont);
  return (
    <div className={classNames("geometry-wrapper", { "read-only": props.readOnly })}>
      <SizeMe monitorHeight={true}>
        {({ size }: SizeMeProps) => {
          return (
            <div className="geometry-size-me">
              <GeometryContentComponent size={size} {...props} measureText={measureLabelText} />
            </div>
          );
        }}
      </SizeMe>
    </div>
  );
};
