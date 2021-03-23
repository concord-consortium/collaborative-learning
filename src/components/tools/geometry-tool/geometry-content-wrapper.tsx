import classNames from "classnames";
import React from "react";
import { SizeMe, SizeMeProps } from "react-sizeme";
import { useMeasureText } from "../hooks/use-measure-text";
import { GeometryContentComponent, IGeometryContentProps } from "./geometry-content";

interface IProps extends IGeometryContentProps{
  isLinkButtonEnabled: boolean;
  readOnly?: boolean;
}
export const GeometryContentWrapper: React.FC<IProps> = (props) => {
  const measureLabelText = useMeasureText("italic 14px Lato, sans-serif");
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
