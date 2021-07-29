import React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../../../components/base";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { SizeMe, SizeMeProps } from "react-sizeme";
import "./dataflow-tool.sass";

interface IProps {
  model: ToolTileModelType;
}

interface IState {
}

@inject("stores")
@observer
export default class DataflowToolComponent extends BaseComponent<IProps, IState> {

  public static tileHandlesSelection = true;

  public state: IState = {};

  public render() {
    const classes = `dataflow-tool`;
    return (
      <div className={classes}>
        <SizeMe monitorHeight={true}>
          {({ size }: SizeMeProps) => {
            return (
              <div
                style={{width: size.width || "100%", height: size.height || "100px"}}
              >
                Dataflow placeholder
              </div>
            );
          }}
        </SizeMe>
      </div>
    );
  }
}
