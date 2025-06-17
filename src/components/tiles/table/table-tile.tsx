import { observer } from "mobx-react";
import classNames from "classnames";
import { onSnapshot } from "mobx-state-tree";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDataGrid from "react-data-grid";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { TableContentModelType } from "../../../models/tiles/table/table-content";
import { ITileProps } from "../tile-component";
import { EditableTableTitle } from "./editable-table-title";
import { useColumnsFromDataSet } from "./use-columns-from-data-set";
import { useTitleSize } from "./use-title-size";
import { useColumnExtensions } from "./use-column-extensions";
import { useColumnResize } from "./use-column-resize";
import { useContentChangeHandlers } from "./use-content-change-handlers";
import { useControlsColumn } from "./use-controls-column";
import { useDataSet } from "./use-data-set";
import { useExpressionsDialog } from "./use-expressions-dialog";
import { useGridContext } from "./use-grid-context";
import { useMeasureColumnWidth } from "./use-measure-column-width";
import { useModelDataSet } from "./use-model-data-set";
import { useRowLabelColumn } from "./use-row-label-column";
import { useTableTitle } from "./use-table-title";
import { useToolApi } from "./use-tile-api";
import { useRowHeight } from "./use-row-height";
import { useRowsFromDataSet } from "./use-rows-from-data-set";
import { useCurrent } from "../../../hooks/use-current";
import { verifyAlive } from "../../../utilities/mst-utils";
import { gImageMap, ImageMapEntry } from "../../../models/image-map";
import { TileToolbar } from "../../toolbar/tile-toolbar";
import { TableToolbarContext } from "./table-toolbar-context";
import { ITableContext, TableContext } from "../hooks/table-context";
import { useUIStore } from "../../../hooks/use-stores";
import { RowDragOverlay } from "./row-drag-overlay";
import { TRow } from "./table-types";

import "./table-tile.scss";
import "./table-toolbar-registration";

export interface SortColumn {
  columnKey: string;
  direction: 'ASC' | 'DESC';
}

// observes row selection from shared selection store
const TableToolComponent: React.FC<ITileProps> = observer(function TableToolComponent({
  documentContent, tileElt, model, readOnly, height, hovered, scale,
  onRequestRowHeight, onRegisterTileApi, onUnregisterTileApi
}) {
  // Gather data from the model
  const modelRef = useCurrent(model);
  const ui = useUIStore();
  const getContent = useCallback(() => modelRef.current.content as TableContentModelType, [modelRef]);
  const content = useMemo(() => getContent(), [getContent]);
  const imagePromises = useMemo(() => new Map<string, Promise<ImageMapEntry>>(), []);
  const [imageUrls, setImageUrls] = useState(new Map<string,string>());
  verifyAlive(content, "TableToolComponent");
  const metadata = getContent().metadata;
  const linkedTiles = content.tileEnv?.sharedModelManager?.getSharedModelTiles(content.sharedModel);
  const isLinked = linkedTiles && linkedTiles.length > 1;
  const tableContextValue: ITableContext = { linked: !!isLinked };
  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
  const [gridElement, setGridElement] = useState<HTMLDivElement | null>(null);

  // Basic operations based on the model
  const {
    dataSet, columnChanges, triggerColumnChange, rowChanges, triggerRowChange, ...gridModelProps
  } = useModelDataSet(model, content);

  // Forces the table to rerender when its dataset's selection changes
  useEffect(() => {
    triggerRowChange();
    dataSet.selectionIdString; // eslint-disable-line no-unused-expressions
  }, [dataSet.selectionIdString, triggerRowChange]);

  // Set up user specified columns and function to measure a column
  const { measureColumnWidth, resizeColumn, resizeColumnWidth } = useMeasureColumnWidth({ content });

  // Functions for determining the height of rows, including the header
  // These require knowledge of the column widths
  const { rowHeight, headerHeight, headerRowHeight } = useRowHeight({
    dataSet, measureColumnWidth, model });

  // Functions and variables to handle selecting and navigating the grid
  const [showRowLabels, setShowRowLabels] = useState(false);
  const {ref: gridRef, gridContext, inputRowId, getSelectedRows, ...gridProps
    } = useGridContext({ content, modelId: model.id, showRowLabels, triggerColumnChange, triggerRowChange });
  const selectedCaseIds = getSelectedRows();

  // Add click handler to clear all selections to mystery div in rdg.
  // This allows the user to clear the selection by clicking under the table.
  useEffect(() => {
    if (gridRef.current?.element?.children) {
      const rdgDiv = gridRef.current.element.children[2];
      if (rdgDiv) {
        rdgDiv.addEventListener("click", () => gridContext.onClearSelection());
      }
    }
  }, [gridContext, gridRef]);

  // Maintains the cache of data values that map to image URLs.
  // For use in a synchronous context, returns undefined immediately if an image is not yet cached,
  // and then looks it up in the background, adds to cache, and updates state to force a refresh.
  const lookupImage = useCallback((value: string) => {
    if (gImageMap.isImageUrl(value)) {
      let imagePromise = imagePromises.get(value);
      if (!imagePromise) {
        imagePromise = gImageMap.getImage(value);
        imagePromises.set(value, imagePromise);
        imagePromise.then((image) => {
          if (image && image.displayUrl) {
            // This state changes triggers a re-render
            setImageUrls(urls => new Map(urls).set(value, image.displayUrl));
          }
        });
      }
      return imageUrls.get(value);
    }
  }, [imagePromises, imageUrls]);

  // React components used for the index (left most) column
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const rowLabelProps = useRowLabelColumn({
    inputRowId: inputRowId.current, showRowLabels, setShowRowLabels, hoveredRowId, setHoveredRowId, dragOverRowId,
    setDragOverRowId, rowHeight, gridElement
  });

  // rows are required by ReactDataGrid and are used by other hooks as well
  // rowProps are expanded and passed to ReactDataGrid
  const { rows, ...rowProps } = useRowsFromDataSet({
    dataSet, isLinked, readOnly: !!readOnly, inputRowId: inputRowId.current,
    rowChanges, context: gridContext, selectedCaseIds });

  const onSort = useCallback((columnKey: string, direction: "ASC" | "DESC" | "NONE") => {
    if (direction === "NONE") {
      setSortColumns([]);
    } else {
      setSortColumns([{ columnKey, direction }]);
      dataSet.sortByAttribute(columnKey, direction);
    }
  }, [dataSet]);

  // columns are required by ReactDataGrid and are used by other hooks as well
  const { columns, controlsColumn, columnEditingName, handleSetColumnEditingName } = useColumnsFromDataSet({
    gridContext, dataSet, isLinked, metadata, readOnly: !!readOnly, columnChanges, headerHeight, rowHeight,
    ...rowLabelProps, showRowLabels, measureColumnWidth, lookupImage,
    sortColumns,
    onSort,
  });

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
    gridContext, model, content, readOnly,
    onSetTableTitle, requestRowHeight
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
    gridContext, metadata, readOnly, columns, rows, columnEditingName, changeHandlers,
    setColumnEditingName: handleSetColumnEditingName, onShowExpressionsDialog: handleShowExpressionsDialog
  });

  // deleteSelected is a function that clears the value of the currently selected cell
  // dataGridProps contains callbacks to pass to ReactDataGrid
  // hasLinkableRows is used to determine if the table can meaningfully be linked to a geometry tile
  const { deleteSelected, ...dataGridProps } = useDataSet({
    gridRef, model, dataSet, triggerColumnChange, rows, rowChanges, triggerRowChange,
    readOnly: !!readOnly, changeHandlers, columns, onColumnResize, inputRowId, lookupImage });

  const containerRef = useRef<HTMLDivElement>(null);
  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // clear any selection on background click
    (e.target === containerRef.current) && gridContext.onClearSelection();
  };

  const [activeRow, setActiveRow] = useState<TRow | null>(null);
  const pointerSensor = useSensor(PointerSensor, {activationConstraint: { distance: 3 }});
  const sensors = useSensors(pointerSensor);
  const handleDragStart = (event: any) => {
    const { active } = event;
    const row = rows.find(r => r.__id__ === active.id);
    if (!row) {
      console.warn("Drag started on an invalid row:", active.id);
      return;
    }
    setActiveRow(row || null);
    gridContext.onClearSelection();
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) {
      setActiveRow(null);
      setDragOverRowId(null);
      setHoveredRowId(null);
      return;
    }

    const [overId, position] = over.id.split(":");
    const fromIndex = dataSet.caseIndexFromID(active.id);
    let toIndex = dataSet.caseIndexFromID(overId);
    if (fromIndex === -1 || toIndex === -1) {
      console.warn("Invalid drag and drop indices:", fromIndex, toIndex);
      setActiveRow(null);
      setDragOverRowId(null);
      setHoveredRowId(null);
      return;
    }

    // Adjust for dropping "after"
    if (position === "after") {
      toIndex += 1;
    }

    // If moving down, and dropping after, need to account for removal of the row
    if (fromIndex < toIndex) {
      toIndex -= 1;
    }
    setActiveRow(null);

    if (fromIndex !== toIndex && fromIndex !== -1 && toIndex !== -1) {
      dataSet.moveCase(active.id, toIndex);
    }

    setDragOverRowId(null);
    setHoveredRowId(null);
  };

  // Define and submit functions for general tool tile API
  const padding = 10 + (modelRef.current.display === "teacher" ? 20 : 0);
  useToolApi({
    columns, content: getContent(), dataSet, getTitleHeight, headerHeight,
    measureColumnWidth, onRegisterTileApi, onUnregisterTileApi, padding, readOnly, rowHeight, rows
  });

  useEffect(() => {
    if (gridRef.current?.element) {
      setGridElement(gridRef.current.element);
    }
    if (containerRef.current) {
      // override the CSS variables controlling selection color for linked tables
      const dataGrid = containerRef.current.getElementsByClassName("rdg")[0] as HTMLDivElement | undefined;
      dataGrid?.style.setProperty("--header-selected-background-color", "rgba(0,0,0,0)");
      dataGrid?.style.setProperty("--row-selected-background-color", "rgba(0,0,0,0)");
    }
  }, [gridRef, containerRef]);

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

  // Currently this is recreated on each render, so the ToolbarContext is changed
  // on each render. deleteSelected is changed on each render, so a useMemo
  // here would not help the situation. I think an object that is managing
  // the internal state of the component would be a better way to factor
  // all of the use* calls above.
  const toolbarContext = {
    showExpressionsDialog,
    deleteSelected,
  };

  const classes = classNames("tile-content", "table-tool", {
    hovered,
    selected: ui.isSelectedTile(model),
  });

  return (
    <div className={classes}>
      <TableToolbarContext.Provider value={toolbarContext}>
        <TileToolbar
          tileType="table"
          readOnly={!!readOnly}
          tileElement={tileElt}
        />
      </TableToolbarContext.Provider>
      <TableContext.Provider value={tableContextValue}>
        <div className="table-grid-container" ref={containerRef} onClick={handleBackgroundClick}>
          <EditableTableTitle
            model={model}
            className={`table-title ${showRowLabels ? "show-row-labels" : ""}`}
            readOnly={readOnly}
            titleCellWidth={titleCellWidth}
            titleCellHeight={getTitleHeight()}
            onBeginEdit={onBeginTitleEdit}
            onEndEdit={onEndTitleEdit} />
          <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
            <ReactDataGrid ref={gridRef} selectedRows={selectedCaseIds} rows={rows} rowHeight={rowHeight}
              headerRowHeight={headerRowHeight()} columns={columns} {...gridProps} {...gridModelProps}
              {...dataGridProps} {...rowProps} />
            <DragOverlay>
              {activeRow ? (
                <RowDragOverlay row={activeRow} columns={columns} rowHeight={rowHeight} showRowLabels={showRowLabels}/>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </TableContext.Provider>
    </div>
  );
});
export default TableToolComponent;
