import classNames from "classnames";
import React from "react";
import { SizeMe, SizeMeProps } from "react-sizeme";
import { GeometryContentComponent, IGeometryContentProps } from "./geometry-content";

interface IProps extends IGeometryContentProps{
  readOnly?: boolean;
}
export const GeometryContentWrapper: React.FC<IProps> = ({
  readOnly, ...others
}) => {
  return (
    <div className={classNames("geometry-wrapper", { "read-only": readOnly })}>
      <SizeMe monitorHeight={true}>
        {({ size }: SizeMeProps) => {
          return (
            <div className="geometry-size-me">
              <GeometryContentComponent size={size} {...others} />
            </div>
          );
        }}
      </SizeMe>
    </div>
  );
};
