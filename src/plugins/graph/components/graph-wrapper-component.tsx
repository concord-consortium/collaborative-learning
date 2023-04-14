import React from "react";
import classNames from "classnames";
import { SizeMe, SizeMeProps } from "react-sizeme";
import { GraphComponent } from "./graph-component";
import { ITileProps } from 'src/components/tiles/tile-component';

export const GraphWrapperComponent: React.FC<ITileProps> = (props) => {
  const tile = props.model;
  // TODO: Figure out how to get/set the apropriate height.
  const height = "312px";
  return (
    <div className={classNames("graph-wrapper", { "read-only": props.readOnly })}>
      <SizeMe monitorHeight={true}>
        {({ size }: SizeMeProps) => {
          return (
            <div className="graph-size-me" style={{height}}>
              <GraphComponent size={size} tile={tile} />
            </div>
          );
        }}
      </SizeMe>
    </div>
  );
};
