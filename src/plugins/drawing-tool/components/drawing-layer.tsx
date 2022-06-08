import React from "react";
import { reaction, IReactionDisposer } from "mobx";
import { observer } from "mobx-react";
import { SnapshotOut } from "mobx-state-tree";
import { extractDragTileType, kDragTileContent } from "../../../components/tools/tool-tile";
import { DrawingContentModelType } from "../model/drawing-content";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { safeJsonParse } from "../../../utilities/js-utils";
import { ImageContentSnapshotOutType } from "../../../models/tools/image/image-content";
import { gImageMap } from "../../../models/image-map";
import { SelectionBox } from "./selection-box";
import { DrawingObjectSnapshot, DrawingObjectType, DrawingTool, 
  HandleObjectHover } from "../objects/drawing-object";
import { Point, ToolbarSettings } from "../model/drawing-basic-types";
import { DrawingObjectMSTUnion,
  getDrawingToolInfos, renderDrawingObject } from "./drawing-object-manager";
import { ImageObject } from "../objects/image";

const SELECTION_COLOR = "#777";
const HOVER_COLOR = "#bbdd00";
const SELECTION_BOX_PADDING = 10;

/**  ======= Drawing Layer ======= */

interface DrawingToolMap {
  [key: string]: DrawingTool | undefined;
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
    this.getContent().addObject(drawingObject);
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
    this.getContent().deleteSelectedObjects();
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
        // FIXME: this will change the state of the model during the move
        // previously the state was only changed on mouse up
        // we probably need to emulate this behavior, both for undo/redo
        // and to avoid sending too much state. This is the same problem 
        // we will have with typing characters into a text field.
        object.setPosition(start[index].x + dx, start[index].y + dy);
      });

      if (needToAddHoverToSelection) {
        // we delay until we confirm that the user is dragging the objects before adding the hover object
        // to the selection, to avoid messing with the click to select/deselect logic
        this.setSelectedObjects(objectsToInteract);
        needToAddHoverToSelection = false;
      }
    };
    const handleMouseUp = (e2: MouseEvent) => {
      e2.preventDefault();
      e2.stopPropagation();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (moved) {
        // Regarding the FIXME above, this is where we'd want to trigger the end 
        // of the undo-able event
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
    return this.getContent().objects.map((object) => {
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
  //
  // FIXME: this is not called anymore so when a image is added it probably won't
  // trigger an gImageMap.getImage. So we'll have to find a new place to do this.
  // It used to be called by createDrawingObject, when the object was an image.
  // And gImageMap.getCachedImage(imageData.url) was falsey.
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

  private forEachObject(callback: (object: DrawingObjectType, key?: string) => void) {
    const {objects} = this.getContent();
    objects.forEach((object) => {
      if (object) {
        callback(object, object.id);
      }
    });
  }
}
