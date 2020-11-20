import React, { useRef, useState } from "react";
import ReactDataGrid from "react-data-grid";
import { DataSet } from "../../../models/data/data-set";
import { TableContentModelType } from "../../../models/tools/table/table-content";
import { IToolTileProps } from "../tool-tile";
import { EditableTableTitle } from "./editable-table-title";
import { TableToolbar } from "./table-toolbar";
import { useDataSet } from "./use-data-set";
import { useSetExpressionDialog } from "./use-set-expression-dialog";
import { useToolbarToolApi } from "../hooks/use-toolbar-tool-api";

import "react-data-grid/dist/react-data-grid.css";
import "./table-tool.scss";

const createDebugDataTable = () => {
  const dataSet = DataSet.create();
  dataSet.setName("Alan's Pledge Plan");
  dataSet.addAttributeWithID({ id: "attr-distance", name: "Distance" });
  dataSet.addAttributeWithID({ id: "attr-money", name: "Money Earned" });
  dataSet.addAttributeWithID({ id: "attr-y2", name: "y2" });
  dataSet.addAttributeWithID({ id: "attr-result", name: "result" });
  dataSet.addCanonicalCasesWithIDs([
    { __id__: "case-1", "attr-distance": 1, "attr-money": 3, "attr-y2": 0.33, "attr-result": "true" },
    { __id__: "case-2", "attr-distance": 2, "attr-money": 6.5, "attr-y2": 0.31, "attr-result": "false" },
    { __id__: "case-3", "attr-distance": 3, "attr-money": 8, "attr-y2": 0.38,
              "attr-result": "maybe" }
  ]);
  return dataSet;
};
const kDebugDataSet = createDebugDataTable();

const useContentDataSet = (content: TableContentModelType) => {
  const tileDataSet = useRef(DataSet.create());
  const isInitialized = useRef(false);
  if (!isInitialized.current) {
    content.applyChangesToDataSet(tileDataSet.current);
    isInitialized.current = true;
  }
  return tileDataSet;
};

const TableToolComponent: React.FC<IToolTileProps> = ({
  documentContent, toolTile, model, readOnly, onRequestRowHeight, onRegisterToolApi, onUnregisterToolApi
}) => {
  const content = model.content as TableContentModelType;
  const tileDataSet = useContentDataSet(content);
  // For development/debugging purposes, apply fixture data to empty tables
  const contentChanges = content.changes.length;
  const dataSet = useRef(contentChanges > 2 ? tileDataSet.current : kDebugDataSet);
  const [showRowLabels, setShowRowLabels] = useState(false);
  const handleRequestRowHeight = (options: { height?: number, delta?: number }) => {
    onRequestRowHeight(model.id, options.height, options.delta);
  };
  const {
    tableTitle, setTableTitle, titleWidth, onBeginTitleEdit, onEndTitleEdit, ...dataGridProps
  } = useDataSet({
        dataSet: dataSet.current, readOnly: !!readOnly,
        showRowLabels, setShowRowLabels, onRequestRowHeight: handleRequestRowHeight });

  const toolbarProps = useToolbarToolApi({ id: model.id, enabled: !readOnly, onRegisterToolApi, onUnregisterToolApi });
  const [showSetExpressionDialog] = useSetExpressionDialog({ dataSet: dataSet.current });

  return (
    <div className="table-tool">
      <TableToolbar documentContent={documentContent} toolTile={toolTile} {...toolbarProps}
                    onSetExpression={showSetExpressionDialog} />
      <div className="table-grid-container">
        <EditableTableTitle className="table-title" titleWidth={titleWidth} readOnly={readOnly}
          title={tableTitle || "Table Title"} setTitle={setTableTitle}
          onBeginEdit={onBeginTitleEdit} onEndEdit={onEndTitleEdit} />
        <ReactDataGrid className="rdg-light" {...dataGridProps} />
      </div>
    </div>
  );
};
export default TableToolComponent;
(TableToolComponent as any).tileHandlesSelection = true;

// import { observer, inject } from "mobx-react";
// import { Alert, Intent } from "@blueprintjs/core";
// import { BaseComponent } from "../../base";
// import DataTableComponent, { LOCAL_ROW_ID } from "./data-table";
// import { LinkedTableCellEditor } from "./linked-table-cell-editor";
// import { IMenuItemFlags } from "./table-header-menu";
// import { IToolTileProps } from "../tool-tile";
// import { GridApi, GridReadyEvent, SelectionChangedEvent, ValueGetterParams, ValueFormatterParams
//         } from "@ag-grid-community/core";
// import { DataSet, IDataSet, ICase, ICaseCreation } from "../../../models/data/data-set";
// import { getSettingFromStores } from "../../../models/stores/stores";
// import { addTable, getLinkedTableIndex } from "../../../models/tools/table-links";
// import { canonicalizeValue, getRowLabel, isLinkableValue, ILinkProperties, ITableLinkProperties,
//         TableContentModelType } from "../../../models/tools/table/table-content";
// import { getGeometryContent } from "../../../models/tools/geometry/geometry-content";
// import { JXGCoordPair, JXGProperties, JXGUnsafeCoordPair } from "../../../models/tools/geometry/jxg-changes";
// import { HotKeys } from "../../../utilities/hot-keys";
// import { uniqueId } from "../../../utilities/js-utils";
// import { format } from "d3-format";
// import { each, memoize, sortedIndexOf } from "lodash";
// import { autorun, IReactionDisposer, Lambda } from "mobx";
// type MobXDisposer = IReactionDisposer | Lambda;

// import "./table-tool.sass";

// const memoizedFormat = memoize(format);

// interface IClipboardCases {
//   attrs: Array<{ id: string, name: string }>;
//   cases: ICase[];
// }

// interface IState {
//   dataSet: IDataSet;
//   showInvalidPasteAlert?: boolean;
// }

// @inject("stores")
// @observer
// export default class TableToolComponent extends BaseComponent<IToolTileProps, IState> {

//   public static tileHandlesSelection = true;

//   public state: IState = {
//                   dataSet: DataSet.create()
//                 };

//   private modelId: string;
//   private domRef: React.RefObject<HTMLDivElement> = React.createRef();
//   private hotKeys: HotKeys = new HotKeys();
//   private syncedChanges: number;
//   private disposers: MobXDisposer[];

//   private gridApi?: GridApi;

//   public componentDidMount() {
//     this.initializeHotKeys();
//     this.syncedChanges = 0;
//     this.disposers = [];

//     this.modelId = this.props.model.id;
//     addTable(this.props.docId, this.modelId);

//     if (this.domRef.current) {
//       this.domRef.current.addEventListener("mousedown", this.handleMouseDown);
//     }

//     const metadata = this.getContent().metadata;
//     this.props.onRegisterToolApi({
//       isLinked: () => {
//         return metadata.isLinked;
//       },
//       getLinkIndex: (index?: number) => {
//         return metadata.isLinked
//                 ? getLinkedTableIndex(this.modelId)
//                 : -1;
//       }
//     });

//     const { selection } = this.stores;
//     this.disposers.push(selection.observe(this.props.model.id, change => {
//       const rowId = change.name;
//       const isSharedRowSelected = change.type === "delete"
//               ? false
//               : (change.newValue as any).storedValue;
//       const rowNode = this.gridApi && this.gridApi.getRowNode(rowId);
//       const isRowNodeSelected = rowNode ? rowNode.isSelected() : false;
//       if (rowNode && (isSharedRowSelected !== isRowNodeSelected)) {
//         rowNode.setSelected(isSharedRowSelected, false);
//       }
//     }));

//     this.disposers.push(autorun(() => {
//       const { model: { content } } = this.props;
//       const tableContent = content as TableContentModelType;
//       if (this.syncedChanges < tableContent.changes.length) {
//         tableContent.applyChanges(this.state.dataSet, this.syncedChanges);
//         this.syncedChanges = tableContent.changes.length;
//         // The state updates in applyChanges aren't picked up by React, so we force a render
//         this.forceUpdate();
//       }
//     }));
//   }

//   public componentWillUnmount() {
//     if (this.domRef.current) {
//       this.domRef.current.removeEventListener("mousedown", this.handleMouseDown);
//     }

//     this.props.onUnregisterToolApi();

//     this.disposers.forEach(disposer => disposer());

//     this.gridApi = undefined;
//   }

//   public render() {
//     const { model, readOnly } = this.props;
//     const content = this.getContent();
//     const metadata = content.metadata;
//     const itemFlags: IMenuItemFlags = {
//             addAttribute: false,
//             addCase: true,
//             addRemoveDivider: false,
//             setTableName: true,
//             renameAttribute: true,
//             removeAttribute: false,
//             removeCases: true,
//             unlinkGeometry: true
//           };
//     const linkIndex = getLinkedTableIndex(model.id);
//     const linkClass = metadata.isLinked ? `is-linked link-color-${linkIndex}` : "";
//     return (
//       <div className={`table-tool ${linkClass}`}
//           ref={this.domRef}
//           tabIndex={0}
//           onKeyDown={this.handleKeyDown} >
//         <DataTableComponent
//           dataSet={this.state.dataSet}
//           expressions={metadata.expressions}
//           rawExpressions={metadata.rawExpressions}
//           changeCount={this.syncedChanges}
//           autoSizeColumns={content.isImported}
//           indexValueGetter={this.indexValueGetter}
//           attrValueFormatter={this.attrValueFormatter}
//           cellEditorComponent={LinkedTableCellEditor}
//           cellEditorParams={{ metadata }}
//           defaultPrecision={1}
//           itemFlags={itemFlags}
//           readOnly={readOnly}
//           onGridReady={this.handleGridReady}
//           onRowSelectionChange={this.handleRowSelectionChange}
//           onSetTableName={this.handleSetTableName}
//           onSetAttributeName={this.handleSetAttributeName}
//           onSetExpression={this.handleSetExpression}
//           onAddCanonicalCases={this.handleAddCanonicalCases}
//           onSetCanonicalCaseValues={this.handleSetCanonicalCaseValues}
//           onRemoveCases={this.handleRemoveCases}
//           onGetLinkedGeometries={this.handleGetLinkedGeometries}
//           onUnlinkGeometry={this.handleUnlinkGeometry}
//         />
//         {this.renderInvalidPasteAlert()}
//       </div>
//     );
//   }

//   private renderInvalidPasteAlert() {
//     return this.state.showInvalidPasteAlert && (
//       <Alert
//           confirmButtonText="OK"
//           icon="error"
//           intent={Intent.DANGER}
//           isOpen={true}
//           onClose={this.handleCloseInvalidPasteAlert}
//           canEscapeKeyCancel={true}
//       >
//         <p>
//           Linked data must be numeric. Please edit the table values so that all pasted cells contain numbers.
//         </p>
//       </Alert>
//     );
//   }

//   private handleCloseInvalidPasteAlert = () => {
//     this.setState({ showInvalidPasteAlert: false });
//   }

//   private getContent() {
//     return this.props.model.content as TableContentModelType;
//   }

//   private initializeHotKeys() {
//     this.hotKeys.register({
//       "cmd-c": this.handleCopy,
//       "cmd-v": this.handlePaste
//     });
//   }

//   private handleGridReady = (gridReadyParams: GridReadyEvent) => {
//     this.gridApi = gridReadyParams.api || undefined;
//   }

//   private handleRowSelectionChange = (e: SelectionChangedEvent) => {
//     const { selection } = this.stores;
//     const nodes = e.api.getSelectedNodes();
//     selection.setSelected(this.props.model.id, nodes.map(n => n.id));
//   }

//   private handleMouseDown = (e: MouseEvent) => {
//     const target: HTMLElement = e.target as HTMLElement;
//     const targetClasses = target && target.className;
//     // don't mess with focus if this looks like something ag-grid has handled
//     if (typeof targetClasses !== "string") return;
//     if (targetClasses.includes("ag-cell") || targetClasses.includes("ag-header-cell")) {
//       return;
//     }

//     // table tile should have keyboard focus -- requires tabIndex
//     this.domRef.current?.focus();

//     // clicking on table background clears selection
//     this.gridApi?.deselectAll();
//     this.gridApi?.refreshCells();
//   }

//   private handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
//     this.hotKeys.dispatch(e);
//   }

//   private handleCopy = () => {
//     const { dataSet } = this.state;
//     if (this.gridApi && dataSet) {
//       const sortedRowIds = this.gridApi.getSelectedNodes().map(row => row.id).sort();
//       const rowIds = dataSet.cases.map(aCase => aCase.__id__).filter(id => sortedIndexOf(sortedRowIds, id) >= 0);
//       if (rowIds && rowIds.length) {
//         const { clipboard } = this.stores;
//         const clipData = {
//                 attrs: dataSet.attributes.map(attr => ({ id: attr.id, name: attr.name })),
//                 cases: dataSet.getCanonicalCases(rowIds)
//               };
//         clipboard.clear();
//         clipboard.addTileContent(this.props.model.id, this.getContent().type, clipData, this.stores);
//       }
//     }
//   }

//   private handlePaste = () => {
//     const content = this.getContent();
//     const { readOnly } = this.props;
//     if (!readOnly && this.gridApi) {
//       const { clipboard } = this.stores;
//       const clipData: IClipboardCases = clipboard.getTileContent(content.type);
//       if (clipData && clipData.cases && clipData.cases.length) {
//         const attrCount = Math.min(this.state.dataSet.attributes.length, clipData.attrs.length);
//         const attrMap: { [id: string]: string } = {};
//         clipData.attrs.forEach((attr, i) => {
//           if (i < attrCount) {
//             attrMap[attr.id] = this.state.dataSet.attributes[i].id;
//           }
//         });
//         let doesTableContainUnlinkableValues = false;
//         const cases = clipData.cases.map(srcCase => {
//           const dstCase: ICase = { __id__: uniqueId() };
//           each(srcCase, (value, attrID) => {
//             const dstAttrID = attrMap[attrID];
//             if (dstAttrID) {
//               dstCase[dstAttrID] = value;
//               if (!isLinkableValue(value)) {
//                 doesTableContainUnlinkableValues = true;
//               }
//             }
//           });
//           return dstCase;
//         });
//         if (content.isLinked && doesTableContainUnlinkableValues) {
//           this.setState({ showInvalidPasteAlert: true });
//         }
//         else {
//           this.handleAddCanonicalCases(cases);
//         }
//       }
//     }
//   }

//   private indexValueGetter = (params: ValueGetterParams) => {
//     const metadata = this.getContent().metadata;
//     return metadata && metadata.isLinked && (params.data.id !== LOCAL_ROW_ID)
//             ? getRowLabel(params.node.rowIndex)
//             : "";
//   }

//   private attrValueFormatter = (params: ValueFormatterParams) => {
//     if ((params.value == null) || (params.value === "")) return params.value;
//     const num = Number(params.value);
//     if (!isFinite(num)) return params.value;
//     const kDefaultFormatStr = ".1~f"; // one decimal place, remove trailing zero
//     const formatStr = getSettingFromStores(this.stores, "numFormat", "table") as string | undefined ||
//                         kDefaultFormatStr;
//     return memoizedFormat(formatStr)(num);
//   }

//   private getGeometryContent(geometryId: string) {
//     return getGeometryContent(this.getContent(), geometryId);
//   }

//   private getPositionOfPoint(caseId: string): JXGUnsafeCoordPair {
//     const { dataSet } = this.state;
//     const attrCount = dataSet.attributes.length;
//     const xAttr = attrCount > 0 ? dataSet.attributes[0] : undefined;
//     const yAttr = attrCount > 1 ? dataSet.attributes[1] : undefined;
//     // convert non-numeric values to 0
//     const xValue = xAttr ? dataSet.getValue(caseId, xAttr.id) : 0;
//     const yValue = yAttr ? dataSet.getValue(caseId, yAttr.id) : 0;
//     return [canonicalizeValue(xValue), canonicalizeValue(yValue)];
//   }

//   private getTableActionLinks(): ILinkProperties | undefined {
//     const linkedGeometries = this.getContent().metadata.linkedGeometries;
//     if (!linkedGeometries || !linkedGeometries.length) return;
//     const actionId = uniqueId();
//     return { id: actionId, tileIds: [...linkedGeometries] };
//   }

//   private getGeometryActionLinks(links?: ILinkProperties, addLabelMap = false): ITableLinkProperties | undefined {
//     if (!links || !links.id) return;
//     return this.getContent().getClientLinks(links.id, this.state.dataSet, addLabelMap);
//   }

//   private getGeometryActionLinksWithLabels(links?: ILinkProperties) {
//     return this.getGeometryActionLinks(links, true);
//   }

//   private handleSetTableName = (name: string) => {
//     // const shouldExpandTable = name && !this.state.dataSet?.name;
//     this.getContent().setTableName(name);
//     const kTableNameHeight = 25;
//     this.props.onRequestRowHeight(this.props.model.id, undefined, kTableNameHeight);
//   }

//   private handleSetAttributeName = (attributeId: string, name: string) => {
//     const tableActionLinks = this.getTableActionLinks();
//     this.getContent().setAttributeName(attributeId, name);
//     const geomActionLinks = this.getGeometryActionLinksWithLabels(tableActionLinks);
//     this.getContent().metadata.linkedGeometries.forEach(id => {
//       const geometryContent = this.getGeometryContent(id);
//       if (geometryContent) {
//         geometryContent.updateAxisLabels(undefined, this.props.model.id, geomActionLinks);
//       }
//     });
//   }

//   private handleSetExpression = (attributeId: string, expression: string, rawExpression: string) => {
//     this.getContent().setExpression(attributeId, expression, rawExpression);
//     const dataSet = this.state.dataSet;
//     const tableActionLinks = this.getTableActionLinks();
//     const geomActionLinks = this.getGeometryActionLinks(tableActionLinks);
//     const ids: string[] = [];
//     const props: JXGProperties[] = [];
//     dataSet.cases.forEach(aCase => {
//       const caseId = aCase.__id__;
//       ids.push(caseId);
//       const position = this.getPositionOfPoint(caseId) as JXGCoordPair;
//       props.push({ position });
//     });
//     this.getContent().metadata.linkedGeometries.forEach(id => {
//       const geometryContent = this.getGeometryContent(id);
//       if (geometryContent) {
//         geometryContent.updateObjects(undefined, ids, props, geomActionLinks);
//       }
//     });
//   }

//   private handleAddCanonicalCases = (newCases: ICaseCreation[]) => {
//     const validateCase = (aCase: ICaseCreation) => {
//       const newCase: ICaseCreation = { __id__: uniqueId() };
//       if (this.getContent().isLinked) {
//         // validate linkable values
//         this.state.dataSet.attributes.forEach(attr => {
//           const value = aCase[attr.id];
//           newCase[attr.id] = isLinkableValue(value) ? value : 0;
//         });
//         return newCase;
//       }
//       return { ...newCase, ...aCase };
//     };
//     const cases = newCases.map(aCase => validateCase(aCase));
//     const selectedRowIds = this.gridApi && this.gridApi.getSelectedNodes().map(row => row.id);
//     const firstSelectedRowId = selectedRowIds && selectedRowIds.length && selectedRowIds[0] || undefined;
//     const tableActionLinks = this.getTableActionLinks();
//     this.getContent().addCanonicalCases(cases, firstSelectedRowId, tableActionLinks);
//     const parents = cases.map(aCase => this.getPositionOfPoint(aCase.__id__ as string));
//     const props = cases.map(aCase => ({ id: aCase.__id__ }));
//     const geomActionLinks = this.getGeometryActionLinksWithLabels(tableActionLinks);
//     this.getContent().metadata.linkedGeometries.forEach(id => {
//       const geometryContent = this.getGeometryContent(id);
//       if (geometryContent) {
//         geometryContent.addPoints(undefined, parents, props, geomActionLinks);
//       }
//     });
//   }

//   private handleSetCanonicalCaseValues = (caseValues: ICase) => {
//     const caseId = caseValues.__id__;
//     const tableActionLinks = this.getTableActionLinks();
//     this.getContent().setCanonicalCaseValues([caseValues], tableActionLinks);
//     const geomActionLinks = this.getGeometryActionLinks(tableActionLinks);
//     this.getContent().metadata.linkedGeometries.forEach(id => {
//       const newPosition = this.getPositionOfPoint(caseId);
//       const position = newPosition as JXGCoordPair;
//       const geometryContent = this.getGeometryContent(id);
//       if (geometryContent) {
//         geometryContent.updateObjects(undefined, caseId, { position }, geomActionLinks);
//       }
//     });
//   }

//   private handleRemoveCases = (ids: string[]) => {
//     const tableActionLinks = this.getTableActionLinks();
//     this.getContent().removeCases(ids, tableActionLinks);
//     const geomActionLinks = this.getGeometryActionLinksWithLabels(tableActionLinks);
//     this.getContent().metadata.linkedGeometries.forEach(id => {
//       const geometryContent = this.getGeometryContent(id);
//       if (geometryContent) {
//         geometryContent.removeObjects(undefined, ids, geomActionLinks);
//       }
//     });
//   }

//   private handleGetLinkedGeometries = () => {
//     return this.getContent().metadata.linkedGeometries.toJS();
//   }

//   private handleUnlinkGeometry = () => {
//     const geometryIds = this.getContent().metadata.linkedGeometries.toJS();
//     const tableActionLinks = this.getTableActionLinks();
//     this.getContent().removeGeometryLinks(geometryIds, tableActionLinks);
//     const geomActionLinks = this.getGeometryActionLinksWithLabels(tableActionLinks);
//     geometryIds.forEach(id => {
//       const geometryContent = this.getGeometryContent(id);
//       if (geometryContent) {
//         geometryContent.removeTableLink(undefined, this.props.model.id, geomActionLinks);
//       }
//     });
//   }
// }
