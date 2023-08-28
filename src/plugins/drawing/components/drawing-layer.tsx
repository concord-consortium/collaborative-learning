import React from "react";
import { isAlive, getSnapshot } from "mobx-state-tree";
import { observer } from "mobx-react";
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
import { Point, ToolbarSettings } from "../model/drawing-basic-types";
import { getDrawingToolInfos, renderDrawingObject } from "./drawing-object-manager";
import { ImageObject } from "../objects/image";
import { debounce } from "lodash";
import { isGroupObject } from "../objects/group";

const SELECTION_COLOR = "#777";
const HOVER_COLOR = "#bbdd00";
const SELECTION_BOX_PADDING = 10;
const SELECTION_BOX_RESIZE_HANDLE_SIZE = 10;

/**  ======= Drawing Layer ======= */
interface DrawingToolMap {
  [key: string]: DrawingTool | undefined;
}

interface DrawingLayerViewProps {
  model: ITileModel;
  readOnly?: boolean;
  scale?: number;
  onSetCanAcceptDrop: (tileId?: string) => void;
  imageUrlToAdd?: string;
  setImageUrlToAdd?: (url: string) => void;
}

interface DrawingLayerViewState {
  toolbarSettings?: ToolbarSettings;
  currentDrawingObject: DrawingObjectType|null;
  selectionBox: SelectionBox|null;
  hoverObject: DrawingObjectType|null;
}

@observer
export class DrawingLayerView extends React.Component<DrawingLayerViewProps, DrawingLayerViewState>
    implements IDrawingLayer {
  public tools: DrawingToolMap;
  private svgRef: React.RefObject<any>|null;
  private setSvgRef: (element: any) => void;
  private _isMounted: boolean;

  constructor(props: DrawingLayerViewProps) {
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

    this.svgRef = null;
    this.setSvgRef = (element) => {
      this.svgRef = element;
    };
  }

  public componentDidMount() {
    this._isMounted = true;
  }

  public componentDidUpdate(prevProps: DrawingLayerViewProps, prevState: DrawingLayerViewState) {
    if (this.props.imageUrlToAdd) {
      this.addImage(this.props.imageUrlToAdd);
      this.props.setImageUrlToAdd?.("");
    }
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  // Adds a new object and selects it, activating the select tool.
  public addNewDrawingObject(drawingObject: DrawingObjectSnapshotForAdd) {
    return this.getContent().addAndSelectObject(drawingObject);
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

  public handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!this.props.readOnly) {
      this.getCurrentTool()?.handleMouseDown(e);
    }
  };

  public handleObjectClick = (e: MouseEvent|React.MouseEvent<any>, obj: DrawingObjectType) => {
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
  public handleSelectedObjectMouseDown = (e: React.MouseEvent<any>, obj: DrawingObjectType) => {
    // Only the select tool does anything special when an object is clicked.
    // Other tools just let the click pass through to the canvas layer.
    if (this.props.readOnly || !this.getContent().isSelectedButton('select')) return;

    let moved = false;
    const {hoverObject } = this.state;
    const selectedObjects = this.getSelectedObjects();
    let objectsToSelect: DrawingObjectType[];
    let objectsToMove: DrawingObjectType[];
    let needToAddHoverToSelection = false;

    //If the object you are dragging is selected then the selection should not be cleared
    //and all objects should be moved.
    //If the object you are dragging was not selected then only then all of the other objects
    //should be deselected and just the object you are dragging should be selected.
    if (hoverObject && !selectedObjects.some(object => object.id === hoverObject.id)) {
      needToAddHoverToSelection = true;
      if (e.shiftKey || e.metaKey){
        objectsToSelect = [hoverObject, ...selectedObjects];
      }
      else {
        objectsToSelect = [hoverObject];
      }
    } else {
      objectsToSelect = selectedObjects;
    }
    // If any objects are groups, then their members also get moved.
    objectsToMove = [...objectsToSelect];
    objectsToSelect.filter(isGroupObject).forEach((group) => {
      objectsToMove = [...objectsToMove, ...group.objects];
    });

    const starting = this.getWorkspacePoint(e);
    if (!starting) return;

    e.stopPropagation();

    const handleMouseMove = (e2: MouseEvent) => {
      e2.preventDefault();
      e2.stopPropagation();

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
        this.setSelectedObjects(objectsToSelect);
        // Note: the hoverObject could be kind of in a weird state here. It might
        // be both selected and hovered at the same time. However it is more
        // simple to keep the hoverObject independent of the selection. It just
        // represents the current object the mouse is over regardless of whether
        // it is selected or not.
        needToAddHoverToSelection = false;
      }
    };
    const handleMouseUp = (e2: MouseEvent) => {
      e2.preventDefault();
      e2.stopPropagation();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (moved) {
        objectsToMove.map((object, index) => {
          object.repositionObject();
        });
      } else {
        this.handleObjectClick(e2, obj);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
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
        if (object.inSelection(selectionBox)) {
          if (selectedIds.indexOf(object.id) === -1) {
            selectedIds.push(object.id);
          }
        }
      });
      this.getContent().setSelectedIds(selectedIds);
      this.setState({selectionBox: null});
    }
  }

  private conditionallyRenderObject(object: DrawingObjectType,
       _filter: (object: DrawingObjectType) => boolean, inGroup: boolean) {
    if (!object || !_filter(object)) {
      return null;
    }
    // Objects that are members of a group should not respond to mouse events.
    const hoverAction = inGroup ? undefined : this.handleObjectHover;
    const mouseDownAction = inGroup ? undefined : this.handleSelectedObjectMouseDown;
    return renderDrawingObject(object, this.props.readOnly, hoverAction, mouseDownAction);
  }

  public renderObjects(_filter: (object: DrawingObjectType) => boolean) {
    return this.getContent().objects.reduce((result, object) => {
      result.push(this.conditionallyRenderObject(object, _filter, false));
      if (isGroupObject(object)) {
        object.objects.forEach((member) => { 
          result.push(this.conditionallyRenderObject(member, _filter, true));
        });
      }
      return result;
    }, [] as (JSX.Element|null)[]);
  }

  public renderSelectionBorders(selectedObjects: DrawingObjectType[], enableActions: boolean) {
    return selectedObjects.map((object, index) => {
      let {nw: {x: nwX, y: nwY}, se: {x: seX, y: seY}} = object.boundingBox;
      nwX -= SELECTION_BOX_PADDING;
      nwY -= SELECTION_BOX_PADDING;
      seX += SELECTION_BOX_PADDING;
      seY += SELECTION_BOX_PADDING;

      const color = enableActions ? SELECTION_COLOR : HOVER_COLOR;

      const resizers = enableActions && object.supportsResize &&
        <g>
          {this.renderResizeHandle(object, "nw", nwX, nwY, color)}
          {this.renderResizeHandle(object, "ne", seX, nwY, color)} 
          {this.renderResizeHandle(object, "sw", nwX, seY, color)}
          {this.renderResizeHandle(object, "se", seX, seY, color)}
        </g>;

      return <g key={index}>
              <rect
                data-testid="selection-box"
                x={nwX}
                y={nwY}
                width={seX - nwX}
                height={seY - nwY}
                fill={color}
                fillOpacity="0"
                stroke={color}
                strokeWidth="1.5"
                strokeDasharray="10 5"
                pointerEvents={"none"}
               />
               {resizers}
             </g>;
    });
  }

  public renderResizeHandle(object: DrawingObjectType, corner: string, x: number, y: number, color: string) {
    const resizeBoxOffset = SELECTION_BOX_RESIZE_HANDLE_SIZE/2;

    return <rect key={corner} data-corner={corner} className={"resize-handle " + corner}
                x={x-resizeBoxOffset} y={y-resizeBoxOffset} 
                width={SELECTION_BOX_RESIZE_HANDLE_SIZE} height={SELECTION_BOX_RESIZE_HANDLE_SIZE}
                stroke={color} strokeWidth="1" fill="#FFF" fillOpacity="1"
                onMouseDown={(e) => this.handleResizeStart(e, object)}
          />;
  }

  private handleResizeStart(e: React.MouseEvent<SVGRectElement, MouseEvent>, object: DrawingObjectType) {
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

    const handleResizeMove = debounce((e2: MouseEvent) => {
      e2.stopPropagation();
      e2.preventDefault();
      // Check if mouse is within the drawtool canvas; if not do nothing.
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
  
    const handleResizecomplete = (e2: MouseEvent) => {
      e2.stopPropagation();
      e2.preventDefault();
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizecomplete);
      handle.classList.remove('active');
      object.resizeObject();
    };

    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizecomplete);
  }


  //we want to populate our objectsBeingDragged state array

  public setCurrentDrawingObject(object: DrawingObjectType | null) {
    this.setState({currentDrawingObject: object});
  }

  public getWorkspacePoint = (e: MouseEvent|React.MouseEvent<any>): Point|null => {
    if (this.svgRef) {
      const scale = this.props.scale || 1;
      const rect = ((this.svgRef as unknown) as Element).getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale
      };
    }
    return null;
  };

  public render() {
    const hoveringOverAlreadySelectedObject =
      !this.props.readOnly
        && this.state.hoverObject 
        && isAlive(this.state.hoverObject)
        && this.getContent().isIdSelected(this.state.hoverObject.id);

    return (
      <div className="drawing-layer"
          data-testid="drawing-layer"
          onMouseDown={this.handleMouseDown}
          onDragOver={this.handleDragOver}
          onDragLeave={this.handleDragLeave}
          onDrop={this.handleDrop} >

        <svg xmlnsXlink="http://www.w3.org/1999/xlink" width={1500} height={1500} ref={this.setSvgRef}>
          {this.renderObjects(object => object.type === "image" )}
          {this.renderObjects(object => object.type !== "image" )}
          {!this.props.readOnly && this.renderSelectionBorders(this.getSelectedObjects(), true)}
          {!this.props.readOnly && (this.state.hoverObject && !hoveringOverAlreadySelectedObject 
            && isAlive(this.state.hoverObject))
            ? this.renderSelectionBorders([this.state.hoverObject], false)
            : null}
          {this.state.currentDrawingObject
            ? renderDrawingObject(this.state.currentDrawingObject)
            : null}
          {this.state.selectionBox ? this.state.selectionBox.render() : null}
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
        this.addNewDrawingObject(getSnapshot(image));
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
