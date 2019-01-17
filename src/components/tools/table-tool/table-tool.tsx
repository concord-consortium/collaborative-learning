import * as React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../../base";
import DataTableComponent from "./data-table";
import { IMenuItemFlags } from "./table-header-menu";
import { DataSet, IDataSet, ICase, ICaseCreation } from "../../../models/data/data-set";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { TableContentModelType } from "../../../models/tools/table/table-content";
import { uniqueId } from "../../../utilities/js-utils";
import { cloneDeep } from "lodash";

import "./table-tool.sass";

interface IProps {
  model: ToolTileModelType;
  readOnly?: boolean;
}

// all properties are optional
interface IPartialState {
  dataSet?: IDataSet;
  syncedChanges?: number;
  prevContent?: TableContentModelType;
  autoSizeColumns?: boolean;
}
​
// some properties are required
interface IState extends IPartialState {
  dataSet: IDataSet;
  syncedChanges: number;
}

@inject("stores")
@observer
export default class TableToolComponent extends BaseComponent<IProps, IState> {

  public static tileHandlesSelection = true;

  public static getDerivedStateFromProps = (props: IProps, state: IState) => {
    const { model: { content } } = props;
    const tableContent = content as TableContentModelType;
    const newState: IPartialState = {};
    if (content !== state.prevContent) {
      newState.prevContent = tableContent;
    }
    if (state.syncedChanges < tableContent.changes.length) {
      tableContent.applyChanges(state.dataSet, state.syncedChanges);
      newState.syncedChanges = tableContent.changes.length;
    }
    return newState;
  }

  public state: IState = {
                  dataSet: DataSet.create(),
                  syncedChanges: 0
                };

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
        dataSet={this.state.dataSet}
        changeCount={this.state.syncedChanges}
        autoSizeColumns={this.getContent().isImported}
        itemFlags={itemFlags}
        readOnly={readOnly}
        onSetAttributeName={this.handleSetAttributeName}
        onAddCanonicalCases={this.handleAddCanonicalCases}
        onSetCanonicalCaseValues={this.handleSetCanonicalCaseValues}
        onRemoveCases={this.handleRemoveCases}
      />
    );
  }

  private getContent() {
    return this.props.model.content as TableContentModelType;
  }

  private handleSetAttributeName = (attributeId: string, name: string) => {
    this.getContent().setAttributeName(attributeId, name);
  }

  private handleAddCanonicalCases = (newCases: ICaseCreation[], beforeID?: string | string[]) => {
    const cases = newCases.map(aCase => ({ __id__: uniqueId(), ...cloneDeep(aCase) }));
    this.getContent().addCanonicalCases(cases, beforeID);
  }

  private handleSetCanonicalCaseValues = (caseValues: ICase) => {
    this.getContent().setCanonicalCaseValues(caseValues);
  }

  private handleRemoveCases = (ids: string[]) => {
    this.getContent().removeCases(ids);
  }
}
