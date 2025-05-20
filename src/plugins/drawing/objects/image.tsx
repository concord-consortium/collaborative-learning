import { Instance, SnapshotIn, types } from "mobx-state-tree";
import React from "react";
import { observer } from "mobx-react";
import { gImageMap } from "../../../models/image-map";
import { DrawingObjectSnapshot, DrawingTool,
  IDrawingComponentProps, IDrawingLayer, ObjectTypeIconViewBox, SizedObject, typeField } from "./drawing-object";
import { Transformable } from "../components/transformable";

import placeholderImage from "../../../assets/image_placeholder.png";
import ImageToolIcon from "../../../clue/assets/icons/image-tool.svg";

export const ImageObject = SizedObject.named("ImageObject")
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
  })
  .views(self => ({
    get label() {
      return "Image";
    },
    get icon() {
      return (<ImageToolIcon viewBox={ObjectTypeIconViewBox}/>);
    },
    get displayUrl() {
      const entry = gImageMap.getImageEntry(self.url, {filename: self.filename});
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

  }));
export interface ImageObjectType extends Instance<typeof ImageObject> {}
export interface ImageObjectSnapshot extends SnapshotIn<typeof ImageObject> {}
export interface ImageObjectSnapshotForAdd extends SnapshotIn<typeof ImageObject> {type: string}

export function isImageObjectSnapshot(object: DrawingObjectSnapshot): object is ImageObjectSnapshot {
  return object.type === "image";
}

export const ImageComponent: React.FC<IDrawingComponentProps> = observer(function ImageComponent({model, handleHover,
  handleDrag}){
  if (model.type !== "image") return null;
  const image = model as ImageObjectType;
  const { id, displayUrl } = image;
  const width = image.dragWidth ?? image.width;
  const height = image.dragHeight ?? image.height;

  return (
    <Transformable type="image" key={id} position={image.position} transform={image.transform}>
      <image
        href={displayUrl}
        x={0}
        y={0}
        width={width}
        height={height}
        preserveAspectRatio="none"
        onMouseEnter={(e) => handleHover ? handleHover(e, model, true) : null}
        onMouseLeave={(e) => handleHover ? handleHover(e, model, false) : null}
        onPointerDown={(e)=> handleDrag?.(e, model)}
        pointerEvents={handleHover ? "visible" : "none"}
      />
    </Transformable>
  );

});

export class StampDrawingTool extends DrawingTool {

  constructor(drawingLayer: IDrawingLayer) {
    super(drawingLayer);
  }

  public handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Select the drawing tile, but don't propagate event to do normal Cmd-click procesing.
    this.drawingLayer.selectTile(false);
    e.stopPropagation();

    // Stamp tool only responds to one finger at a time.
    if (!e.isPrimary) return;

    const start = this.drawingLayer.getWorkspacePoint(e);
    if (!start) return;
    const stamp = this.drawingLayer.getCurrentStamp();
    if (stamp) {
      const stampImage: ImageObjectSnapshotForAdd = {
        type: "image",
        // Note: the stamp.url used to be converted by the Stamp snapshot pre
        // processor. This is no longer the case. To safely use this url it
        // should be passed to the ImageMap and the displayUrl of the returned
        // entry should be used.
        url: stamp.url,
        x: start.x - (stamp.width / 2),
        y: start.y - (stamp.height / 2),
        width: stamp.width,
        height: stamp.height
      };

      this.drawingLayer.addNewDrawingObject(stampImage, { keepToolActive: true });
    }
  }
}
