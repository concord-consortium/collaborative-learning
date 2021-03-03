import { observer } from "mobx-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDataGrid from "react-data-grid";
import { getTableContentHeight, TableContentModelType } from "../../../models/tools/table/table-content";
import { IToolTileProps } from "../tool-tile";
import { EditableTableTitle } from "./editable-table-title";
import { TableToolbar } from "./table-toolbar";
import { useColumnWidths } from "./use-column-widths";
import { useContentChangeHandlers } from "./use-content-change-handlers";
import { useDataSet } from "./use-data-set";
import { useExpressionsDialog } from "./use-expressions-dialog";
import { useGeometryLinking } from "./use-geometry-linking";
import { useGridContext } from "./use-grid-context";
import { useModelDataSet } from "./use-model-data-set";
import { useRowLabelColumn } from "./use-row-label-column";
import { useTableTitle } from "./use-table-title";
import { useToolApi } from "./use-tool-api";
import { useCurrent } from "../../../hooks/use-current";
import { useMeasureText } from "../hooks/use-measure-text";
import { useToolbarToolApi } from "../hooks/use-toolbar-tool-api";
import { lightenColor } from "../../../utilities/color-utils";

import "react-data-grid/dist/react-data-grid.css";
import "./table-tool.scss";

// observes row selection from shared selection store
const TableToolComponent: React.FC<IToolTileProps> = observer(({
  documentId, documentContent, toolTile, model, readOnly, height, scale,
  onRequestRowHeight, onRequestTilesOfType, onRequestUniqueTitle, onRegisterToolApi, onUnregisterToolApi
}) => {
  const modelRef = useCurrent(model);
  const getContent = useCallback(() => modelRef.current.content as TableContentModelType, [modelRef]);
  const metadata = getContent().metadata;

  const {
    dataSet, columnChanges, triggerColumnChange, rowChanges, triggerRowChange, ...gridModelProps
  } = useModelDataSet(model);

  const handleRequestUniqueTitle = useCallback(() => {
    return onRequestUniqueTitle(modelRef.current.id);
  }, [modelRef, onRequestUniqueTitle]);

  const getContentHeight = useCallback(() => {
    return getTableContentHeight({
      readOnly,
      dataRows: dataSet.current.cases.length,
      hasExpressions: getContent().hasExpressions,
      padding: 10 + (modelRef.current.display === "teacher" ? 20 : 0)
    });
  }, [dataSet, getContent, modelRef, readOnly]);

  const heightRef = useCurrent(height);
  const handleRequestRowHeight = useCallback((options: { height?: number, deltaHeight?: number }) => {
    // increase row height automatically but require manual shrinking
    if (!heightRef.current ||
        (options?.height && (options.height > heightRef.current)) ||
        (options?.deltaHeight && (options.deltaHeight > 0))) {
      onRequestRowHeight(modelRef.current.id, options?.height, options?.deltaHeight);
    }
  }, [heightRef, modelRef, onRequestRowHeight]);

  const changeHandlers = useContentChangeHandlers({
    model, dataSet: dataSet.current,
    onRequestRowHeight: handleRequestRowHeight, triggerColumnChange, triggerRowChange
  });
  const { onSetTableTitle, onSetColumnExpressions, onLinkGeometryTile, onUnlinkGeometryTile } = changeHandlers;

  const [showRowLabels, setShowRowLabels] = useState(false);
  const {
    ref: gridRef, gridContext, inputRowId, selectedCell, getSelectedRows, ...gridProps
  } = useGridContext({ modelId: model.id, showRowLabels, triggerColumnChange });
  const measureHeaderText = useMeasureText("bold 14px Lato, sans-serif");
  // const measureBodyText = useMeasureText("14px Lato, sans-serif");
  const { getTitle, onBeginTitleEdit, onEndTitleEdit } = useTableTitle({
    gridContext, dataSet: dataSet.current, readOnly,
    onSetTableTitle, onRequestUniqueTitle: handleRequestUniqueTitle
  });

  useToolApi({ metadata, getTitle, getContentHeight, onRegisterToolApi, onUnregisterToolApi });

  const rowLabelProps = useRowLabelColumn({
    inputRowId: inputRowId.current, selectedCell, showRowLabels, setShowRowLabels
  });

  const handleSubmitExpressions = (expressions: Map<string, string>) => {
    if (dataSet.current.attributes.length && expressions.size) {
      onSetColumnExpressions(expressions, dataSet.current.attributes[0].name);
    }
  };
  const [showExpressionsDialog, , setCurrYAttrId] = useExpressionsDialog({
    metadata, dataSet: dataSet.current, onSubmit: handleSubmitExpressions
  });

  const handleShowExpressionsDialog = (attrId?: string) => {
    attrId && setCurrYAttrId(attrId);
    showExpressionsDialog();
  };
  const { hasLinkableRows, ...dataGridProps } = useDataSet({
    gridRef, gridContext, model, dataSet: dataSet.current, columnChanges, triggerColumnChange,
    rowChanges, triggerRowChange, readOnly: !!readOnly, changeHandlers, measureText: measureHeaderText,
    selectedCell, inputRowId, ...rowLabelProps, onShowExpressionsDialog: handleShowExpressionsDialog });

  const { showLinkButton, isLinkEnabled, linkColors, getLinkIndex, showLinkGeometryDialog } =
    useGeometryLinking({ documentId, model, hasLinkableRows,
                          onRequestTilesOfType, onLinkGeometryTile, onUnlinkGeometryTile });

  const { titleCellWidth } =
    useColumnWidths({ readOnly, getTitle, columns: dataGridProps.columns, measureText: measureHeaderText });

  const containerRef = useRef<HTMLDivElement>(null);
  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // clear any selection on background click
    (e.target === containerRef.current) && gridContext.onClearSelection();
  };

  useEffect(() => {
    if (containerRef.current && linkColors) {
      // override the CSS variables controlling selection color for linked tables
      const dataGrid = containerRef.current.getElementsByClassName("rdg")[0] as HTMLDivElement | undefined;
      dataGrid?.style.setProperty("--header-selected-background-color", lightenColor(linkColors.stroke));
      dataGrid?.style.setProperty("--row-selected-background-color", lightenColor(linkColors.fill));
    }
  });

  const toolbarProps = useToolbarToolApi({ id: model.id, enabled: !readOnly, onRegisterToolApi, onUnregisterToolApi });
  return (
    <div className="table-tool">
      <TableToolbar documentContent={documentContent} toolTile={toolTile} {...toolbarProps}
                    onSetExpression={showExpressionsDialog} scale={scale}/>
      <div className="table-grid-container" ref={containerRef} onClick={handleBackgroundClick}>
        <EditableTableTitle className="table-title" readOnly={readOnly} showLinkButton={showLinkButton}
          isLinkEnabled={isLinkEnabled} getLinkIndex={getLinkIndex} onLinkGeometryClick={showLinkGeometryDialog}
          getTitle={getTitle} titleCellWidth={titleCellWidth}
          onBeginEdit={onBeginTitleEdit} onEndEdit={onEndTitleEdit} />
        <ReactDataGrid ref={gridRef} selectedRows={getSelectedRows()}
          {...gridProps} {...gridModelProps} {...dataGridProps} />
      </div>
    </div>
  );
});
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
//   showInvalidPasteAlert?: boolean; [TODO]
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
//     this.initializeHotKeys();  [TODO]
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
//     this.disposers.push(selection.observe(this.props.model.id, change => { [TODO]
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

//   private renderInvalidPasteAlert() {  [TODO]
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

//   private initializeHotKeys() {  [TODO]
//     this.hotKeys.register({
//       "cmd-c": this.handleCopy,
//       "cmd-v": this.handlePaste
//     });
//   }

//   private handleGridReady = (gridReadyParams: GridReadyEvent) => {
//     this.gridApi = gridReadyParams.api || undefined;
//   }

//   private handleRowSelectionChange = (e: SelectionChangedEvent) => { [TODO]
//     const { selection } = this.stores;
//     const nodes = e.api.getSelectedNodes();
//     selection.setSelected(this.props.model.id, nodes.map(n => n.id));  [TODO] sync row selection back to model
//   }

//   private handleMouseDown = (e: MouseEvent) => { [TODO]
//     const target: HTMLElement = e.target as HTMLElement;
//     const targetClasses = target && target.className;
//     // don't mess with focus if this looks like something ag-grid has handled
//     if (typeof targetClasses !== "string") return;
//     if (targetClasses.includes("ag-cell") || targetClasses.includes("ag-header-cell")) {
//       return;
//     }

//     // table tile should have keyboard focus -- requires tabIndex
//     this.domRef.current?.focus();  [TODO?]

//     // clicking on table background clears selection [TODO]
//     this.gridApi?.deselectAll();
//     this.gridApi?.refreshCells();
//   }

//   private handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {  [TODO]
//     this.hotKeys.dispatch(e);
//   }

//   private handleCopy = () => { [TODO]
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

//   private handlePaste = () => {  [TODO]
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

//  => useContentChangeHandlers [getPositionOfPoint]
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

//  => useContentChangeHandlers [getTableActionLinks]
//   private getTableActionLinks(): ILinkProperties | undefined {
//     const linkedGeometries = this.getContent().metadata.linkedGeometries;
//     if (!linkedGeometries || !linkedGeometries.length) return;
//     const actionId = uniqueId();
//     return { id: actionId, tileIds: [...linkedGeometries] };
//   }

//  => useContentChangeHandlers [getGeometryActionLinks]
//   private getGeometryActionLinks(links?: ILinkProperties, addLabelMap = false): ITableLinkProperties | undefined {
//     if (!links || !links.id) return;
//     return this.getContent().getClientLinks(links.id, this.state.dataSet, addLabelMap);
//   }

//  => useContentChangeHandlers [getGeometryActionLinksWithLabels]
//   private getGeometryActionLinksWithLabels(links?: ILinkProperties) {
//     return this.getGeometryActionLinks(links, true);
//   }

//  => useContentChangeHandlers [setTableName]
//   private handleSetTableName = (name: string) => {
//     // const shouldExpandTable = name && !this.state.dataSet?.name;
//     this.getContent().setTableName(name);
//     const kTableNameHeight = 25;
//     this.props.onRequestRowHeight(this.props.model.id, undefined, kTableNameHeight);
//   }

//  => useContentChangeHandlers [setColumnName]
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

//  => useContentChangeHandlers [setColumnExpressions]
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

//  => useContentChangeHandlers [addRows]
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

//  => useContentChangeHandlers [updateRow]
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

//  => useContentChangeHandlers [removeRows]
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

//   private handleGetLinkedGeometries = () => {  [TODO?]
//     return this.getContent().metadata.linkedGeometries.toJS();
//   }

//   private handleUnlinkGeometry = () => { [TODO]
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
