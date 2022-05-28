import React from "react";
import { extractDragTileType, kDragTileContent } from "../../../components/tools/tool-tile";
import { DrawingContentModelType } from "../model/drawing-content";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { DrawingToolChange, DrawingToolDeletion, DrawingToolMove, 
  DrawingToolUpdate } from "../model/drawing-types";
import { getUrlFromImageContent } from "../../../utilities/image-utils";
import { safeJsonParse } from "../../../utilities/js-utils";
import { reaction, IReactionDisposer, autorun } from "mobx";
import { observer } from "mobx-react";
import { ImageContentSnapshotOutType } from "../../../models/tools/image/image-content";
import { gImageMap } from "../../../models/image-map";
import { SelectionBox } from "./selection-box";
import { DrawingObjectType, DrawingTool, HandleObjectHover, IDrawingLayer } from "../objects/drawing-object";
import { Point, ToolbarSettings } from "../model/drawing-basic-types";
import { applyAction, getMembers, getSnapshot, SnapshotOut } from "mobx-state-tree";
import { DrawingObjectMSTUnion, DrawingObjectSnapshotUnion, renderDrawingObject } from "./drawing-object-manager";
import { LineDrawingTool } from "../objects/line";
import { VectorDrawingTool } from "../objects/vector";
import { RectangleDrawingTool } from "../objects/rectangle";
import { EllipseDrawingTool } from "../objects/ellipse";
import { ImageObject, StampDrawingTool } from "../objects/image";
import { VariableDrawingTool } from "../../shared-variables/drawing/variable-object";

const SELECTION_COLOR = "#777";
const HOVER_COLOR = "#bbdd00";
const SELECTION_BOX_PADDING = 10;

function makeSetter(prop: string) {
  return "set" + prop.charAt(0).toUpperCase() + prop.slice(1);
}

/**  ======= Drawing Tools ======= */
class SelectionDrawingTool extends DrawingTool {
  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    // We are internal so we can use some private stuff not exposed by 
    // IDrawingLayer
    const drawingLayerView = this.drawingLayer as DrawingLayerView;
    const addToSelectedObjects = e.ctrlKey || e.metaKey;
    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    drawingLayerView.startSelectionBox(start);

    const handleMouseMove = (e2: MouseEvent) => {
      e2.preventDefault();
      const p = this.drawingLayer.getWorkspacePoint(e2);
      if (!p) return;
      drawingLayerView.updateSelectionBox(p);
    };
    const handleMouseUp = (e2: MouseEvent) => {
      e2.preventDefault();
      drawingLayerView.endSelectionBox(addToSelectedObjects);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  public handleObjectClick(e: React.MouseEvent<HTMLDivElement>, obj: DrawingObjectType) {
    // We are internal so we can use some private stuff not exposed by 
    // IDrawingLayer
    const drawingLayerView = this.drawingLayer as DrawingLayerView;
    const {selectedObjects} = drawingLayerView.state;
    const index = selectedObjects.indexOf(obj);
    if (index === -1) {
      selectedObjects.push(obj);
    }
    else {
      selectedObjects.splice(index, 1);
    }
    drawingLayerView.setSelectedObjects(selectedObjects);
  }
}

/**  ======= Drawing Layer ======= */

interface ObjectMap {
  [key: string]: DrawingObjectType|null;
}

interface DrawingToolMap {
  [key: string]: DrawingTool;
}

interface DrawingLayerViewProps {
  model: ToolTileModelType;
  readOnly?: boolean;
  scale?: number;
  onSetCanAcceptDrop: (tileId?: string) => void;
}

interface DrawingLayerViewState {
  toolbarSettings?: ToolbarSettings;
  currentDrawingObject: DrawingObjectType|null;
  selectedObjects: DrawingObjectType[];
  selectionBox: SelectionBox|null;
  hoverObject: DrawingObjectType|null;
}

@observer
export class DrawingLayerView extends React.Component<DrawingLayerViewProps, DrawingLayerViewState> {
  public currentTool: DrawingTool|null;
  public tools: DrawingToolMap;
  private objects: ObjectMap;
  private svgRef: React.RefObject<any>|null;
  private setSvgRef: (element: any) => void;
  private _isMounted: boolean;
  private disposers: IReactionDisposer[];
  private fetchingImages: string[] = [];
  private actionsCount: number;

  constructor(props: DrawingLayerViewProps) {
    super(props);

    this.state = {
      currentDrawingObject: null,
      selectionBox: null,
      selectedObjects: [],
      hoverObject: null,
    };

    this.tools = {
      line: new LineDrawingTool(this),
      vector: new VectorDrawingTool(this),
      selection: new SelectionDrawingTool(this),
      rectangle: new RectangleDrawingTool(this),
      ellipse: new EllipseDrawingTool(this),
      stamp: new StampDrawingTool(this),
      variable: new VariableDrawingTool(this)
    };
    this.currentTool = this.tools.selection;

    this.objects = {};

    this.svgRef = null;
    this.setSvgRef = (element) => {
      this.svgRef = element;
    };

    this.addListeners();
  }

  public componentDidMount() {
    this._isMounted = true;
    this.actionsCount  = 0;
    this.disposers = [];

    this.disposers.push(reaction(
      () => this.getContent().metadata.selectedButton,
      selectedButton => this.syncCurrentTool(selectedButton)
    ));

    this.disposers.push(reaction(
      () => this.getContent().metadata.selection.toJSON(),
      selectedIds => {
        const selectedObjects = selectedIds.map(id => this.objects[id]).filter(obj => !!obj) as DrawingObjectType[];
        this.setState({ selectedObjects });
      }
    ));

    this.disposers.push(reaction(
      () => this.getContent().toolbarSettings,
      settings => this.setCurrentToolSettings(settings)
    ));

    this.disposers.push(autorun(() => {
      this.syncChanges();
    }));
  }

  public componentWillUnmount() {
    this.disposers.forEach(disposer => disposer());

    this._isMounted = false;
  }

  public syncCurrentTool(selectedButton: string) {
    const settings = this.getContent().toolbarSettings;
    switch (selectedButton) {
      case "select":
        this.setCurrentTool(this.tools.selection);
        break;
      case "line":
        this.setCurrentTool((this.tools.line as LineDrawingTool).setSettings(settings));
        break;
      case "vector":
        this.setCurrentTool((this.tools.vector as VectorDrawingTool).setSettings(settings));
        break;
      case "rectangle":
        this.setCurrentTool((this.tools.rectangle as RectangleDrawingTool).setSettings(settings));
        break;
      case "ellipse":
        this.setCurrentTool((this.tools.ellipse as EllipseDrawingTool).setSettings(settings));
        break;
      case "stamp":
        this.setCurrentTool((this.tools.stamp as StampDrawingTool).setSettings(settings));
        break;
      case "variable":
        this.setCurrentTool((this.tools.variable as VariableDrawingTool).setSettings(settings));
        break;
    }
  }

  public addListeners() {
    window.addEventListener("keyup", (e) => {
      if (!this.props.readOnly) {
        switch (e.key) {
          case "Backspace":
          case "Delete":
          case "Del":             // IE 9 and maybe Edge
            this.handleDelete();
            break;
        }
      }
    });
  }

  public addNewDrawingObject(drawingObject: DrawingObjectType) {
    // FIXME: for now we just get a snapshot to minimize the code changes
    // in the future we'll want to just store the object directly
    this.sendChange({action: "create", data: getSnapshot(drawingObject) as DrawingObjectSnapshotUnion});
  }

  public setSelectedObjects(selectedObjects: DrawingObjectType[]) {
    this.setState({selectionBox: null, selectedObjects});

    const drawingContent = this.props.model.content as DrawingContentModelType;
    const selectedObjectIds = selectedObjects.map(object => object.id || "");
    drawingContent.setSelection(selectedObjectIds);
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

  public handleDelete() {
    const {selectedObjects} = this.state;
    if (selectedObjects.length > 0) {
      const deletedObjects = selectedObjects.map(object => object.id);
      this.sendChange({action: "delete", data: deletedObjects as DrawingToolDeletion});
      this.setSelectedObjects([]);
    }
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
    if (!this.props.readOnly && this.currentTool === this.tools.selection) {
      this.setState({hoverObject: hovering ? obj : null});
    }
  };

  // handles dragging of selected/hovered objects
  public handleSelectedObjectMouseDown = (e: React.MouseEvent<any>, obj: DrawingObjectType) => {
    if (this.props.readOnly) return;
    let moved = false;
    const {selectedObjects, hoverObject} = this.state;
    let objectsToInteract: DrawingObjectType[];
    let needToAddHoverToSelection = false;
    if (hoverObject && !selectedObjects.some(object => object.id === hoverObject.id)) {
      objectsToInteract = [hoverObject, ...selectedObjects];
      needToAddHoverToSelection = true;
    } else {
      objectsToInteract = selectedObjects;
    }
    const starting = this.getWorkspacePoint(e);
    if (!starting) return;
    const start = objectsToInteract.map(object => ({x: object.x, y: object.y}));

    e.stopPropagation();

    const handleMouseMove = (e2: MouseEvent) => {
      e2.preventDefault();
      e2.stopPropagation();

      const current = this.getWorkspacePoint(e2);
      if (!current) return;
      const dx = current.x - starting.x;
      const dy = current.y - starting.y;
      moved = moved || ((dx !== 0) && (dy !== 0));

      objectsToInteract.forEach((object, index) => {
        object.setPosition(start[index].x + dx, start[index].y + dy);
      });

      if (needToAddHoverToSelection) {
        // we delay until we confirm that the user is dragging the objects before adding the hover object
        // to the selection, to avoid messing with the click to select/deselect logic
        this.setSelectedObjects(objectsToInteract);
        needToAddHoverToSelection = false;
      }
      this.forceUpdate();
    };
    const handleMouseUp = (e2: MouseEvent) => {
      e2.preventDefault();
      e2.stopPropagation();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (moved) {
        if (objectsToInteract.length > 0) {
          const moves: DrawingToolMove = objectsToInteract.map((object) => ({
            id: object.id || "",
            destination: {x: object.x, y: object.y}
          }));
          this.sendChange({action: "move", data: moves});
        }
      }
      else {
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
    return Object.keys(this.objects).map((id) => {
      const object = this.objects[id];
      if (!object || !_filter(object)) {
        return null;
      }
      return renderDrawingObject(object, this.getContent(), this.handleObjectHover);
    });
  }

  public renderSelectedObjects(selectedObjects: DrawingObjectType[], color: string) {
    return selectedObjects.map((object, index) => {
      let {nw: {x: nwX, y: nwY}, se: {x: seX, y: seY}} = object.boundingBox;
      nwX -= SELECTION_BOX_PADDING;
      nwY -= SELECTION_BOX_PADDING;
      seX += SELECTION_BOX_PADDING;
      seY += SELECTION_BOX_PADDING;
      return <rect
                key={index}
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
                onMouseDown={(e) => this.handleSelectedObjectMouseDown(e, object)}
                onMouseEnter={(e) => this.handleObjectHover(e, object, true) }
                onMouseLeave={(e) => this.handleObjectHover(e, object, false) }
               />;
    });
  }

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
          {this.renderObjects(object => object.type === "image")}
          {this.renderObjects(object => object.type !== "image")}
          {this.renderSelectedObjects(this.state.selectedObjects, SELECTION_COLOR)}
          {this.state.hoverObject
            ? this.renderSelectedObjects([this.state.hoverObject], hoveringOverAlreadySelectedObject
              ? SELECTION_COLOR : HOVER_COLOR)
            : null}
          {this.state.currentDrawingObject
            ? renderDrawingObject(this.state.currentDrawingObject, this.getContent())
            : null}
          {this.state.selectionBox ? this.state.selectionBox.render() : null}
        </svg>
      </div>
    );
  }

  // The filename is passed here so it gets added to the imageEntry in the ImageMap
  // This imageEntry is used as the transport object during drag and drop operations
  // so it needs this filename so places the image is dropped on can have the file
  // name too.
  // Currently it is probably not possible to drag an image out of a drawing tile,
  // however the same image might be used in an image tile.  These two tiles will
  // share the same imageEntry so when either creates the imageEntry they need to 
  // include the filename.
  private updateLoadingImages = (url: string, filename?: string) => {
    if (this.fetchingImages.indexOf(url) > -1) return;
    this.fetchingImages.push(url);

    gImageMap.getImage(url, { filename })
      .then(image => {
        if (!this._isMounted) return;

        // Additional code was removed here because now the image components
        // should be watching the gImageMap for changes themselves

        // update mst content if conversion occurred
        if (image.contentUrl && (url !== image.contentUrl)) {
          this.getContent().updateImageUrl(url, image.contentUrl);
        }
      })
      .catch(() => {
        console.warn("error loading image. url", url, "filename", filename);
      });
  };

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
        const droppedUrl = getUrlFromImageContent(droppedContent);
        if (droppedUrl) {
          this.handleImageDrop(droppedUrl);
        }
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };

  private handleImageDrop(url: string) {
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
        this.addNewDrawingObject(image);
      });
  }

  private sendChange(change: DrawingToolChange): any {
    const drawingContent = this.props.model.content as DrawingContentModelType;
    drawingContent.applyChange(change);
  }

  private executeChange(change: DrawingToolChange) {
    switch (change.action) {
      case "create":
        this.createDrawingObject(change.data);
        break;
      case "move":
        this.moveDrawingObjects(change.data);
        break;
      case "update":
        this.updateDrawingObjects(change.data);
        break;
      case "delete":
        this.deleteDrawingObjects(change.data);
        break;
    }
  }

  private createDrawingObject(data: DrawingObjectSnapshotUnion) {
    const drawingObjectMST = DrawingObjectMSTUnion.create(data);
    switch (data.type) {
      case "image": {
        const imageData = data as SnapshotOut<typeof ImageObject>;
        const imageEntry = gImageMap.getCachedImage(imageData.url);
        if (!imageEntry) {
          // If this image hasn't been loaded to gImageMap, trigger that loading.
          // The ImageObject will automatically be watching for changes to this 
          // imageEntry and update itself when the load is done.
          //
          // The filename is passed so that it gets added to the imageEntry in the
          // ImageMap. See updateLoadingImages for more details.
          this.updateImageUrl(imageData.url, imageData.filename);
        }
        break;
      }
      default:
        // We don't need to do anything in this case
        break;
    }
    if (drawingObjectMST?.id) {
      const objectId = drawingObjectMST.id;
      if (this.objects[objectId]) {
        console.warn(`DrawingLayer.createDrawingObject detectected duplicate ${data.type} with id ${objectId}`);
      }
      this.objects[objectId] = drawingObjectMST;
      this.forceUpdate();
    }
  }

  private moveDrawingObjects(moves: DrawingToolMove) {
    for (const move of moves) {
      const drawingObject = this.objects[move.id];
      if (drawingObject) {
        drawingObject.setPosition(move.destination.x, move.destination.y);
      }
    }
  }

  private updateImageUrl(url: string, filename?: string) {
    this.updateLoadingImages(url, filename);
  }

  private updateDrawingObjects(update: DrawingToolUpdate) {
    const {ids, update: {prop, newValue}} = update;
    const action = makeSetter(prop);
    for (const id of ids) {
      const drawingObject = this.objects[id];

      // TODO: this approach is temporary to support the legacy approach of saving
      // property changes. If we have migration of the old state, then this can 
      // probably go away
      const objActions = getMembers(drawingObject).actions;
      if (objActions.includes(action)) {
        applyAction(drawingObject, {name: action, args: [newValue]});
      } else {
        console.warn("Trying to update unsupported drawing object", drawingObject?.type, "property", prop);
      }

      // Note: I don't see any place where something records an url update event
      // However this case has been handled in the past, so it is still handled here.
      // If the url changes, the url in the drawingObject will be updated by 
      // the code above. 
      // Then updateImageUrl is called which will trigger a loading of this url into
      // the ImageMap. The ImageComponent is watching this url through the displayUrl 
      // property and will show the placeholder image until the new url is loaded.
      if ((drawingObject?.type === "image") && (prop === "url")) {
        const url = newValue as string;
        this.updateImageUrl(url);
      }
    }
  }

  private deleteDrawingObjects(idsToDelete: string[]) {
    for (const id of idsToDelete) {
      const drawingObject = this.objects[id];
      if (drawingObject) {
        const {selectedObjects} = this.state;
        const index = selectedObjects.indexOf(drawingObject);
        if (index !== -1) {
          selectedObjects.splice(index, 1);
        }
        delete this.objects[id];
        this.setState({selectedObjects, hoverObject: null});
      }
    }
  }

  private forEachObject(callback: (object: DrawingObjectType, key?: string) => void) {
    const {objects} = this;
    Object.keys(objects).forEach((id) => {
      const object = objects[id];
      if (object) {
        callback(object, id);
      }
    });
  }

  private syncChanges() {
    const drawingContent = this.props.model.content as DrawingContentModelType;
    const currentChangesLength = drawingContent.changes ? drawingContent.changes.length : 0;
    const prevChanges = this.actionsCount;

    if (currentChangesLength > prevChanges) {
      for (let i = prevChanges; i < currentChangesLength; i++) {
        const change = JSON.parse(drawingContent.changes[i]) as DrawingToolChange;
        this.executeChange(change);
      }
      this.actionsCount = currentChangesLength;
      this.forceUpdate();
    }
  }
}
