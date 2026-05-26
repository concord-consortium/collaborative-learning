import { observer } from "mobx-react";
import classNames from "classnames";
import { comparer } from "mobx";
import { onSnapshot } from "mobx-state-tree";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDataGrid from "react-data-grid";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { parse } from "papaparse";
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
import { useGridContext } from "./use-grid-context";
import { useMeasureColumnWidth } from "./use-measure-column-width";
import { useModelDataSet } from "./use-model-data-set";
import { useRowLabelColumn } from "./use-row-label-column";
import { useTableTitle } from "./use-table-title";
import { useToolApi } from "./use-tile-api";
import { useRowHeight } from "./use-row-height";
import { useRowsFromDataSet } from "./use-rows-from-data-set";
import { useCurrent } from "../../../hooks/use-current";
import { useContainerContext } from "../../document/container-context";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import { userSelectTile } from "../../../models/stores/ui";
import { verifyAlive } from "../../../utilities/mst-utils";
import { TSortDirection, addCasesToDataSet } from "../../../models/data/data-set";
import { removeAllAttributes } from "../../../models/data/data-set-utils";
import { gImageMap, ImageMapEntry } from "../../../models/image-map";
import { TileToolbar } from "../../toolbar/tile-toolbar";
import { TableToolbarContext } from "./table-toolbar-context";
import { ITableContext, TableContext } from "../hooks/table-context";
import { useUIStore } from "../../../hooks/use-stores";
import { RowDragOverlay } from "./row-drag-overlay";
import { TRow } from "./table-types";
import { useFormulaModal } from "./use-formula-modal";
import { useClueAccessibility } from "../../../hooks/use-clue-accessibility";
import {
  createBodyTabHandler,
  createBodyEscapeHandler,
  createBodyFocusContent,
} from "./keyboard-nav";

import "react-data-grid/lib/styles.css";
import "./table-tile.scss";
import "./table-toolbar-registration";
import { mstReaction } from "../../../utilities/mst-reaction";

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
  const linkedTiles = content.tileEnv?.sharedModelManager?.getSharedModelTiles(content.sharedModel);
  const isLinked = linkedTiles && linkedTiles.length > 1;
  const tableContextValue: ITableContext = { linked: !!isLinked };
  const [gridElement, setGridElement] = useState<HTMLDivElement | null>(null);

  // Basic operations based on the model
  const {
    dataSet, columnChanges, triggerColumnChange, rowChanges, triggerRowChange, ...gridModelProps
  } = useModelDataSet(model, content);

  // Forces the table to rerender when its dataset's selection changes
  useEffect(() => {
    triggerRowChange();
    dataSet.selectionIdString; // eslint-disable-line @typescript-eslint/no-unused-expressions
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

  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const isBackgroundPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    return e.target === containerRef.current || e.target === gridRef.current?.element;
  }, [gridRef, containerRef]);

  const containerContext = useContainerContext();
  const handleTilePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {

    const backgroundClick = isBackgroundPointerDown(e);

    // Clear selection when the user presses on the background. We use
    // `pointerdown` (capture phase) rather than `click` because:
    //   - The cell's own pointerdown handler may trigger a React re-render that
    //     replaces the cell DOM, leaving the subsequent `click` event's target
    //     falling through to `.rdg` — which would look like a background click.
    //     Pointerdown's target is reliable because it fires before any
    //     state-update-driven re-render.
    //   - dnd-kit's PointerSensor (registered on draggable index cells) can
    //     suppress the natural follow-up `click` event entirely, so a
    //     click-based handler is unreliable from the other direction too.
    // Capture phase is used so cell wrappers' `e.stopPropagation()` (on
    // bubble-phase pointerdown) doesn't prevent this from firing — we want to
    // see every pointerdown's actual target.
    if (backgroundClick) {
      gridContext.onClearSelection();
    }

    // Tile-selection management.
    // We manage our own tile selection by setting tileHandlesOwnSelection=true in
    // the tile registration so we can prevent deselection from click+modifiers.
    // We only allow tile deselection if the click is on the background of the tile.
    // Note: `append` actually means "deselect" if the tile is already selected and
    // a modifier key is pressed.
    const willDeselectTile = ui.isSelectedTile(model) && hasSelectionModifier(e);
    if (backgroundClick || !willDeselectTile) {
      userSelectTile(ui, model, {
        readOnly,
        append: hasSelectionModifier(e),
        container: containerContext.model
      });
    }
  }, [ui, model, readOnly, containerContext.model, isBackgroundPointerDown, gridContext]);

  // React components used for the index (left most) column
  // setHoveredRowId is kept (called by row-label pointer handlers and drag-end
  // cleanup) but the value is unused now that drag-indicator visibility is
  // controlled entirely by CSS `:hover`. Eliminating the state entirely would
  // require ripping out the pointerover/leave handlers and drag-end cleanups —
  // left as-is to keep this diff focused on the bug fix.
  const [, setHoveredRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const rowLabelProps = useRowLabelColumn({
    inputRowId: inputRowId.current, showRowLabels, setShowRowLabels, setHoveredRowId, dragOverRowId,
    setDragOverRowId, rowHeight, gridElement
  });

  // rows are required by ReactDataGrid and are used by other hooks as well
  // rowProps are expanded and passed to ReactDataGrid
  const { rows, ...rowProps } = useRowsFromDataSet({
    dataSet, isLinked, readOnly: !!readOnly, inputRowId: inputRowId.current,
    rowChanges, context: gridContext, selectedCaseIds });

  const onSort = useCallback((columnKey: string, direction: TSortDirection) => {
    if (dataSet) {
      dataSet.sortCases(columnKey, direction);
      // Force columns to regenerate so the sort indicator re-renders. Without this,
      // the columns useMemo deps don't change (sort state isn't tracked there), so
      // ReactDataGrid sees the same columns prop and React.memo on rdg's HeaderRow
      // bails the cascade — the sort icon stays on the old direction until something
      // else (e.g. deselecting the column) regenerates columns.
      triggerColumnChange();
    }
  }, [dataSet, triggerColumnChange]);

  // columns are required by ReactDataGrid and are used by other hooks as well
  const { columns, controlsColumn, columnEditingName, handleSetColumnEditingName } = useColumnsFromDataSet({
    gridContext, dataSet, isLinked, content, readOnly: !!readOnly, columnChanges, headerHeight, rowHeight,
    ...rowLabelProps, showRowLabels, measureColumnWidth, lookupImage, onSort,
  });

  // Keep columns/rows accessible to keyboard-nav handlers without triggering re-renders.
  // selectedCellRef is sourced from useDataSet (destructured below as selectedCell).
  const columnsRef = useRef(columns);
  const rowsRef = useRef(rows);
  useEffect(() => { columnsRef.current = columns; }, [columns]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  // Map of attrId -> width to drive react-data-grid via its `columnWidths` prop.
  // CODAP's rdg patch consults this before its internal resize cache, so CLUE
  // remains the source of truth for column widths.
  const columnWidths = useMemo(() => {
    rowChanges; // eslint-disable-line @typescript-eslint/no-unused-expressions
    const widths = new Map<string, number>();
    dataSet.attributes.forEach(attr => {
      widths.set(attr.id, measureColumnWidth(attr));
    });
    return widths;
  // MST keeps `dataSet.attributes` array-identity stable across add/remove,
  // so depending on `dataSet` alone won't fire this memo on column changes —
  // `.length` is the actual mutation signal. react-hooks/exhaustive-deps
  // doesn't model MST and considers `.length` redundant, hence the disable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSet, dataSet.attributes.length, measureColumnWidth, rowChanges]);

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
  const { onSetTableTitle, requestRowHeight,
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
  const handleFormulaModalSubmit = () => {
    // This is necessary to trigger a rerender of the table when the expression changes.
    // Even though this is an observing component and the formula is an observable,
    // that isn't enough. When the expression changes that just updates the appData of the
    // existing columns, and the RDG component is just looking at the columns object reference.
    // The trigger causes a whole new columns object to be created, which causes RDG to rerender.
    triggerColumnChange();
  };

  const [showExpressionsDialog, , setCurrYAttrId] = useFormulaModal({
    table: content, dataSet, onSubmit: handleFormulaModalSubmit
  });
  const handleShowExpressionsDialog = (attrId?: string) => {
    attrId && setCurrYAttrId(attrId);
    showExpressionsDialog();
  };

  const handleToolbarShowExpressionsDialog = () => {
    // This is called from the toolbar. We use the first selected attribute of the table.
    const firstSelectedAttributeId = dataSet.firstSelectedAttributeId;
    firstSelectedAttributeId && setCurrYAttrId(firstSelectedAttributeId);
    showExpressionsDialog();
  };

  // Expands the columns with additional data and callbacks
  useColumnExtensions({
    gridContext, dataSet, readOnly, columns, rows, columnEditingName, changeHandlers,
    setColumnEditingName: handleSetColumnEditingName, onShowExpressionsDialog: handleShowExpressionsDialog
  });

  // deleteSelected is a function that clears the value of the currently selected cell
  // dataGridProps contains callbacks to pass to ReactDataGrid
  // selectedCell tracks the currently selected cell position (used by keyboard-nav)
  const { deleteSelected, selectedCell: selectedCellRef, ...dataGridProps } = useDataSet({
    dataSet, triggerColumnChange, triggerRowChange,
    readOnly: !!readOnly, changeHandlers, columns, onColumnResize, inputRowId, lookupImage });

  const importData = (file: File) => {
    if (file) {
      const isCSV = file.type === "text/csv" || file.name.toLowerCase().endsWith('.csv');

      const addAttributesAndCases = (cases: Record<string, string>[]) => {
        if (!cases.length) return;
        const headers = Object.keys(cases[0]);
        headers.forEach(header => {
          if (!dataSet.attrNameMap[header]) {
            dataSet.addAttributeWithID({ name: header });
          }
        });
        addCasesToDataSet(dataSet, cases);
      };

      const reader = new FileReader();
      reader.onload = (e) => {
        if (isCSV) {
          parse(file, {
            header: true,
            complete: (results) => {
              const data = results.data as Record<string, string>[];
              if (data.length > 0) {
                if (dataSet.cases.length === 0) {
                  removeAllAttributes(dataSet);
                }
                addAttributesAndCases(data);
                triggerRowChange();
                content.logChange({
                  action: "import-data",
                  target: "table"
                });
              }
            },
            error: (err) => {
              console.error("Error parsing CSV file:", err);
            }
          });
        }
      };
      reader.readAsText(file);
    }
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

  // Compute the tile API for table-specific functionality (height, export, annotations).
  // Passed as additionalApi to useClueAccessibility so it is part of the unified registration.
  const padding = 10 + (modelRef.current.display === "teacher" ? 20 : 0);
  const tableApi = useToolApi({
    columns, content: getContent(), dataSet, getTitleHeight, headerHeight,
    measureColumnWidth, padding, readOnly, rowHeight, rows
  });

  // Keyboard-nav helpers for the focus trap content slot. The grid covers the
  // header row and body rows in one slot; RDG's navigate() handles header↔body
  // transitions and the trap only intercepts at the very edges of the grid.
  const bodyDeps = { gridRef, selectedCellRef, columnsRef, rowsRef };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bodyTabHandler = useMemo(() => createBodyTabHandler(bodyDeps), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bodyEscapeHandler = useMemo(() => createBodyEscapeHandler(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bodyFocusContent = useMemo(() => createBodyFocusContent(bodyDeps), []);

  // Register the tile API and wire the focus trap via a single useClueAccessibility call.
  useClueAccessibility({
    type: "tile",
    focusTrap: {
      onRegisterTileApi,
      onUnregisterTileApi,
      tileType: "table",
      titleRef,
      getContentElement: () => gridRef.current?.element ?? undefined,
      focusContent: bodyFocusContent,
      tabHandlers: { content: bodyTabHandler },
      escapeHandlers: { content: bodyEscapeHandler },
      additionalApi: tableApi,
    },
  });

  useEffect(() => {
    if (gridRef.current?.element) {
      setGridElement(gridRef.current.element);
    }
  }, [gridRef]);

  // Force a rerender whenever the model's attributes change (which contain the individual cells)
  useEffect(() => {
    const disposer = onSnapshot((model.content as any).dataSet.attributes, () => {
      triggerRowChange();
    });
    return () => disposer();
  });

  // Recompute columns when an attribute's name changes (e.g. via undo/redo), since
  // the columns useMemo doesn't observe individual attribute name properties.
  useEffect(() => {
    const disposer = mstReaction(
      () => dataSet.attributes.map(attr => attr.name),
      () => triggerColumnChange(),
      { equals: comparer.structural, name: `TableToolComponent.attributeNameReaction` },
      dataSet
    );
    return () => disposer();
  }, [dataSet, triggerColumnChange]);

  useEffect(() => {
    const disposer = onSnapshot(content.columnWidths, () => {
      triggerColumnChange();
    });
    return () => disposer();
  }, [content, triggerColumnChange]);

  // Currently this is recreated on each render, so the ToolbarContext is changed
  // on each render. deleteSelected is changed on each render, so a useMemo
  // here would not help the situation. I think an object that is managing
  // the internal state of the component would be a better way to factor
  // all of the use* calls above.
  const toolbarContext = {
    showExpressionsDialog: handleToolbarShowExpressionsDialog,
    deleteSelected,
    importData
  };

  const classes = classNames("tile-content", "table-tool", {
    hovered,
    selected: ui.isSelectedTile(model),
  });

  return (
    <div className={classes} onPointerDownCapture={handleTilePointerDown}>
      <TableToolbarContext.Provider value={toolbarContext}>
        <TileToolbar
          tileType="table"
          readOnly={!!readOnly}
          tileElement={tileElt}
        />
      </TableToolbarContext.Provider>
      <TableContext.Provider value={tableContextValue}>
        <div className="table-grid-container" ref={containerRef}>
          <div ref={titleRef} style={{ display: "contents" }}>
            <EditableTableTitle
              model={model}
              className={`table-title ${showRowLabels ? "show-row-labels" : ""}`}
              readOnly={readOnly}
              titleCellWidth={titleCellWidth}
              titleCellHeight={getTitleHeight()}
              onBeginEdit={onBeginTitleEdit}
              onEndEdit={onEndTitleEdit} />
          </div>
          <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
            <ReactDataGrid ref={gridRef} selectedRows={selectedCaseIds} rows={rows}
              rowHeight={(row) => rowHeight({ row, type: "ROW" })}
              headerRowHeight={headerRowHeight()} columns={columns} columnWidths={columnWidths}
              {...gridProps} {...gridModelProps} {...dataGridProps} {...rowProps} />
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
