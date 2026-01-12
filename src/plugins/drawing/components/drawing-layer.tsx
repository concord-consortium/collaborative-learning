import React from "react";
import { isAlive, getSnapshot } from "mobx-state-tree";
import { MobXProviderContext, observer } from "mobx-react";
import { extractDragTileType, kDragTileContent } from "../../../components/tiles/tile-component";
import { DrawingContentModelType } from "../model/drawing-content";
import { ITileModel } from "../../../models/tiles/tile-model";
import { safeJsonParse } from "../../../utilities/js-utils";
import { ImageContentSnapshotOutType } from "../../../models/tiles/image/image-content";
import { gImageMap } from "../../../models/image-map";
import { SelectionBox } from "./selection-box";
import { DrawingObjectSnapshotForAdd, DrawingObjectType, DrawingTool,
  HandleObjectHover,
  IDrawingLayer} from "../objects/drawing-object";
import { BoundingBox, Point, ToolbarSettings } from "../model/drawing-basic-types";
import { getDrawingToolInfos, renderDrawingObject } from "./drawing-object-manager";
import { ImageObject } from "../objects/image";
import { debounce } from "lodash";
import { combineBoundingBoxes } from "../../../models/tiles/geometry/geometry-utils";
import { useTileNavigatorContext } from "../../../components/tiles/hooks/use-tile-navigator-context";
import { hasSelectionModifier } from "../../../utilities/event-utils";
import { kClosedObjectListPanelWidth } from "../model/drawing-types";
import { IContainerContextType, useContainerContext } from "../../../components/document/container-context";
import { userSelectTile } from "../../../models/stores/ui";
import { useDrawingAreaContext } from "./drawing-area-context";
import { calculateFitContent } from "../model/drawing-utils";

const SELECTION_COLOR = "#777";
const HOVER_COLOR = "#bbdd00";
const SELECTION_BOX_PADDING = 10;
const SELECTION_BOX_RESIZE_HANDLE_SIZE = 10;

const navigatorSize = { width: 90, height: 62 };

/**  ======= Drawing Layer ======= */
interface DrawingToolMap {
  [key: string]: DrawingTool | undefined;
}

interface DrawingLayerViewProps {
  model: ITileModel;
  readOnly?: boolean;
  scale?: number;
  highlightObject?: string|null;
  onSetCanAcceptDrop: (tileId?: string) => void;
  imageUrlToAdd?: string;
  setImageUrlToAdd?: (url: string) => void;
  showAllContent?: boolean;
  tileVisibleBoundingBox?: BoundingBox;
}

interface InternalDrawingLayerViewProps extends DrawingLayerViewProps {
  reportVisibleBoundingBox?: (boundingBox: BoundingBox) => void;
  offsetX: number;
  offsetY: number;
  zoom: number;
  objectsBoundingBox: BoundingBox;
  containerContext: IContainerContextType;
  drawingAreaContext: ReturnType<typeof useDrawingAreaContext>;
}

interface DrawingLayerViewState {
  toolbarSettings?: ToolbarSettings;
  currentDrawingObject: DrawingObjectType|null;
  selectionBox: SelectionBox|null;
  hoverObject: DrawingObjectType|null;
}

/**
 * This wrapper has two purposes.
 * - It passes extra contexts as props, since the InternalDrawingLayerView is a class component and so can't
 *   connect to multiple Contexts.
 * - It passes some content values as props so that they will cause the component to re-render even if they
 *   are not directly referenced in the render method.
 */
export const DrawingLayerView = observer((props: DrawingLayerViewProps) => {
  const navigator = useTileNavigatorContext();
  const containerContext = useContainerContext();
  const content = props.model.content as DrawingContentModelType;
  const drawingAreaContext = useDrawingAreaContext();

  let offsetX = content.offsetX;
  let offsetY = content.offsetY;
  let zoom = content.zoom;

  // For read-only tiles, calculate independent fit-to-view transforms instead of using the
  // shared model's zoom and offset values.
  if (props.readOnly) {
    const canvasSize = drawingAreaContext?.getVisibleCanvasSize() ?? { x: 100, y: 100 };
    const contentBoundingBox = content.objectsBoundingBox;
    if (contentBoundingBox) {
      const fitResult = calculateFitContent({
        canvasSize,
        contentBoundingBox,
        minZoom: 0.1,
        maxZoom: 1
      });
      offsetX = fitResult.offsetX;
      offsetY = fitResult.offsetY;
      zoom = fitResult.zoom;
    }
  }

  return (
    <InternalDrawingLayerView
      reportVisibleBoundingBox={navigator.reportVisibleBoundingBox}
      offsetX={offsetX}
      offsetY={offsetY}
      zoom={zoom}
      objectsBoundingBox={content.objectsBoundingBox}
      containerContext={containerContext}
      drawingAreaContext={drawingAreaContext}
      {...props}
    />);
});

@observer
export class InternalDrawingLayerView extends React.Component<InternalDrawingLayerViewProps, DrawingLayerViewState>
    implements IDrawingLayer {
  static contextType = MobXProviderContext;
  public tools: DrawingToolMap;
  public viewRef: React.RefObject<HTMLDivElement>;
  private svgRef: React.RefObject<any>|null;
  private setSvgRef: (element: any) => void;
  private _isMounted: boolean;

  // These hold the values currently in use.
  // For regular tile view, they are same as the props passed in.
  // For navigator view, different values are calculated in order to show all content.
  private offsetX: number = this.props.offsetX;
  private offsetY: number = this.props.offsetY;
  private zoom: number = this.props.zoom;

  constructor(props: InternalDrawingLayerViewProps) {
    super(props);

    this.state = {
      currentDrawingObject: null,
      selectionBox: null,
      hoverObject: null,
    };

    this.tools = {};
    const drawingToolInfos = getDrawingToolInfos();
    drawingToolInfos.forEach(info => {
      if (info.toolClass) {
        this.tools[info.name] = new info.toolClass(this);
      }
    });

    this.viewRef = React.createRef();
    this.svgRef = null;
    this.setSvgRef = (element) => {
      this.svgRef = element;
    };
  }

  public componentDidMount() {
    // Prevent drag events from scrolling the window on touch devices,
    // since drag gestures are needed for various sketching functions.
    // For iPad, listeners must be registered as non-passive in order to prevent scrolling, see
    // https://stackoverflow.com/questions/49500339/prevent-scrolling-when-touching-the-screen-in-ios
    // We check touches.length and only intercept events when there is a single touch.
    // This should allow for pinch-to-zoom and scrolling with 2 fingers to still work.
    this.viewRef.current?.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) e.preventDefault(); }, { passive: false });
    this.viewRef.current?.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1) e.preventDefault(); }, { passive: false });
    this._isMounted = true;
    this.calculateBounds();
  }

  public componentDidUpdate(prevProps: DrawingLayerViewProps, prevState: DrawingLayerViewState) {
    if (this.props.imageUrlToAdd) {
      this.addImage(this.props.imageUrlToAdd);
      this.props.setImageUrlToAdd?.("");
    }
    this.calculateBounds();
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  private calculateBounds() {
    if (this.props.showAllContent) {
      // In "showAllContent" (Tile Navigator) mode, we determine offset/zoom values needed to show all the content
      // and also make sure all areas visible in the main tile are also visible in the navigator.
      const objectsBoundingBox = this.props.objectsBoundingBox;
      const navigatorRequiredBoundingBox = combineBoundingBoxes(objectsBoundingBox, this.props.tileVisibleBoundingBox);
      // We may show more than this in the navigator, but the above area is the minimum required.

      const requiredWidth = navigatorRequiredBoundingBox.se.x - navigatorRequiredBoundingBox.nw.x;
      const requiredHeight = navigatorRequiredBoundingBox.se.y - navigatorRequiredBoundingBox.nw.y;

      // Determine zoom level needed to show the required area.
      const scale = this.props.scale || 1;
      this.zoom = Math.min(
        navigatorSize.width / scale / requiredWidth,
        navigatorSize.height / scale / requiredHeight);

      // Determine how much extra room we have around the required area.
      // One of these dimensions should be 0.
      // The other dimension's extra will be split between the two sides so that the actual content is centered.
      const extraRoom = {
        x: navigatorSize.width / scale / this.zoom - requiredWidth,
        y: navigatorSize.height / scale / this.zoom - requiredHeight
      };

      // Report the actual bounding box that will be shown in the navigator to our parent.
      const actualBoundingBox = {
        nw: { x: navigatorRequiredBoundingBox.nw.x - extraRoom.x/2,
              y: navigatorRequiredBoundingBox.nw.y - extraRoom.y/2 },
        se: { x: navigatorRequiredBoundingBox.se.x + extraRoom.x/2,
              y: navigatorRequiredBoundingBox.se.y + extraRoom.y/2 }
      };

      this.offsetX = -actualBoundingBox.nw.x * this.zoom;
      this.offsetY = -actualBoundingBox.nw.y * this.zoom;

      this.props.reportVisibleBoundingBox?.(actualBoundingBox);
    } else {
      if (this.props.readOnly) {
        // In read-only mode, we display the entire drawing content at a zoom level that fits the view dimensions.
        const canvasSize = this.props.drawingAreaContext?.getVisibleCanvasSize() ?? { x: 10, y: 10 };
        const contentBoundingBox = this.props.objectsBoundingBox;
        const { offsetX, offsetY, zoom } = calculateFitContent({
          canvasSize,
          contentBoundingBox,
          minZoom: .1,
          maxZoom: 1
        });

        this.zoom = zoom;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
      } else {
        // In regular tile display, offset and zoom are the values stored in the model.
        // However, we tweak the displayed offset if there is no "show/sort" sidebar so that the
        // read-only and read-write versions of the tile center content the same way.
        this.offsetX = this.props.offsetX + (this.props.readOnly ? kClosedObjectListPanelWidth : 0);
        this.offsetY = this.props.offsetY;
        this.zoom = this.props.zoom;

        // Determine what extent of the coordinate plane will be shown in the tile.
        const visibleCanvasSize = {
          x: this.viewRef.current?.clientWidth || 10,
          y: this.viewRef.current?.clientHeight || 10 };
        const visibleBoundingBox = {
          nw: { x: -this.offsetX/this.zoom, y: -this.offsetY/this.zoom },
          se: { x: (-this.offsetX + visibleCanvasSize.x)/this.zoom,
            y: (-this.offsetY + visibleCanvasSize.y)/this.zoom }
        };

        // Report this to our parent, so that it can be shown in the navigator.
        this.props.reportVisibleBoundingBox?.(visibleBoundingBox);
      }
    }
  }

  public selectTile(append: boolean) {
    userSelectTile(this.context.stores.ui, this.props.model,
      { readOnly: this.props.readOnly, append, container: this.props.containerContext.model });
  }

  /**
   * Adds a new object to the canvas.
   * @param drawingObject
   * @param options may include: "addAtBack" - if true, the new object
   * is put at the bottom of the stacking order instead of the default
   * which is to put it in front. "keepToolActive" - if true, the
   * drawing tool which was used to create this object is not changed.
   * Default is to select the new object and therefore activate the
   * select tool.
   * @returns
   */
  public addNewDrawingObject(drawingObject: DrawingObjectSnapshotForAdd,
    options?: { addAtBack?: boolean, keepToolActive?: boolean }) {
      const addAtBack = options?.addAtBack;
      const keepToolActive = options?.keepToolActive;
    if (keepToolActive) {
      return this.getContent().addObject(drawingObject, addAtBack);
    } else {
      return this.getContent().addAndSelectObject(drawingObject, addAtBack);
    }
  }

  public getSelectedObjects(): DrawingObjectType [] {
    return this.getContent().getSelectedObjects();
  }

  public setSelectedObjects(selectedObjects: DrawingObjectType[]) {
    const selectedObjectIds = selectedObjects.map(object => object.id || "");
    this.getContent().setSelectedIds(selectedObjectIds);
  }

  public getCurrentTool(): DrawingTool|undefined {
    return this.tools[this.getContent().selectedButton];
  }

  public toolbarSettings(): ToolbarSettings {
    return this.getContent().toolbarSettings;
  }

  public getCurrentStamp() {
    const drawingContent = this.props.model.content as DrawingContentModelType;
    return drawingContent.currentStamp;
  }

  public handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!this.props.readOnly) {
      this.getCurrentTool()?.handlePointerDown(e);
    } else {
      this.selectTile(hasSelectionModifier(e));
    }
  };

  public handleObjectClick = (e: PointerEvent|React.PointerEvent<any>, obj: DrawingObjectType) => {
    if (!this.props.readOnly) {
      this.getCurrentTool()?.handleObjectClick(e, obj);
    }
  };

  public handleObjectHover: HandleObjectHover = (e, obj, hovering) => {
    if (!this.props.readOnly && this.getCurrentTool() === this.tools.select) {
      this.setState({hoverObject: hovering ? obj : null});
    }
  };

  // Handles click/drag of selected/hovered objects
  public handleSelectedObjectPointerDown = (e: React.PointerEvent<any>, obj: DrawingObjectType) => {
    // Only respond to primary pointer events.
    if (!e.isPrimary) return;

    // Only the select tool does anything special when an object is clicked.
    // Other tools just let the click pass through to the canvas layer.
    if (this.props.readOnly || !this.getContent().isSelectedButton('select')) return;

    let moved = false;
    const {hoverObject } = this.state;
    const selectedObjects = this.getSelectedObjects();
    let objectsToMove: DrawingObjectType[];
    let needToAddHoverToSelection = false;

    // If the object you are dragging is selected then the selection should not be cleared
    // and all objects should be moved.
    // If the object you are dragging was not selected then only then all of the other objects
    // should be deselected and just the object you are dragging should be selected.
    if (hoverObject && !selectedObjects.some(object => object.id === hoverObject.id)) {
      needToAddHoverToSelection = true;
      if (e.shiftKey || e.metaKey){
        objectsToMove = [hoverObject, ...selectedObjects];
      }
      else {
        objectsToMove = [hoverObject];
      }
    } else {
      objectsToMove = selectedObjects;
    }

    const starting = this.getWorkspacePoint(e);
    if (!starting) return;

    // Normally clicks bubble up to the tile, which will select it or de-select if there are modifier keys.
    // In this case we never want to de-select the tile, but we do want to select it if it isn't already.
    e.stopPropagation();
    this.selectTile(false);

    const handlePointerMove = (e2: PointerEvent) => {
      e2.preventDefault();
      e2.stopPropagation();

      // Only respond to primary pointer events.
      if (!e2.isPrimary) return;

      const current = this.getWorkspacePoint(e2);
      if (!current) return;
      const dx = current.x - starting.x;
      const dy = current.y - starting.y;
      moved = moved || ((dx !== 0) || (dy !== 0));

      objectsToMove.forEach((object, index) => {
        object.setDragPosition(object.x + dx, object.y + dy);
      });

      if (needToAddHoverToSelection) {
        // we delay until we confirm that the user is dragging the objects before adding the hover object
        // to the selection, to avoid messing with the click to select/deselect logic
        this.setSelectedObjects(objectsToMove);
        // Note: the hoverObject could be kind of in a weird state here. It might
        // be both selected and hovered at the same time. However it is more
        // simple to keep the hoverObject independent of the selection. It just
        // represents the current object the mouse is over regardless of whether
        // it is selected or not.
        needToAddHoverToSelection = false;
      }
    };
    const handlePointerUp = (e2: PointerEvent) => {
      e2.preventDefault();
      e2.stopPropagation();

      // Only respond to primary pointer events.
      if (!e2.isPrimary) return;

      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      if (moved) {
        objectsToMove.map((object, index) => {
          object.repositionObject();
        });
      } else {
        this.handleObjectClick(e2, obj);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  public startSelectionBox(p: Point) {
    this.setState({selectionBox: new SelectionBox(p)});
  }

  public updateSelectionBox(p: Point) {
    const {selectionBox} = this.state;
    if (selectionBox) {
      selectionBox.update(p);
      this.setState({selectionBox});
    }
  }

  public endSelectionBox(addToSelectedObjects: boolean) {
    const {selectionBox} = this.state;
    if (selectionBox) {
      selectionBox.close();
      const selectedIds: string[] = addToSelectedObjects ? [...this.getContent().selection] : [];
      this.forEachObject((object) => {
        if (object.visible && object.inSelection(selectionBox)) {
          if (selectedIds.indexOf(object.id) === -1) {
            selectedIds.push(object.id);
          }
        }
      });
      this.getContent().setSelectedIds(selectedIds);
      this.setState({selectionBox: null});
    }
  }

  private conditionallyRenderObject(object: DrawingObjectType, selected: boolean, inGroup: boolean) {
    if (!object) return null;
    if (!selected && !object.visible) return null;
    // Objects that are members of a group do not individually respond to pointer events.
    const hoverAction = inGroup ? undefined : this.handleObjectHover;
    const pointerDownAction = inGroup ? undefined : this.handleSelectedObjectPointerDown;
    return renderDrawingObject(object, this.props.readOnly, hoverAction, pointerDownAction);
  }

  public renderObjects() {
    const content = this.getContent();
    return content.objects.reduce((result, object) => {
      const selected = content.isIdSelected(object.id);
      result.push(this.conditionallyRenderObject(object, selected, false));
      return result;
    }, [] as (JSX.Element|null)[]);
  }

  public renderSelectionBorders(selectedObjects: DrawingObjectType[], enableActions: boolean) {
    const zoom = this.zoom;
    const strokeWidth = 1.5/zoom;
    const padding = SELECTION_BOX_PADDING/zoom;
    const dashArray = [10/zoom, 5/zoom];

    return selectedObjects.map((object, index) => {
      if (object.animating) {
        // Do not display selection border during animation
        return null;
      }
      let {nw: {x: nwX, y: nwY}, se: {x: seX, y: seY}} = object.boundingBox;
      nwX -= padding;
      nwY -= padding;
      seX += padding;
      seY += padding;

      const color = enableActions ? SELECTION_COLOR : HOVER_COLOR;

      const resizers = enableActions && object.supportsResize &&
        <g>
          {this.renderResizeHandle(object, "nw", nwX, nwY, color)}
          {this.renderResizeHandle(object, "ne", seX, nwY, color)}
          {this.renderResizeHandle(object, "sw", nwX, seY, color)}
          {this.renderResizeHandle(object, "se", seX, seY, color)}
        </g>;

      const testId = enableActions ? "selection-box" : "highlight-box";

      return <g key={index}>
              <rect
                data-testid={testId}
                x={nwX}
                y={nwY}
                width={seX - nwX}
                height={seY - nwY}
                fill={color}
                fillOpacity="0"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray.join(" ")}
                pointerEvents={"none"}
               />
               {resizers}
             </g>;
    });
  }

  public renderResizeHandle(object: DrawingObjectType, corner: string, x: number, y: number, color: string) {
    const zoom = this.zoom;
    const handleSize = SELECTION_BOX_RESIZE_HANDLE_SIZE / zoom;
    const strokeWidth = 1/zoom;
    const resizeBoxOffset = handleSize/2;

    return <rect key={corner} data-corner={corner} className={"resize-handle " + corner}
                x={x-resizeBoxOffset} y={y-resizeBoxOffset}
                width={handleSize} height={handleSize}
                stroke={color} strokeWidth={strokeWidth} fill="#FFF" fillOpacity="1"
                onPointerDown={(e) => this.handleResizeStart(e, object)}
          />;
  }

  private handleResizeStart(e: React.PointerEvent<SVGRectElement>, object: DrawingObjectType) {
    e.stopPropagation();
    e.preventDefault();
    const handle = e.currentTarget;
    handle.classList.add('active');
    const corner = handle.dataset.corner;

    const start = this.getWorkspacePoint(e);
    const origBoundingBox = object.boundingBox;
    // The original size of the element is used to avoid making it 0 or negative size.
    const origWidth = origBoundingBox.se.x - origBoundingBox.nw.x;
    const origHeight = origBoundingBox.se.y - origBoundingBox.nw.y;

    const handleResizeMove = debounce((e2: PointerEvent) => {
      e2.stopPropagation();
      e2.preventDefault();
      // Check if pointer is within the drawtool canvas; if not do nothing.
      if (!((this.svgRef as unknown) as Element).matches(':hover')) {
        return;
      }
      const current = this.getWorkspacePoint(e2);
      if (!start || !current || !corner) return;
      const dx = current.x - start.x;
      const dy = current.y - start.y;
      // Determine which edges the user wants to move, and how much
      // Constrain these to make sure the image won't get 0 or negative size.
      const deltas = {
        top:    corner.charAt(0)==='n' ? Math.min(dy,   origHeight-1)  : 0,
        right:  corner.charAt(1)==='e' ? Math.max(dx, -(origWidth -1)) : 0,
        bottom: corner.charAt(0)==='s' ? Math.max(dy, -(origHeight-1)) : 0,
        left:   corner.charAt(1)==='w' ? Math.min(dx,   origWidth -1)  : 0
      };

      object.setDragBounds(deltas);

    }, 10);

    const handleResizecomplete = (e2: PointerEvent) => {
      e2.stopPropagation();
      e2.preventDefault();
      window.removeEventListener("pointermove", handleResizeMove);
      window.removeEventListener("pointerup", handleResizecomplete);
      handleResizeMove.flush(); // complete any movement pending in the debounce
      handle.classList.remove('active');
      object.resizeObject();
    };

    window.addEventListener("pointermove", handleResizeMove);
    window.addEventListener("pointerup", handleResizecomplete);
  }

  //we want to populate our objectsBeingDragged state array

  public setCurrentDrawingObject(object: DrawingObjectType | null) {
    this.setState({currentDrawingObject: object});
  }

  public getWorkspacePoint = (e: PointerEvent|React.PointerEvent<any>): Point|null => {
    if (this.svgRef) {
      const zoom = this.zoom;
      const scale = (this.props.scale || 1) * zoom;
      const rect = ((this.svgRef as unknown) as Element).getBoundingClientRect();
      return {
        x: (e.clientX - rect.left - this.offsetX) / scale,
        y: (e.clientY - rect.top - this.offsetY) / scale
      };
    }
    return null;
  };

  public render() {
    let highlightObject = null;
    if (!this.props.readOnly) {
      if (this.props.highlightObject) {
        highlightObject = this.getContent().objectMap[this.props.highlightObject];
      } else if (this.state.hoverObject
                && isAlive(this.state.hoverObject)
                && !this.getContent().isIdSelected(this.state.hoverObject.id)) {
        highlightObject = this.state.hoverObject;
      }
    }

    // If an offset value for the drawing is provided, the `object-canvas` group will be translated to place
    // the drawing objects appropriately.
    const objectCanvasTransform = `translate(${this.offsetX || 0}, ${this.offsetY || 0}) scale(${this.zoom || 1})`;

    return (
      // We don't propagate pointer events to the tile, since the drawing layer
      // already handles selecting the tile when necessary and we don't want to
      // deselect it when shift-click is used to select multiple drawing objects.
      <div ref={this.viewRef}
          className="drawing-layer"
          data-testid="drawing-layer"
          onMouseDown={(e) => { e.stopPropagation(); }}
          onPointerDown={this.handlePointerDown}
          onDragOver={this.handleDragOver}
          onDragLeave={this.handleDragLeave}
          onDrop={this.handleDrop} >

        <svg
          xmlnsXlink="http://www.w3.org/1999/xlink"
          ref={this.setSvgRef}
        >
          <g
            className="object-canvas"
            data-testid="drawing-layer-object-canvas"
            transform={objectCanvasTransform}
          >
            {this.renderObjects()}
            {!this.props.readOnly && this.renderSelectionBorders(this.getSelectedObjects(), true)}
            {highlightObject
              ? this.renderSelectionBorders([highlightObject], false)
              : null}
            {this.state.currentDrawingObject
              ? renderDrawingObject(this.state.currentDrawingObject)
              : null}
            {this.state.selectionBox ? this.state.selectionBox.render(this.zoom) : null}
          </g>
        </svg>
      </div>
    );
  }

  private getContent() {
    return this.props.model.content as DrawingContentModelType;
  }

  private isAcceptableImageDrag = (e: React.DragEvent<HTMLDivElement>) => {
    const { readOnly } = this.props;
    const toolType = extractDragTileType(e.dataTransfer);
    // image drop area is central 80% in each dimension
    const kImgDropMarginPct = 0.1;
    if (!readOnly && (toolType === "image")) {
      const eltBounds = e.currentTarget.getBoundingClientRect();
      const kImgDropMarginX = eltBounds.width * kImgDropMarginPct;
      const kImgDropMarginY = eltBounds.height * kImgDropMarginPct;
      if ((e.clientX > eltBounds.left + kImgDropMarginX) &&
          (e.clientX < eltBounds.right - kImgDropMarginX) &&
          (e.clientY > eltBounds.top + kImgDropMarginY) &&
          (e.clientY < eltBounds.bottom - kImgDropMarginY)) {
        return true;
      }
    }
    return false;
  };

  private handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const isAcceptableDrag = this.isAcceptableImageDrag(e);
    // TODO: what is this method used for?
    this.props.onSetCanAcceptDrop(isAcceptableDrag ? this.props.model.id : undefined);
    if (isAcceptableDrag) {
      e.dataTransfer.dropEffect = "copy";
      e.preventDefault();
    }
  };

  private handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    this.props.onSetCanAcceptDrop();
  };

  private handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (this.isAcceptableImageDrag(e)) {
      const dragContent = e.dataTransfer.getData(kDragTileContent);
      const parsedContent = safeJsonParse(dragContent);
      if (parsedContent) {
        const droppedContent: ImageContentSnapshotOutType = parsedContent.content;
        const droppedUrl = droppedContent.url;
        if (droppedUrl) {
          this.handleImageDrop(droppedUrl);
        }
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };

  private handleImageDrop(url: string) {
    this.props.setImageUrlToAdd?.(url);
  }

  private addImage(url: string) {
    gImageMap.getImage(url)
      .then(imageEntry => {
        if (!this._isMounted || !imageEntry.contentUrl) return;
        const image = ImageObject.create({
          // The contentUrl is used here because that is the normalized URL for this
          // image.
          url: imageEntry.contentUrl,
          // The filename is stored because the imageEntry is temporary and the filename
          // cannot be recreated just from the URL.  In this case, the imageEntry is being
          // used to transport this filename from the source of the drop.
          filename: imageEntry.filename,
          x: 0,
          y: 0,
          width: imageEntry.width!,
          height: imageEntry.height!
        });
        this.addNewDrawingObject(getSnapshot(image), { addAtBack: true });
      });
  }

  private forEachObject(callback: (object: DrawingObjectType, key?: string) => void) {
    const {objects} = this.getContent();
    objects.forEach((object) => {
      if (object) {
        callback(object, object.id);
      }
    });
  }
}
