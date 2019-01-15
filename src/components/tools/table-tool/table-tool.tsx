import * as React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../../base";
import DataTableComponent from "./data-table";
import { DataSet, IDataSet } from "../../../models/data/data-set";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { TableContentModelType } from "../../../models/tools/table/table-content";

import "./table-tool.sass";

interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
  prevContent?: TableContentModelType;
}
​
@inject("stores")
@observer
export default class TableToolComponent extends BaseComponent<IProps, IState> {

  public static getDerivedStateFromProps = (props: IProps, state: IState) => {
    const { model: { content } } = props;
    if (content === state.prevContent) { return null; }
    const tableContent = content as TableContentModelType;
    const newState: IState = { prevContent: tableContent };
    return newState;
  }

  public state: IState = {};

  private dataSet: IDataSet = DataSet.create();

  public render() {
    const { model, readOnly } = this.props;
    return (
      <DataTableComponent
        dataSet={this.dataSet}
      />
    );
  }
}
