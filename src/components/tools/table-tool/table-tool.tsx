import { observer } from "mobx-react";
import { onSnapshot } from "mobx-state-tree";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDataGrid from "react-data-grid";
import { getTableContentHeight, TableContentModelType } from "../../../models/tools/table/table-content";
import { exportTableContentAsJson } from "../../../models/tools/table/table-export";
import { defaultBoldFont } from "../../constants";
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
  const measureHeaderText = useMeasureText(defaultBoldFont);
  const { getTitle, onBeginTitleEdit, onEndTitleEdit } = useTableTitle({
    gridContext, dataSet: dataSet.current, readOnly,
    onSetTableTitle, onRequestUniqueTitle: handleRequestUniqueTitle
  });

  const exportContentAsTileJson = useCallback(() => {
    return exportTableContentAsJson(getContent().metadata, dataSet.current);
  }, [dataSet, getContent]);
  useToolApi({ content: getContent(), getTitle, getContentHeight, exportContentAsTileJson,
                onRegisterToolApi, onUnregisterToolApi });

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
          getTitle={getTitle} titleCellWidth={titleCellWidth}
          onBeginEdit={onBeginTitleEdit} onEndEdit={onEndTitleEdit} />
        <ReactDataGrid ref={gridRef} selectedRows={getSelectedRows()}
          {...gridProps} {...gridModelProps} {...dataGridProps} />
      </div>
    </div>
  );
});
export default TableToolComponent;
