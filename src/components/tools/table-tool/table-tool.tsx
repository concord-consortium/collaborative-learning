import * as React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../../base";
import DataTableComponent from "./data-table";
import { IMenuItemFlags } from "./table-header-menu";
import { DataSet, IDataSet } from "../../../models/data/data-set";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { TableContentModelType } from "../../../models/tools/table/table-content";
import { cloneDeep } from "lodash";
import * as uuid from "uuid/v4";

import "./table-tool.sass";

interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
}

interface IState {
  prevContent?: TableContentModelType;
  changeCount?: number;
  autoSizeColumns?: boolean;
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

  public state: IState = { changeCount: 0 };

  private dataSet: IDataSet = DataSet.create();
  private didImport: boolean = false;

  public componentDidMount() {
    const columns = this.getContent().columns;
    let   maxCount = 0;
    if (columns && columns.length) {
      columns.forEach((col: any) => {
        if (col && col.name) {
          this.dataSet.addAttributeWithID({
                        id: uuid(),
                        name: col.name,
                        values: cloneDeep(col.values)
                      });
          if (col.values.length > maxCount) {
            maxCount = col.values.length;
          }
        }
      });
      for (let i = 0; i < maxCount; ++i) {
        const aCase: any = { __id__: uuid() };
        columns.forEach((col: any) => {
          if (col && col.name && i < col.values.length) {
            aCase[col.name] = col.values[i];
          }
        });
        this.dataSet.addCasesWithIDs([aCase]);
      }
      this.didImport = true;
      this.getContent().clearImportSnapshot();
      this.setState({ changeCount: this.state.changeCount! + 1 });
    }
    else {
      // default initialization for demo purposes
      this.dataSet.addAttributeWithID({ id: uuid(), name: "x" });
      this.dataSet.addAttributeWithID({ id: uuid(), name: "y" });
      this.setState({ changeCount: this.state.changeCount! + 1 });
    }
  }

  public render() {
    const { readOnly } = this.props;
    const itemFlags: IMenuItemFlags = {
            addAttribute: false,
            addCase: true,
            addRemoveDivider: false,
            renameAttribute: true,
            removeAttribute: false,
            removeCases: true
          };
    return (
      <DataTableComponent
        dataSet={this.dataSet}
        changeCount={this.state.changeCount!}
        autoSizeColumns={this.didImport}
        itemFlags={itemFlags}
        readOnly={readOnly}
      />
    );
  }

  private getContent() {
    return this.props.model.content as TableContentModelType;
  }
}
