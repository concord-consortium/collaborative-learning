import { observer } from "mobx-react";
import { onSnapshot } from "mobx-state-tree";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDataGrid from "react-data-grid";

import { TableContentModelType } from "../../../models/tiles/table/table-content";
import { ITileProps } from "../tile-component";
import { EditableTableTitle } from "./editable-table-title";
import { TableToolbar } from "./table-toolbar";
import { useColumnsFromDataSet } from "./use-columns-from-data-set";
import { useTitleSize } from "./use-title-size";
import { useColumnExtensions } from "./use-column-extensions";
import { useColumnResize } from "./use-column-resize";
import { useContentChangeHandlers } from "./use-content-change-handlers";
import { useControlsColumn } from "./use-controls-column";
import { useDataSet } from "./use-data-set";
import { useExpressionsDialog } from "./use-expressions-dialog";
import { useConsumerTileLinking } from "../../../hooks/use-consumer-tile-linking";
import { useGridContext } from "./use-grid-context";
import { useMeasureColumnWidth } from "./use-measure-column-width";
import { useModelDataSet } from "./use-model-data-set";
import { useRowLabelColumn } from "./use-row-label-column";
import { useTableTitle } from "./use-table-title";
import { useToolApi } from "./use-tile-api";
import { useRowHeight } from "./use-row-height";
import { useRowsFromDataSet } from "./use-rows-from-data-set";
import { useCurrent } from "../../../hooks/use-current";
import { useToolbarTileApi } from "../hooks/use-toolbar-tile-api";
import { lightenColor } from "../../../utilities/color-utils";
import { verifyAlive } from "../../../utilities/mst-utils";
import { gImageMap } from "../../../models/image-map";

import "./table-tile.scss";

// observes row selection from shared selection store
const TableToolComponent: React.FC<ITileProps> = observer(function TableToolComponent({
  documentId, documentContent, tileElt, model, readOnly, height, scale,
  onRequestRowHeight, onRequestTilesOfType, onRequestLinkableTiles, onRequestUniqueTitle,
  onRegisterTileApi, onUnregisterTileApi
}) {
  // Gather data from the model
  const modelRef = useCurrent(model);
  const getContent = useCallback(() => modelRef.current.content as TableContentModelType, [modelRef]);
  const content = useMemo(() => getContent(), [getContent]);
  const [imageUrls, setImageUrls] = useState(new Map<string,string>());
  verifyAlive(content, "TableToolComponent");
  const metadata = getContent().metadata;

  // Basic operations based on the model
  const {
    dataSet, columnChanges, triggerColumnChange, rowChanges, triggerRowChange, ...gridModelProps
  } = useModelDataSet(model, content);

  // Set up user specified columns and function to measure a column
  const { measureColumnWidth, resizeColumn, resizeColumnWidth } = useMeasureColumnWidth({ content });

  // Functions for determining the height of rows, including the header
  // These require knowledge of the column widths
  const { rowHeight, headerHeight, headerRowHeight } = useRowHeight({
    dataSet, measureColumnWidth, model });

  // A function to generate a unique title for the tile
  // TODO The table tile should switch to the new CLUE wide method of determining titles, and this should be removed
  const handleRequestUniqueTitle = useCallback(() => {
    return onRequestUniqueTitle(modelRef.current.id);
  }, [modelRef, onRequestUniqueTitle]);

  // Functions and variables to handle selecting and navigating the grid
  const [showRowLabels, setShowRowLabels] = useState(false);
  const {
    ref: gridRef, gridContext, inputRowId, selectedCell, getSelectedRows, ...gridProps
  } = useGridContext({ modelId: model.id, showRowLabels, triggerColumnChange });

  // Maintains the cache of data values that map to image URLs.
  // For use in a synchronous context, returns undefined immediately if an image is not yet cached,
  // and then looks it up in the background, adds to cache, and updates state to force a refresh.
  const lookupImage = useCallback((value: string) => {
    if (gImageMap.isImageUrl(value)) {
      const cached = imageUrls.get(value);
      if (cached) {
        return cached;
      }
      gImageMap.getImage(value).then((image) => {
        if (image && image.displayUrl) {
          // This state changes forces a re-render - is that good?
          setImageUrls(new Map(imageUrls).set(value, image.displayUrl));
        }
      });
      return undefined;
    }
  }, [imageUrls]);

  // React components used for the index (left most) column
  const rowLabelProps = useRowLabelColumn({
    inputRowId: inputRowId.current, selectedCell, showRowLabels, setShowRowLabels
  });

  // rows are required by ReactDataGrid and are used by other hooks as well
  // rowProps are expanded and passed to ReactDataGrid
  const { rows, ...rowProps } = useRowsFromDataSet({
    dataSet, readOnly: !!readOnly, inputRowId: inputRowId.current,
    rowChanges, context: gridContext});

  // columns are required by ReactDataGrid and are used by other hooks as well
  const { columns, controlsColumn, columnEditingName, handleSetColumnEditingName } = useColumnsFromDataSet({
    gridContext, dataSet, metadata, readOnly: !!readOnly, columnChanges, headerHeight, rowHeight,
    ...rowLabelProps, measureColumnWidth, lookupImage});

  // The size of the title bar
  const { titleCellWidth, getTitleHeight } =
    useTitleSize({ readOnly, columns, measureColumnWidth, dataSet, rowChanges });

  // A function to update the height of the tile based on the content size
  const heightRef = useCurrent(height);
  const handleRequestRowHeight = useCallback((options: { height?: number, deltaHeight?: number }) => {
    // increase row height automatically but require manual shrinking
    if (!heightRef.current ||
        (options?.height && (options.height > heightRef.current)) ||
        (options?.deltaHeight && (options.deltaHeight > 0))) {
      onRequestRowHeight(modelRef.current.id, options?.height, options?.deltaHeight);
    }
  }, [heightRef, modelRef, onRequestRowHeight]);

  // Various callbacks to use when the table needs to be modified
  const changeHandlers = useContentChangeHandlers({
    model, dataSet, rows, rowHeight, headerHeight, getTitleHeight,
    onRequestRowHeight: handleRequestRowHeight, triggerColumnChange, triggerRowChange
  });
  const { onSetTableTitle, onSetColumnExpressions, requestRowHeight,
          onAddColumn, onRemoveRows } = changeHandlers;

  // A function to call when a column needs to change width
  const { onColumnResize } = useColumnResize({
    columns, content, requestRowHeight, resizeColumn, resizeColumnWidth, triggerRowChange
  });
  // Finishes setting up the controlsColumn with changeHandlers (which weren't defined when controlColumn was created)
  useControlsColumn({ controlsColumn, readOnly: !!readOnly, onAddColumn, onRemoveRows, triggerColumnChange });

  // Functions for getting and modifying the title
  const { onBeginTitleEdit, onEndTitleEdit } = useTableTitle({
    gridContext, content, readOnly,
    onSetTableTitle, onRequestUniqueTitle: handleRequestUniqueTitle, requestRowHeight
  });

  // Functions for setting and displaying expressions
  const handleSubmitExpressions = (expressions: Map<string, string>) => {
    if (dataSet.attributes.length && expressions.size) {
      onSetColumnExpressions(expressions, dataSet.attributes[0].name);
    }
  };
  const [showExpressionsDialog, , setCurrYAttrId] = useExpressionsDialog({
    metadata, dataSet, onSubmit: handleSubmitExpressions
  });
  const handleShowExpressionsDialog = (attrId?: string) => {
    attrId && setCurrYAttrId(attrId);
    showExpressionsDialog();
  };

  // Expands the columns with additional data and callbacks
  useColumnExtensions({
    gridContext, metadata, readOnly, columns, columnEditingName, changeHandlers,
    setColumnEditingName: handleSetColumnEditingName, onShowExpressionsDialog: handleShowExpressionsDialog
  });

  // deleteSelected is a function that clears the value of the currently selected cell
  // dataGridProps contains callbacks to pass to ReactDataGrid
  // hasLinkableRows is used to determine if the table can meaningfully be linked to a geometry tile
  const { deleteSelected, hasLinkableRows, ...dataGridProps } = useDataSet({
    gridRef, model, dataSet, triggerColumnChange, rows, rowChanges, triggerRowChange,
    readOnly: !!readOnly, changeHandlers, columns, onColumnResize, selectedCell, inputRowId, lookupImage });

  // Variables for handling linking to geometry tiles
  const { isLinkEnabled, linkColors, getLinkIndex, showLinkTileDialog } =
    useConsumerTileLinking({ documentId, model, hasLinkableRows,
                          onRequestTilesOfType, onRequestLinkableTiles });

  const containerRef = useRef<HTMLDivElement>(null);
  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // clear any selection on background click
    (e.target === containerRef.current) && gridContext.onClearSelection();
  };

  // Define and submit functions for general tool tile API
  const padding = 10 + (modelRef.current.display === "teacher" ? 20 : 0);
  useToolApi({
    columns, content: getContent(), dataSet, getTitleHeight, headerHeight,
    measureColumnWidth, onRegisterTileApi, onUnregisterTileApi, padding, readOnly, rowHeight, rows
  });

  useEffect(() => {
    if (containerRef.current && linkColors) {
      // override the CSS variables controlling selection color for linked tables
      const dataGrid = containerRef.current.getElementsByClassName("rdg")[0] as HTMLDivElement | undefined;
      dataGrid?.style.setProperty("--header-selected-background-color", lightenColor(linkColors.stroke));
      dataGrid?.style.setProperty("--row-selected-background-color", lightenColor(linkColors.fill));
    }
  });

  // Force a rerender whenever the model's attributes change (which contain the individual cells)
  useEffect(() => {
    const disposer = onSnapshot((model.content as any).dataSet.attributes, () => {
      triggerRowChange();
    });
    return () => disposer();
  });

  useEffect(() => {
    const disposer = onSnapshot(content.columnWidths, () => {
      triggerRowChange();
    });
    return () => disposer();
  });

  const toolbarProps = useToolbarTileApi({ id: model.id, enabled: !readOnly, onRegisterTileApi, onUnregisterTileApi });
  return (
    <div className="table-tool">
      <TableToolbar
        documentContent={documentContent}
        tileElt={tileElt}
        {...toolbarProps}
        deleteSelected={deleteSelected}
        onSetExpression={showExpressionsDialog}
        scale={scale}
        isLinkEnabled={isLinkEnabled}
        getLinkIndex={getLinkIndex}
        showLinkDialog={showLinkTileDialog}
      />
      <div className="table-grid-container" ref={containerRef} onClick={handleBackgroundClick}>
        <EditableTableTitle
          content={content}
          className="table-title"
          readOnly={readOnly}
          showLinkButton={true}
          isLinkEnabled={isLinkEnabled}
          getLinkIndex={getLinkIndex}
          onLinkGeometryClick={showLinkTileDialog}
          titleCellWidth={titleCellWidth}
          titleCellHeight={getTitleHeight()}
          onBeginEdit={onBeginTitleEdit}
          onEndEdit={onEndTitleEdit} />
        <ReactDataGrid ref={gridRef} selectedRows={getSelectedRows()} rows={rows} rowHeight={rowHeight}
          headerRowHeight={headerRowHeight()} columns={columns} {...gridProps} {...gridModelProps}
          {...dataGridProps} {...rowProps} />
      </div>
    </div>
  );
});
export default TableToolComponent;
