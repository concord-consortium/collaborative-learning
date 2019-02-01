import * as React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../../base";
import DataTableComponent, { LOCAL_ROW_ID } from "./data-table";
import { IMenuItemFlags } from "./table-header-menu";
import { ColumnApi, GridApi, GridReadyEvent } from "ag-grid-community";
import { DataSet, IDataSet, ICase, ICaseCreation } from "../../../models/data/data-set";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { ILinkProperties, IRowLabel, ITableLinkProperties, TableContentModelType
        } from "../../../models/tools/table/table-content";
import { ValueGetterParams, ValueFormatterParams } from "ag-grid-community";
import { JXGCoordPair } from "../../../models/tools/geometry/jxg-changes";
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

  private gridApi?: GridApi;
  private gridColumnApi?: ColumnApi;

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
        indexValueGetter={this.indexValueGetter}
        attrValueFormatter={this.attrValueFormatter}
        defaultPrecision={1}
        itemFlags={itemFlags}
        readOnly={readOnly}
        onGridReady={this.handleGridReady}
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

  private handleGridReady = (gridReadyParams: GridReadyEvent) => {
    this.gridApi = gridReadyParams.api || undefined;
    this.gridColumnApi = gridReadyParams.columnApi || undefined;
  }

  private indexValueGetter = (params: ValueGetterParams) => {
    const content = this.getContent();
    return content.isLinked && (params.data.id !== LOCAL_ROW_ID)
            ? content.getRowLabel(params.node.rowIndex)
            : "";
  }

  private attrValueFormatter = (params: ValueFormatterParams) => {
    if ((params.value == null) || (params.value === "")) return params.value;
    const num = Number(params.value);
    return isFinite(num)
            ? num.toFixed(1).replace(".0", "")
            : params.value;
  }

  private getGeometryContent(geometryId: string) {
    return this.getContent().getGeometryContent(geometryId);
  }

  private getPositionOfPoint(caseId: string): JXGCoordPair {
    const { dataSet } = this.state;
    const attrCount = dataSet.attributes.length;
    const xAttr = attrCount > 0 ? dataSet.attributes[0] : undefined;
    const yAttr = attrCount > 1 ? dataSet.attributes[1] : undefined;
    const x = xAttr ? Number(dataSet.getValue(caseId, xAttr.id)) : 0;
    const y = yAttr ? Number(dataSet.getValue(caseId, yAttr.id)) : 0;
    return [x, y];
  }

  private getTableActionLinks(): ILinkProperties {
    const actionId = uniqueId();
    const linkedGeometries = this.getContent().metadata.linkedGeometries;
    return { id: actionId, tileIds: [...linkedGeometries] };
  }

  private getGeometryActionLinks(links: ILinkProperties, addLabelMap = false): ITableLinkProperties {
    const { dataSet } = this.state;
    let   labels: IRowLabel[] | undefined;
    const content = this.getContent();
    if (addLabelMap && dataSet && content) {
      labels = dataSet.cases.map((aCase, i) => ({ id: aCase.__id__, label: content.getRowLabel(i) }));
    }
    return { id: links.id, tileIds: [this.props.model.id], labels };
  }

  private handleSetAttributeName = (attributeId: string, name: string) => {
    this.getContent().setAttributeName(attributeId, name);
  }

  private handleAddCanonicalCases = (newCases: ICaseCreation[], beforeID?: string | string[]) => {
    const cases = newCases.map(aCase => ({ __id__: uniqueId(), ...cloneDeep(aCase) }));
    const selectedRowIds = this.gridApi && this.gridApi.getSelectedNodes().map(row => row.id);
    const firstSelectedRowId = selectedRowIds && selectedRowIds.length && selectedRowIds[0] || undefined;
    const tableActionLinks = this.getTableActionLinks();
    this.getContent().addCanonicalCases(cases, firstSelectedRowId, tableActionLinks);
    setTimeout(() => {
      const parents = cases.map(aCase => this.getPositionOfPoint(aCase.__id__));
      const props = cases.map(aCase => ({ id: aCase.__id__ }));
      const geomActionLinks = this.getGeometryActionLinks(tableActionLinks, true);
      this.getContent().metadata.linkedGeometries.forEach(id => {
        const geometryContent = this.getGeometryContent(id);
        if (geometryContent) {
          geometryContent.addPoints(undefined, parents, props, geomActionLinks);
        }
      });
    });
  }

  private handleSetCanonicalCaseValues = (caseValues: ICase) => {
    const caseId = caseValues.__id__;
    const tableActionLinks = this.getTableActionLinks();
    this.getContent().setCanonicalCaseValues([caseValues], tableActionLinks);
    setTimeout(() => {
      const geomActionLinks = this.getGeometryActionLinks(tableActionLinks);
      this.getContent().metadata.linkedGeometries.forEach(id => {
        const newPosition = this.getPositionOfPoint(caseId);
        const position = newPosition as JXGCoordPair;
        const geometryContent = this.getGeometryContent(id);
        if (geometryContent) {
          geometryContent.updateObjects(undefined, caseId, { position }, geomActionLinks);
        }
      });
    });
  }

  private handleRemoveCases = (ids: string[]) => {
    const tableActionLinks = this.getTableActionLinks();
    this.getContent().removeCases(ids, tableActionLinks);
    setTimeout(() => {
      const geomActionLinks = this.getGeometryActionLinks(tableActionLinks, true);
      this.getContent().metadata.linkedGeometries.forEach(id => {
        const geometryContent = this.getGeometryContent(id);
        if (geometryContent) {
          geometryContent.removeObjects(undefined, ids, geomActionLinks);
        }
      });
    });
  }
}
