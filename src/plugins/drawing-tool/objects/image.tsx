import { addDisposer, Instance, SnapshotIn, types } from "mobx-state-tree";
import React, { useCallback } from "react";
import { observer } from "mobx-react";
import { autorun } from "mobx";
import { Tooltip } from "react-tippy";
import { EntryStatus, gImageMap } from "../../../models/image-map";
import { DrawingObject, DrawingObjectSnapshot, DrawingTool, IDrawingComponentProps, IDrawingLayer, 
  IToolbarButtonProps, typeField } from "./drawing-object";
import { Point } from "../model/drawing-basic-types";
import placeholderImage from "../../../assets/image_placeholder.png";
import SmallCornerTriangle from "../../../assets/icons/small-corner-triangle.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { buttonClasses } from "../components/drawing-toolbar-buttons";
import { useTouchHold } from "../../../hooks/use-touch-hold";

export const ImageObject = DrawingObject.named("ImageObject")
  .props({
    type: typeField("image"),

    // This is the canonical or normalized url for this image.
    url: types.string,

    // The filename needs to be stored because it is meta data created when a user adds a file
    // by uploading a file from their computer. The filename cannot be discovered just from the
    // URL. Currently images can't be uploaded into the drawing tile, but they can be uploaded 
    // into a image tile and then that image dragged to the drawing tile. In this case we want
    // to preserve the filename of the source image.
    filename: types.maybe(types.string),
    width: types.number,
    height: types.number
  })
  .views(self => ({
    get boundingBox() {
      const {x, y, width, height} = self;
      const nw: Point = {x, y};
      const se: Point = {x: x + width, y: y + height};
      return {nw, se};
    },
    get displayUrl() {
      let entry = gImageMap.getCachedImage(self.url);
      // FIXME: this causes an infinite loop when there is an network error
      // The setting of the entry status to Error causes observers 
      // to re-render. So those observers will call displayUrl again
      // and since the entry has a status of Error this line will be
      // true so getImage will be called again. This sets the entry.status
      // to PendingStorage which triggers a re-render again. In this case
      // the displayUrl will falsy so the placeholder image will be returned
      // then when the network request fails the entry.status will be switched
      // back to Error which will trigger another render, and cycle repeats.
      //
      // The fix seems to be to add a counter here or in the image map so 
      // we don't retry more than that.
      //
      // We should add a test first though. Perhaps with an autorun and a
      // invalid URL. The autorun should loop just like the render.  Because multiple
      // places might be requesting this it should be on the image map itself.
      // So I can make this a separate PR off of that one...
      if (!entry || entry.status === EntryStatus.Error) {
        gImageMap.getImage(self.url, {filename: self.filename});
        entry = gImageMap.getCachedImage(self.url);
      }
      // TODO we could return a spinner image if the entry is storing or computing dimensions
      return entry?.displayUrl || (placeholderImage as string);
    },

  }))
  .actions(self => ({
    setWidth(width: number){self.width = width;},
    setHeight(height: number){self.height = height;}
  }))
  .actions(self => ({
    setUrl(url: string, filename?: string){  
      self.url = url;
    },

    setFilename(filename?: string) {
      self.filename = filename;
    },

    afterCreate() {
      // Monitor the image map entry and save the width and height when it is available
      // this way when the image is reloaded from state the width and height are immediately
      // available and there won't be any resize flickering.
      // In all cases I can find, the correct width and height will be set when the ImageObject is
      // created. However the old code was modifying the width and height after the image 
      // entry became available, so there might be a case where width and height change.
      addDisposer(self, autorun(() =>{
        const imageMapEntry = gImageMap.getCachedImage(self.url);
        if (imageMapEntry?.width != null) {
          self.setWidth(imageMapEntry.width);
        }
        if (imageMapEntry?.height != null) {
          self.setHeight(imageMapEntry.height);
        }
        // Note: We might want to save the filename here too. It seems possible that
        // in some cases the image map entry's filename will change. However so far, the code paths
        // only provide this filename when the object is loaded from state or an image is dropped
        // on the drawing tile that has a filename in the image entry already. And in that second case
        // the image object is not created until the image map entry is retrieved and
        // the filename is known.
      }));
    }
  }));
export interface ImageObjectType extends Instance<typeof ImageObject> {}
export interface ImageObjectSnapshot extends SnapshotIn<typeof ImageObject> {}

export function isImageObjectSnapshot(object: DrawingObjectSnapshot): object is ImageObjectSnapshot {
  return object.type === "image";
}

export const ImageComponent: React.FC<IDrawingComponentProps> = observer(function ImageComponent({model, handleHover}){
  if (model.type !== "image") return null;
  const { id, displayUrl, x, y, width, height } = model as ImageObjectType;

  return <image
    key={id}
    href={displayUrl}
    x={x}
    y={y}
    width={width}
    height={height}
    onMouseEnter={(e) => handleHover ? handleHover(e, model, true) : null}
    onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null} />;
});

export class StampDrawingTool extends DrawingTool {

  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }

  public handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const stamp = this.drawingLayer.getCurrentStamp();
    if (stamp) {
      const stampImage = ImageObject.create({
        url: stamp.url,
        x: start.x - (stamp.width / 2),
        y: start.y - (stamp.height / 2),
        width: stamp.width,
        height: stamp.height
      });

      this.drawingLayer.addNewDrawingObject(stampImage);
    }
  }
}

export const StampToolbarButton: React.FC<IToolbarButtonProps> = ({
  drawingContent, togglePaletteState, clearPaletteState
}) => {
  const tooltipOptions = useTooltipOptions();
  const { selectedButton, stamps } = drawingContent;
  const { currentStamp } = drawingContent;
  const stampCount = stamps.length;

  const modalButton = "stamp";
  const selected = selectedButton === modalButton;

  const handleStampsButtonClick = useCallback(() => {
    drawingContent.setSelectedButton("stamp");
    togglePaletteState("showStamps", false);
  }, [drawingContent, togglePaletteState]);

  const handleStampsButtonTouchHold = useCallback(() => {
    drawingContent.setSelectedButton("stamp");
    togglePaletteState("showStamps");
  }, [drawingContent, togglePaletteState]);

  const { didTouchHold, ...handlers } = useTouchHold(handleStampsButtonTouchHold, handleStampsButtonClick);

  const handleExpandCollapseClick = (e: React.MouseEvent) => {
    if (!didTouchHold()) {
      handleStampsButtonTouchHold();
      e.stopPropagation();
    }
  };

  return (
    currentStamp 
      ? <Tooltip title="Stamp" {...tooltipOptions}>
          <div className={buttonClasses({ modalButton, selected })} {...handlers}>
            <img src={currentStamp.url} draggable="false" />
            {stampCount > 1 &&
              <div className="expand-collapse" onClick={handleExpandCollapseClick}>
                <SmallCornerTriangle />
              </div>}
          </div>
        </Tooltip>
      : null
  );
};
