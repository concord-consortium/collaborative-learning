import * as React from "react";
import { onSnapshot, getSnapshot, types } from "mobx-state-tree";
import { ISerializedActionCall } from "mobx-state-tree/dist/middlewares/on-action";
import { IMenuItemFlags, TableHeaderMenu } from "./table-header-menu";
import { addAttributeToDataSet, addCanonicalCasesToDataSet,
         ICase, ICaseCreation, IDataSet } from "../../../models/data/data-set";
import { IAttribute, IValueType } from "../../../models/data/attribute";
import { emitTableEvent } from "../../../models/tools/table/table-events";
import { AgGridReact } from "ag-grid-react";
import { CellEditingStartedEvent, CellEditingStoppedEvent, ColDef, Column,
          ColumnApi, GridApi, GridCellDef, GridReadyEvent, RowNode, SortChangedEvent,
          TabToNextCellParams, ValueGetterParams, ValueFormatterParams, ValueSetterParams } from "ag-grid-community";
import { RowDataTransaction } from "ag-grid-community/dist/lib/rowModels/clientSide/clientSideRowModel";
import { assign, cloneDeep, findIndex, isEqual, sortedIndexBy } from "lodash";
import "ag-grid-community/dist/styles/ag-grid.css";
import "ag-grid-community/dist/styles/ag-theme-fresh.css";
import "./data-table.css";

export const TableComponentSortModelData = types.model("TableComponentSortModelData", {
  colId: types.string,
  sort: types.string
});
export type ITableSortModelData = typeof TableComponentSortModelData.Type;

export const TableComponentData = types.model("TableComponentData",
  {
    sortModel: types.array(TableComponentSortModelData)
  })
  .actions(self => ({
    setSortModel(sortModel: any) {
      self.sortModel = sortModel;
    }
  }));
export type ITableComponentData = typeof TableComponentData.Type;

interface IPos {
  left: number;
  top: number;
}

interface IProps {
  dataSet?: IDataSet;
  changeCount: number;
  readOnly?: boolean;
  autoSizeColumns?: boolean;
  itemFlags?: IMenuItemFlags;
  tableComponentData?: ITableComponentData|null;
  onSetAttributeName?: (colId: string, name: string) => void;
  onAddCanonicalCases?: (cases: ICaseCreation[], beforeID?: string | string[]) => void;
  onSetCanonicalCaseValues?: (aCase: ICase) => void;
  onRemoveCases?: (ids: string[]) => void;
  onSampleData?: (name: string) => void;
}

interface IState {
  rowSelection: string;
  addAttributeButtonPos: IPos|null;
}

const LOCAL_ROW_ID = "__local__";
const LOCAL_ROW_STYLE = {backgroundColor: "#cfc"};

interface IRowStyleParams {
  data: {
    id: string;
  };
}

interface IGridRow {
  id: string;
}

interface IGridCellDef {
  rowIndex?: number;
  column?: Column;
  floating?: string;
}

interface ICellIDs {
  colID?: string;
  rowID?: string;
  floating?: string;
}

// default widths for sample data sets
const defaultWidth = 80;

export default class DataTableComponent extends React.Component<IProps, IState> {

  private gridApi?: GridApi | null;
  private gridColumnApi?: ColumnApi | null;

  private gridColumnDefs: ColDef[] = [];
  private gridRowData: Array<IGridRow | undefined> = [];
  private localRow: ICaseCreation = {};
  private checkForEnterAfterCellEditingStopped = false;
  private checkForEnterAfterLocalDataEntry = false;

  private prevEditCell?: GridCellDef;
  private editCellEvent?: CellEditingStartedEvent;
  private savedFocusedCell?: ICellIDs;
  private savedEditCell?: ICellIDs;
  private savedEditContent?: string;

  private gridElement: HTMLDivElement|null;
  private headerElement: HTMLDivElement|null;

  private sortedRowNodes: RowNode[];

  // we don't need to refresh for changes the table already knows about
  private localChanges: ICaseCreation[] = [];

  constructor(props: IProps) {
    super(props);

    const { dataSet } = this.props;
    this.attachDataSet(dataSet);

    this.state = {
      rowSelection: "multiple",
      addAttributeButtonPos: null
    };

    this.gridElement = null;
    this.headerElement = null;

    this.updateGridState(dataSet);

    this.sortedRowNodes = [];
  }

  public onGridReady = (gridReadyParams: GridReadyEvent) => {
    this.gridApi = gridReadyParams.api;
    this.gridColumnApi = gridReadyParams.columnApi;

    if (this.gridColumnApi && this.props.autoSizeColumns) {
      const allColumnIds: string[] = [];
      this.gridColumnApi.getAllColumns().forEach(column => {
        allColumnIds.push((column as any).colId);
      });
      this.gridColumnApi.autoSizeColumns(allColumnIds);
    }

    const {tableComponentData: caseTableComponentData} = this.props;
    if (caseTableComponentData && this.gridApi) {
      this.gridApi.setSortModel(getSnapshot(caseTableComponentData.sortModel));

      onSnapshot(caseTableComponentData, (snapshot: ITableComponentData) => {
        if (this.gridApi) {
          this.gridApi.setSortModel(snapshot.sortModel);
        }
      });
    }
  }

  public getRowNodeId = (data: { id: string }) => data.id;

  public getRowIndexColumnDef(): ColDef {
    const { itemFlags, readOnly } = this.props;
    return ({
      headerName: "",
      headerComponentFramework: TableHeaderMenu,
      headerComponentParams: {
        api: this.gridApi,
        dataSet: this.props.dataSet,
        readOnly,
        itemFlags,
        onNewAttribute: (name: string) => {
          const { dataSet } = this.props;
          dataSet && addAttributeToDataSet(dataSet, { name });
        },
        onRenameAttribute: (id: string, name: string) => {
          if (this.props.onSetAttributeName) {
            this.props.onSetAttributeName(id, name);
          }
          else {
            const { dataSet } = this.props;
            dataSet && dataSet.setAttributeName(id, name);
          }
        },
        onNewCase: () => {
          const newCases = [{}];
          if (this.props.onAddCanonicalCases) {
            this.props.onAddCanonicalCases(newCases);
          }
          else {
            const { dataSet } = this.props;
            dataSet && addCanonicalCasesToDataSet(dataSet, newCases);
          }
        },
        onRemoveAttribute: (id: string) => {
          const { dataSet } = this.props;
          dataSet && dataSet.removeAttribute(id);
        },
        onRemoveCases: (ids: string[]) => {
          if (this.props.onRemoveCases) {
            this.props.onRemoveCases(ids);
          }
          else {
            const { dataSet } = this.props;
            dataSet && dataSet.removeCases(ids);
          }
        }
      },
      headerClass: "cdp-column-header cdp-case-index-header",
      cellClass: "cdp-case-index-cell",
      colId: "__CASE_INDEX__",
      width: 50,
      pinned: "left",
      lockPosition: true,
      valueGetter: (params) => {
        return "";
        // return params.node.rowIndex + 1; // caseIndex
      },
      suppressMovable: true,
      resizable: false,
      suppressNavigable: true
    });
  }

  public addLocalCaseToTable() {
    const {dataSet} = this.props;
    if (!dataSet) return;

    // clear local case before adding so that the update caused by addCanonicalCasesToDataSet()
    // shows an empty row for the local case
    const newCases: ICaseCreation[] = [cloneDeep(this.localRow)];
    this.localRow = {};
    if (this.props.onAddCanonicalCases) {
      this.props.onAddCanonicalCases(newCases);
    }
    else {
      addCanonicalCasesToDataSet(dataSet, newCases);
    }
    this.updateGridState(this.props.dataSet);
  }

  public getAttributeColumnDef(attribute: IAttribute): ColDef {
    const { readOnly } = this.props;
    return ({
      headerClass: "cdp-column-header cdp-attr-column-header",
      cellClass: "cdp-row-data-cell",
      headerName: attribute.name,
      field: attribute.name,
      tooltipField: attribute.name,
      colId: attribute.id,
      editable: !readOnly,
      width: defaultWidth,
      resizable: true,
      lockPosition: true,
      valueGetter: (params: ValueGetterParams) => {
        const { dataSet } = this.props;
        const caseID = params.node.id;
        const attrID = params.colDef.colId;
        if (params.data.id === LOCAL_ROW_ID) {
          return attrID ? this.localRow[attrID] : undefined;
        }
        let value = dataSet && attrID ? dataSet.getValue(caseID, attrID) : undefined;
        // valueGetter includes in-flight changes
        this.localChanges.forEach((change) => {
          if ((change.__id__ === caseID) && (attrID != null)) {
            if (change[attrID] != null) {
              value = change[attrID] as IValueType;
            }
          }
        });
        return value;
      },
      valueFormatter: (params: ValueFormatterParams) => {
        const colName = params.colDef.field || params.colDef.headerName || "";
        const colPlaces: { [key: string]: number } = {
                day: 0,
                distance: 1,
                speed: 2
              };
        const places = colPlaces[colName];
        return (places != null) && (typeof params.value === "number")
                  ? params.value.toFixed(places)
                  : params.value;
      },
      valueSetter: (params: ValueSetterParams) => {
        const { dataSet } = this.props;
        if (!dataSet || (params.newValue === params.oldValue)) { return false; }
        if (params.data.id === LOCAL_ROW_ID) {
          if (params.colDef.colId) {
            this.localRow[params.colDef.colId] = params.newValue;
            this.checkForEnterAfterLocalDataEntry = true;
          }
          return !!params.colDef.colId;
        }
        const str = (params.newValue != null) && (typeof params.newValue === "string")
                      ? params.newValue.trim() : undefined;
        const num = str ? Number(str) : undefined;
        const attrID = attribute.id;
        const caseID = dataSet && dataSet.cases[params.node.rowIndex].__id__;
        const caseValues = {
                __id__: caseID,
                [attrID]: (num != null) && isFinite(num) ? num : str
              };
        if (caseValues[attrID] === params.oldValue) { return false; }
        // track in-flight changes
        this.localChanges.push(cloneDeep(caseValues));
        if (this.props.onSetCanonicalCaseValues) {
          this.props.onSetCanonicalCaseValues(caseValues);
        }
        else {
          dataSet.setCanonicalCaseValues([caseValues]);
        }
        return true;
      },
      // tslint:disable-next-line:no-any
      comparator(valueA: any, valueB: any, nodeA: RowNode, nodeB: RowNode, descending: boolean) {
        const floatA = parseFloat(valueA);
        const floatB = parseFloat(valueB);
        if (isNaN(floatA) || isNaN(floatB)) {
          if (valueA < valueB) { return -1; }
          if (valueA > valueB) { return 1; }
          return 0;
        }
        return floatA - floatB;
      }
    });
  }

  public getColumnDefs(dataSet: IDataSet) {
    let cols: ColDef[];
    cols = dataSet.attributes.map((attr) =>
      this.getAttributeColumnDef(attr)
    );
    cols.unshift(this.getRowIndexColumnDef());
    return cols;
  }

  public getRowData(dataSet?: IDataSet): IGridRow[] {
    const rows = [];
    if (dataSet) {
      for (const aCase of dataSet.cases) {
        // just need the ID; everything else comes from valueGetter
        rows.push({ id: aCase.__id__ });
      }
    }
    if (!this.props.readOnly) {
      rows.push({id: LOCAL_ROW_ID});
    }
    return rows;
  }

  public updateGridState(dataSet?: IDataSet) {
    this.updateGridColState(dataSet);
    this.updateGridRowState(dataSet);
  }

  public updateGridColState(dataSet?: IDataSet) {
    this.gridColumnDefs = dataSet ? this.getColumnDefs(dataSet) : [];
    const columnApi = this.gridColumnApi;
    if (!columnApi) return;

    // recent versions of ag-grid require manual column header synchronization
    // cf. https://github.com/ag-grid/ag-grid/issues/2771#issuecomment-441576761

    this.gridColumnDefs.forEach(newColDef => {
      const colDef = columnApi.getColumn(newColDef.colId).getColDef();
      if (colDef.headerName !== newColDef.headerName) {
        colDef.headerName = newColDef.headerName;
      }
    });
    if (this.gridApi) {
      this.gridApi.setColumnDefs(this.gridColumnDefs);
      this.gridApi.refreshHeader();
    }
  }

  public updateGridRowState(dataSet?: IDataSet) {
    this.gridRowData = this.getRowData(dataSet);
    if (this.gridApi) {
      this.gridApi.setRowData(this.gridRowData);
      setTimeout(() => this.ensureFocus(dataSet));
    }
  }

  public ensureFocus = (dataSet?: IDataSet) => {
    if (!this.gridApi) return;
    const currentCell = this.gridApi.getFocusedCell();
    const lastRowIndex = this.gridApi.paginationGetRowCount() - 1;
    if (!currentCell && (lastRowIndex >= 0) && dataSet && (dataSet.attributes.length > 0)) {
      const firstColId = dataSet.attributes[0].id;
      this.gridApi.setFocusedCell(lastRowIndex, firstColId);
    }
  }

  public startEditingSameColumnOfNextRow = () => {
    if (this.gridApi && this.prevEditCell) {
      const rowIndex = this.prevEditCell.rowIndex + 1;
      const colKey = this.prevEditCell.column.getColId();
      this.gridApi.setFocusedCell( rowIndex, colKey);
      this.gridApi.startEditingCell({ rowIndex, colKey });
    }
  }

  public startEditingFirstColumnOfNextRow = () => {
    if (this.gridApi && this.gridColumnApi && this.prevEditCell) {
      const rowIndex = this.prevEditCell.rowIndex + 1;
      const columns = this.gridColumnApi.getAllDisplayedColumns();
      const colKey = columns[1].getColId();
      this.gridApi.setFocusedCell( rowIndex, colKey);
      this.gridApi.startEditingCell({ rowIndex, colKey });
    }
  }

  public getRowStyle(params: IRowStyleParams) {
    if (params.data.id === LOCAL_ROW_ID) {
      return LOCAL_ROW_STYLE;
    }
    return undefined;
  }

  public isIgnorableChange(action: ISerializedActionCall) {
    switch (action.name) {
      case "setCaseValues":
      case "setCanonicalCaseValues": {
        const cases = action.args && action.args[0];
        if (!cases) { return true; }
        let ignoredChanges = 0;
        cases.forEach((aCase: ICaseCreation) => {
          const index = findIndex(this.localChanges, (change) => isEqual(assign({}, aCase, change), aCase));
          if (index >= 0) {
            // ignoring local change
            this.localChanges.splice(index, 1);
            ++ignoredChanges;
          }
        });
        return ignoredChanges >= cases.length;
      }
      case "addActionListener":
      case "removeActionListener":
        return true;
      default:
        return false;
    }
  }

  public getCellIDsFromGridCell(cell: IGridCellDef): ICellIDs | undefined {
    if (!cell) { return; }
    const { rowIndex, column, floating } = cell;
    const attrID = column && column.getColId();
    const aCase = rowIndex != null ? this.gridRowData[rowIndex] : undefined;
    const caseID = aCase && aCase.id;
    return attrID && caseID ? { colID: attrID, rowID: caseID, floating } : undefined;
  }

  public getGridCellFromCellIDs(cellIDs: ICellIDs): IGridCellDef | undefined {
    if (!this.gridApi || !this.gridColumnApi || !cellIDs || !cellIDs.rowID) return;
    const rowNode = this.gridApi.getRowNode(cellIDs.rowID);
    return rowNode && {
      rowIndex: rowNode.rowIndex,
      column: this.gridColumnApi.getColumn(cellIDs.colID)
    };
  }

  public saveCellEditState() {
    if (!this.gridApi) return;
    const focusedCell = this.gridApi.getFocusedCell();
    const rowIndex = this.editCellEvent && this.editCellEvent.rowIndex;
    const column = this.editCellEvent && this.editCellEvent.column;
    this.savedFocusedCell = this.getCellIDsFromGridCell(focusedCell);
    this.savedEditCell = this.getCellIDsFromGridCell({ rowIndex, column });
    if (this.editCellEvent) {
      const cellInputElts = document.getElementsByClassName("ag-cell-edit-input");
      const cellInputElt: HTMLInputElement = cellInputElts && (cellInputElts[0] as HTMLInputElement);
      this.savedEditContent = cellInputElt ? cellInputElt.value : undefined;
    }
    this.gridApi.stopEditing(true);
    this.gridApi.clearFocusedCell();
  }

  public restoreCellEditState() {
    if (!this.gridApi) return;
    if (this.savedFocusedCell) {
      const focusedGridCell = this.getGridCellFromCellIDs(this.savedFocusedCell);
      if (focusedGridCell) {
        const { rowIndex, column, floating } = focusedGridCell;
        if ((rowIndex != null) && column) {
          this.gridApi.setFocusedCell(rowIndex, column, floating);
        }
      }
      this.savedFocusedCell = undefined;
    }
    if (this.savedEditCell) {
      const editRowColumn = this.getGridCellFromCellIDs(this.savedEditCell);
      if (editRowColumn) {
        const { rowIndex, column } = editRowColumn;
        if ((rowIndex != null) && column) {
          this.gridApi.startEditingCell({ rowIndex, colKey: column });
        }
      }
      this.savedEditCell = undefined;
    }
    if (this.savedEditContent != null) {
      const cellInputElts = document.getElementsByClassName("ag-cell-edit-input");
      const cellInputElt: HTMLInputElement = cellInputElts && (cellInputElts[0] as HTMLInputElement);
      if (cellInputElt) {
        cellInputElt.value = this.savedEditContent;
      }
      this.savedEditContent = undefined;
    }
  }

  public handleAction = (action: ISerializedActionCall) => {
    const { dataSet } = this.props;
    if (!this.isIgnorableChange(action)) {
      let columnDefs = null;
      let rowTransaction: RowDataTransaction | null = null;
      let shouldSaveEditState = true;
      const attributeChanged = () => {
        if (dataSet) {
          columnDefs = this.getColumnDefs(dataSet);
          setTimeout(() => this.handleSetAddAttributePos(), 1);
        }
      };
      switch (action.name) {
        case "@APPLY_SNAPSHOT":
          if (/^\/attributes\//.test(action.path || "")) {
            attributeChanged();
          }
          break;
        case "addAttributeWithID":
        case "removeAttribute":
        case "setAttributeName":
          attributeChanged();
          break;
        case "addCasesWithIDs":
        case "addCanonicalCasesWithIDs":
        case "setCaseValues":
        case "setCanonicalCaseValues":
          if (action.args && action.args.length) {
            const cases = action.args[0].map((aCase: ICase) => ({ id: aCase.__id__ }));
            if (action.name.substr(0, 3) === "add") {
              interface IRowData { id: string; }
              const addIndex = sortedIndexBy(this.gridRowData, cases[0], (value: IRowData) => value.id);
              rowTransaction = { add: cases, addIndex: Math.min(addIndex, this.gridRowData.length - 1) };
            }
            else {
              rowTransaction = { update: cases };
              // don't need to save/restore cell edit if only changing existing values
              shouldSaveEditState = false;
            }
          }
          break;
        case "removeCases":
          if (action.args && action.args.length) {
            const casesToRemove = action.args[0].map((id: string) => ({ id }));
            rowTransaction = { remove: casesToRemove };
          }
          break;
        default:
      }
      if (shouldSaveEditState) {
        this.saveCellEditState();
      }
      if (columnDefs && this.gridApi) {
        this.gridApi.setColumnDefs(columnDefs);
      }
      if (rowTransaction && this.gridApi) {
        this.gridApi.updateRowData(rowTransaction);
        this.gridRowData = this.getRowData(dataSet);
      }
      if (shouldSaveEditState) {
        this.restoreCellEditState();
      }
    }
  }

  public attachDataSet(dataSet?: IDataSet) {
    if (dataSet) {
      dataSet.addActionListener("case-table", this.handleAction);
    }
  }

  public detachDataSet(dataSet?: IDataSet) {
    if (dataSet) {
      dataSet.removeActionListener("case-table");
    }
  }

  public handleRowSelectionChanged = () => {
    if (this.gridApi) {
      this.gridApi.refreshHeader();
    }
  }

  public handleCellEditingStarted = (event: CellEditingStartedEvent) => {
    this.editCellEvent = event;
  }

  public handleCellEditingStopped = (event: CellEditingStoppedEvent) => {
    this.editCellEvent = undefined;
    this.checkForEnterAfterCellEditingStopped = true;
  }

  public handleTabToNextCell = (params: TabToNextCellParams) => {
    this.prevEditCell = params.previousCellDef;
    if (params.editing && !params.backwards && !params.nextCellDef) {
      setTimeout(() => {
        this.addLocalCaseToTable();
        setTimeout(this.startEditingFirstColumnOfNextRow);
      });
    }
    return params.nextCellDef;
  }

  public handleKeyUp = (e: KeyboardEvent) => {
    if (e.keyCode === 13) {
      const focusedCell = this.gridApi && this.gridApi.getFocusedCell();
      this.prevEditCell = focusedCell ? focusedCell.getGridCellDef() : undefined;
      if (this.checkForEnterAfterLocalDataEntry) {
        this.addLocalCaseToTable();
        setTimeout(this.startEditingSameColumnOfNextRow);
      }
      else if (this.checkForEnterAfterCellEditingStopped) {
        setTimeout(this.startEditingSameColumnOfNextRow);
      }
    }

    this.checkForEnterAfterLocalDataEntry = false;
    this.checkForEnterAfterCellEditingStopped = false;
  }

  public handlePostSort = (rowNodes: RowNode[]) => {
    // move the entry row to the bottom
    const localRow = rowNodes.find((rowNode) => rowNode.data.id === LOCAL_ROW_ID);
    if (localRow) {
      rowNodes.splice(rowNodes.indexOf(localRow), 1);
      rowNodes.push(localRow);
    }

    // keep reference so we can keep index in ascending order
    this.sortedRowNodes = rowNodes;
    if (this.gridApi) {
      // force update of the case index
      this.gridApi.refreshCells({
        columns: ["__CASE_INDEX__"],
        force: true
      });
    }
  }

  public handleSortChanged = (event: SortChangedEvent) => {
    const { tableComponentData: caseTableComponentData } = this.props;
    if (caseTableComponentData) {
      const currentSortModel = getSnapshot(caseTableComponentData.sortModel);
      const newSortModel = event.api && event.api.getSortModel();
      if (!isEqual(currentSortModel, newSortModel)) {
        caseTableComponentData.setSortModel(newSortModel);
      }
    }
  }

  public componentDidMount() {
    window.addEventListener("keyup", this.handleKeyUp);
  }

  public componentWillUnmount() {
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  public componentWillReceiveProps(nextProps: IProps) {
    const { changeCount, dataSet } = nextProps;
    if (dataSet !== this.props.dataSet) {
      this.detachDataSet(this.props.dataSet);
      this.attachDataSet(dataSet);
      this.updateGridState(dataSet);
    }
    else if (changeCount !== this.props.changeCount) {
      this.updateGridState(dataSet);
    }
  }

  public handleSetAddAttributePos = () => {
    if (this.gridElement) {
      const classes = this.gridElement.getElementsByClassName("ag-header-row");
      this.headerElement = classes.item(classes.length - 1) as HTMLDivElement;
      if (this.headerElement) {
        const gridRect = this.gridElement.getBoundingClientRect();
        const headerRect = this.headerElement.getBoundingClientRect();
        const left = headerRect.right - gridRect.left;
        const top = headerRect.top - gridRect.top;
        const {addAttributeButtonPos} = this.state;
        if (!addAttributeButtonPos || (addAttributeButtonPos.top !== top) || (addAttributeButtonPos.left !== left)) {
          this.setState({addAttributeButtonPos: {top, left}});
        }
      }
    }
  }

  public componentWillReact() {
    this.updateGridState(this.props.dataSet);
  }

  public handleAddAttributeButton = () => {
    emitTableEvent({type: "add-column"});
  }

  public renderAddAttributeButtonPos() {
    const {addAttributeButtonPos} = this.state;
    if (addAttributeButtonPos !== null) {
      const {top, left} = addAttributeButtonPos;
      return (
        <span
          onClick={this.handleAddAttributeButton}
          style={{
            position: "absolute",
            fontSize: 10,
            top,
            left,
            marginLeft: 5,
            marginTop: 3,
            padding: "1px 4px",
            border: "1px solid #777",
            cursor: "pointer"
          }} >
          +
        </span>
      );
    }
    return null;
  }

  public render() {
    return (
      <div className="neo-codap-case-table ag-theme-fresh"
          ref={(el) => this.gridElement = el}
          draggable={true}
          onDragStart={this.handleDragStart}>
        <AgGridReact
          columnDefs={this.gridColumnDefs}
          getRowNodeId={this.getRowNodeId}
          debug={false}
          rowSelection={this.state.rowSelection}
          rowDeselection={true}
          onSelectionChanged={this.handleRowSelectionChanged}
          rowData={this.gridRowData}
          deltaRowDataMode={false}
          onGridReady={this.onGridReady}
          suppressDragLeaveHidesColumns={true}
          getRowStyle={this.getRowStyle}
          enableCellChangeFlash={true}
          onCellEditingStarted={this.handleCellEditingStarted}
          onCellEditingStopped={this.handleCellEditingStopped}
          tabToNextCell={this.handleTabToNextCell}
          postSort={this.handlePostSort}
          onSortChanged={this.handleSortChanged}
          onViewportChanged={this.handleSetAddAttributePos}
        />
      </div>
    );
  }

  private handleDragStart = (evt: React.DragEvent<HTMLDivElement>) => {
    // ag-grid adds "ag-column-resizing" class to columns being actively resized
    if (this.gridElement && this.gridElement.getElementsByClassName("ag-column-resizing").length) {
      // if we're column resizing, prevent other drags above (e.g. tile drags)
      evt.preventDefault();
      evt.stopPropagation();
    }
  }
}
