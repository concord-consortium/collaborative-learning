import { observer } from "mobx-react";
import { onSnapshot } from "mobx-state-tree";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDataGrid from "react-data-grid";
import { getTableContentHeight, TableContentModelType } from "../../../models/tools/table/table-content";
import { exportTableContentAsJson } from "../../../models/tools/table/table-export";
import { IToolTileProps } from "../tool-tile";
import { EditableTableTitle } from "./editable-table-title";
import { TableToolbar } from "./table-toolbar";
import { useColumnsFromDataSet } from "./use-columns-from-data-set";
import { useTitleSize } from "./use-title-size";
import { useColumnExtensions } from "./use-column-extensions";
import { useContentChangeHandlers } from "./use-content-change-handlers";
import { useDataSet } from "./use-data-set";
import { useExpressionsDialog } from "./use-expressions-dialog";
import { useGeometryLinking } from "./use-geometry-linking";
import { useGridContext } from "./use-grid-context";
import { useMeasureColumnWidth } from "./use-measure-column-width";
import { useModelDataSet } from "./use-model-data-set";
import { useRowLabelColumn } from "./use-row-label-column";
import { useTableTitle } from "./use-table-title";
import { useToolApi } from "./use-tool-api";
import { useRowHeight } from "./use-row-height";
import { useRowsFromDataSet } from "./use-rows-from-data-set";
import { useCurrent } from "../../../hooks/use-current";
import { useToolbarToolApi } from "../hooks/use-toolbar-tool-api";
import { lightenColor } from "../../../utilities/color-utils";

import "./table-tool.scss";
import { useColumnResize } from "./use-column-resize";
import { useControlsColumn } from "./use-controls-column";

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

  const { userColumnWidths, measureColumnWidth } = useMeasureColumnWidth();

  const { rowHeight, headerHeight, headerRowHeight } = useRowHeight({
    dataSet: dataSet.current, measureColumnWidth, model });

  const handleRequestUniqueTitle = useCallback(() => {
    return onRequestUniqueTitle(modelRef.current.id);
  }, [modelRef, onRequestUniqueTitle]);

  const [showRowLabels, setShowRowLabels] = useState(false);
  const {
    ref: gridRef, gridContext, inputRowId, selectedCell, getSelectedRows, ...gridProps
  } = useGridContext({ modelId: model.id, showRowLabels, triggerColumnChange });

  const rowLabelProps = useRowLabelColumn({
    inputRowId: inputRowId.current, selectedCell, showRowLabels, setShowRowLabels
  });

  const { rows, ...rowProps } = useRowsFromDataSet({
    dataSet: dataSet.current, readOnly: !!readOnly, inputRowId: inputRowId.current,
    rowChanges, context: gridContext});

  const { columns, controlsColumn, columnEditingName, handleSetColumnEditingName } = useColumnsFromDataSet({
    gridContext, dataSet: dataSet.current, metadata, readOnly: !!readOnly, columnChanges, headerHeight, rowHeight,
    ...rowLabelProps, measureColumnWidth });

  const { titleCellWidth, getTitleHeight } =
    useTitleSize({ readOnly, columns, measureColumnWidth, dataSet: dataSet.current });

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
    model, dataSet: dataSet.current, rows, rowHeight, headerHeight, getTitleHeight,
    onRequestRowHeight: handleRequestRowHeight, triggerColumnChange, triggerRowChange
  });
  const { onSetTableTitle, onSetColumnExpressions, onLinkGeometryTile, onUnlinkGeometryTile,
    requestRowHeight, onAddColumn, onRemoveRows } = changeHandlers;

  const { onColumnResize } = useColumnResize({
    columns, userColumnWidths, requestRowHeight, triggerRowChange
  });
  // Finishes setting up the controlsColumn with changeHandlers
  useControlsColumn({ controlsColumn, readOnly: !!readOnly, onAddColumn, onRemoveRows });

  const { getTitle, onBeginTitleEdit, onEndTitleEdit } = useTableTitle({
    gridContext, dataSet: dataSet.current, readOnly,
    onSetTableTitle, onRequestUniqueTitle: handleRequestUniqueTitle, requestRowHeight
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
  useColumnExtensions({
    gridContext, metadata, readOnly, columns, columnEditingName, changeHandlers,
    setColumnEditingName: handleSetColumnEditingName, onShowExpressionsDialog: handleShowExpressionsDialog
  });

  const { hasLinkableRows, ...dataGridProps } = useDataSet({
    gridRef, model, dataSet: dataSet.current, triggerColumnChange, rows, rowChanges, triggerRowChange,
    readOnly: !!readOnly, changeHandlers, columns, onColumnResize, selectedCell, inputRowId });

  const { showLinkButton, isLinkEnabled, linkColors, getLinkIndex, showLinkGeometryDialog } =
    useGeometryLinking({ documentId, model, hasLinkableRows,
                          onRequestTilesOfType, onLinkGeometryTile, onUnlinkGeometryTile });

  const containerRef = useRef<HTMLDivElement>(null);
  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // clear any selection on background click
    (e.target === containerRef.current) && gridContext.onClearSelection();
  };

  const getContentHeight = useCallback(() => {
    return getTableContentHeight({
      readOnly,
      rows,
      rowHeight,
      headerHeight,
      getTitleHeight,
      hasExpressions: getContent().hasExpressions,
      padding: 10 + (modelRef.current.display === "teacher" ? 20 : 0)
    });
  }, [rows, rowHeight, headerHeight, getTitleHeight, getContent, modelRef, readOnly]);
  const exportContentAsTileJson = useCallback(() => {
    return exportTableContentAsJson(getContent().metadata, dataSet.current);
  }, [dataSet, getContent]);
  useToolApi({ content: getContent(), getTitle, getContentHeight, exportContentAsTileJson,
                onRegisterToolApi, onUnregisterToolApi });

  useEffect(() => {
    if (containerRef.current && linkColors) {
      // override the CSS variables controlling selection color for linked tables
      const dataGrid = containerRef.current.getElementsByClassName("rdg")[0] as HTMLDivElement | undefined;
      dataGrid?.style.setProperty("--header-selected-background-color", lightenColor(linkColors.stroke));
      dataGrid?.style.setProperty("--row-selected-background-color", lightenColor(linkColors.fill));
    }
  });

  useEffect(() => {
    const disposer = onSnapshot((model.content as any).dataSet.attributes, () => {
      triggerRowChange();
    });
    return () => disposer();
  });

  const toolbarProps = useToolbarToolApi({ id: model.id, enabled: !readOnly, onRegisterToolApi, onUnregisterToolApi });
  return (
    <div className="table-tool">
      <TableToolbar documentContent={documentContent} toolTile={toolTile} {...toolbarProps}
                    onSetExpression={showExpressionsDialog} scale={scale}/>
      <div className="table-grid-container" ref={containerRef} onClick={handleBackgroundClick}>
        <EditableTableTitle className="table-title" readOnly={readOnly} showLinkButton={showLinkButton}
          isLinkEnabled={isLinkEnabled} getLinkIndex={getLinkIndex} onLinkGeometryClick={showLinkGeometryDialog}
          getTitle={getTitle} titleCellWidth={titleCellWidth} titleCellHeight={getTitleHeight()}
          onBeginEdit={onBeginTitleEdit} onEndEdit={onEndTitleEdit} />
        <ReactDataGrid ref={gridRef} selectedRows={getSelectedRows()} rows={rows} rowHeight={rowHeight}
          headerRowHeight={headerRowHeight()} columns={columns} {...gridProps} {...gridModelProps}
          {...dataGridProps} {...rowProps} />
      </div>
    </div>
  );
});
export default TableToolComponent;
