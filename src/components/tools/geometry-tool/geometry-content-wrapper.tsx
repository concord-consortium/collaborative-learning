import classNames from "classnames";
import React from "react";
import { SizeMe, SizeMeProps } from "react-sizeme";
import { GeometryContentComponent, IGeometryContentProps } from "./geometry-content";

interface IProps extends IGeometryContentProps{
  readOnly?: boolean;
}
export const GeometryContentWrapper: React.FC<IProps> = (props) => {
  return (
    <div className={classNames("geometry-wrapper", { "read-only": props.readOnly })}>
      <SizeMe monitorHeight={true}>
        {({ size }: SizeMeProps) => {
          return (
            <div className="geometry-size-me">
              <GeometryContentComponent size={size} {...props} />
            </div>
          );
        }}
      </SizeMe>
    </div>
  );
};
