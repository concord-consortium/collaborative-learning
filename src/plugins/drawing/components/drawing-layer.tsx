import React from "react";
import { reaction, IReactionDisposer } from "mobx";
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
  selectedObjects: DrawingObjectType[];
  selectionBox: SelectionBox|null;
  hoverObject: DrawingObjectType|null;
  objectBeingResized: DrawingObjectType|null;
}

@observer
export class DrawingLayerView extends React.Component<DrawingLayerViewProps, DrawingLayerViewState>
    implements IDrawingLayer {
  public currentTool: DrawingTool|null;
  public tools: DrawingToolMap;
  private svgRef: React.RefObject<any>|null;
  private setSvgRef: (element: any) => void;
  private _isMounted: boolean;
  private disposers: IReactionDisposer[];

  constructor(props: DrawingLayerViewProps) {
    super(props);

    this.state = {
      currentDrawingObject: null,
      selectionBox: null,
      selectedObjects: [],
      hoverObject: null,
      objectBeingResized: null
    };

    this.tools = {};
    const drawingToolInfos = getDrawingToolInfos();
    drawingToolInfos.forEach(info => {
      if (info.toolClass) {
        this.tools[info.name] = new info.toolClass(this);
      }
    });

    this.currentTool = this.tools.select!;

    this.svgRef = null;
    this.setSvgRef = (element) => {
      this.svgRef = element;
    };
  }

  public componentDidMount() {
    this._isMounted = true;
    this.disposers = [];

    this.disposers.push(reaction(
      () => this.getContent().selectedButton,
      selectedButton => this.syncCurrentTool(selectedButton)
    ));

    // TODO: the list of selected objects is operated on directly by the model for example:
    // deleteSelectedObjects. So it is redundant to have the selection stored here in the state
    // too. There are still a few places working with this list of selected objects from the
    // state instead of the model.
    this.disposers.push(reaction(
      () => this.getContent().selectedIds,
      selectedIds => {
        const selectedObjects = selectedIds.map(
          id => this.getContent().objectMap[id]).filter(obj => !!obj) as DrawingObjectType[];
        this.setState({ selectedObjects });
      }
    ));

    this.disposers.push(reaction(
      () => this.getContent().toolbarSettings,
      settings => this.setCurrentToolSettings(settings)
    ));
  }

  public componentDidUpdate(prevProps: DrawingLayerViewProps, prevState: DrawingLayerViewState) {
    if (this.props.imageUrlToAdd) {
      this.addImage(this.props.imageUrlToAdd);
      this.props.setImageUrlToAdd?.("");
    }
  }

  public componentWillUnmount() {
    this.disposers.forEach(disposer => disposer());

    this._isMounted = false;
  }

  public syncCurrentTool(selectedButton: string) {
    const settings = this.getContent().toolbarSettings;
    const tool = this.tools[selectedButton];

    if (!tool) {
      console.warn("Unknown tool selected", selectedButton);
      return;
    }

    tool.setSettings(settings);
    this.setCurrentTool(tool);
  }

  public addNewDrawingObject(drawingObject: DrawingObjectSnapshotForAdd) {
    this.getContent().addObject(drawingObject);
  }

  public setSelectedObjects(selectedObjects: DrawingObjectType[]) {
    this.setState({selectionBox: null, selectedObjects});

    const drawingContent = this.props.model.content as DrawingContentModelType;
    const selectedObjectIds = selectedObjects.map(object => object.id || "");
    drawingContent.setSelection(selectedObjectIds);
  }

  public getSelectedObjects(): DrawingObjectType [] {
    return this.state.selectedObjects;
  }

  public setCurrentTool(tool: DrawingTool|null) {
    this.currentTool = tool;
  }

  public setCurrentToolSettings(settings: ToolbarSettings) {
    this.currentTool?.setSettings(settings);
  }

  public getCurrentStamp() {
    const drawingContent = this.props.model.content as DrawingContentModelType;
    return drawingContent.currentStamp;
  }

  public handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!this.props.readOnly && this.currentTool) {
      this.currentTool.handleMouseDown(e);
    }
  };

  public handleObjectClick = (e: MouseEvent|React.MouseEvent<any>, obj: DrawingObjectType) => {
    if (!this.props.readOnly && this.currentTool) {
      this.currentTool.handleObjectClick(e, obj);
    }
  };

  public handleObjectHover: HandleObjectHover = (e, obj, hovering) => {
    if (!this.props.readOnly && this.currentTool === this.tools.select) {
      this.setState({hoverObject: hovering ? obj : null});
    }
  };

  // handles dragging of selected/hovered objects
  public handleSelectedObjectMouseDown = (e: React.MouseEvent<any>, obj: DrawingObjectType) => {
    if (this.props.readOnly || (this.currentTool !== this.tools.select)) return;
    let moved = false;
    const {selectedObjects, hoverObject } = this.state;
    let objectsToInteract: DrawingObjectType[];
    let needToAddHoverToSelection = false;

    //If the object you are dragging is selected then the selection should not be cleared
    //and all objects should be moved.
    //If the object you are dragging was not selected then only then all of the other objects
    //should be deselected and just the object you are dragging should be selected.
    if (hoverObject && !selectedObjects.some(object => object.id === hoverObject.id)) {
      needToAddHoverToSelection = true;
      if (e.shiftKey || e.metaKey){
        objectsToInteract = [hoverObject, ...selectedObjects];
      }
      else {
        objectsToInteract = [hoverObject];
      }
    } else {
      objectsToInteract = selectedObjects;
    }

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

      objectsToInteract.forEach((object, index) => {
        object.setDragPosition(object.x + dx, object.y + dy);
      });

      if (needToAddHoverToSelection) {
        // we delay until we confirm that the user is dragging the objects before adding the hover object
        // to the selection, to avoid messing with the click to select/deselect logic
        this.setSelectedObjects(objectsToInteract);
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
        objectsToInteract.map((object, index) => {
          object.adoptDragPosition();
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
      const selectedObjects: DrawingObjectType[] = addToSelectedObjects ? this.state.selectedObjects : [];
      this.forEachObject((object) => {
        if (object.inSelection(selectionBox)) {
          if (selectedObjects.indexOf(object) === -1) {
            selectedObjects.push(object);
          }
        }
      });
      this.setSelectedObjects(selectedObjects);
    }
  }

  // when we add text, this filter can be used with this.renderObjects((object) => object.type !== "text")
  public renderObjects(_filter: (object: DrawingObjectType) => boolean) {
    return this.getContent().objects.map((object) => {
      if (!object || !_filter(object)) {
        return null;
      }
      return renderDrawingObject(object, this.handleObjectHover, this.handleSelectedObjectMouseDown);
    });
  }

  public renderSelectedObjects(selectedObjects: DrawingObjectType[], enableActions: boolean) {
    return selectedObjects.map((object, index) => {
      let {nw: {x: nwX, y: nwY}, se: {x: seX, y: seY}} = object.boundingBox;
      nwX -= SELECTION_BOX_PADDING;
      nwY -= SELECTION_BOX_PADDING;
      seX += SELECTION_BOX_PADDING;
      seY += SELECTION_BOX_PADDING;

      const color = enableActions ? SELECTION_COLOR : HOVER_COLOR;

      const resizers = enableActions && 
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
    this.setState({objectBeingResized: object});

    const handleResizeMove = debounce((e2: MouseEvent) => {
      e2.stopPropagation();
      e2.preventDefault();
      const obj = this.state.objectBeingResized;
      const current = this.getWorkspacePoint(e2);
      if (!obj || !start || !current || !corner) return;
      const dx = current.x - start.x, dy = current.y - start.y;

      const actualChanges = obj.adjustBounds( {
        top:    corner.charAt(0)==='n' ? dy : 0,
        right:  corner.charAt(1)==='e' ? dx : 0,
        bottom: corner.charAt(0)==='s' ? dy : 0,
        left:   corner.charAt(1)==='w' ? dx : 0
      });
      
      // Move "start" by the amount of change that was actually applied
      start.x += actualChanges.left + actualChanges.right;
      start.y += actualChanges.top + actualChanges.bottom;

    }, 10);
  
    const handleResizecomplete = (e2: MouseEvent) => {
      e2.stopPropagation();
      e2.preventDefault();
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizecomplete);
      handle.classList.remove('active');
      this.setState({objectBeingResized: null});
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
      this.state.hoverObject
        ? this.state.selectedObjects.indexOf(this.state.hoverObject) !== -1
        : false;

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
          {this.renderSelectedObjects(this.state.selectedObjects, true)}
          {(this.state.hoverObject && !hoveringOverAlreadySelectedObject && isAlive(this.state.hoverObject))
            ? this.renderSelectedObjects([this.state.hoverObject], false)
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
