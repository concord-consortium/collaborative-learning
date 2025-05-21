import { render, screen } from "@testing-library/react";
import React from "react";
import { TileModel } from "../../../models/tiles/tile-model";
import { createDrawingContent, DrawingContentModelType } from "../model/drawing-content";
import { DrawingLayerView } from "./drawing-layer";
import { LineObject, LineObjectType } from "../objects/line";
import { VectorObject, VectorObjectType } from "../objects/vector";
import { VectorEndShape, VectorType, endShapesForVectorType } from "../model/drawing-basic-types";
import { RectangleObject, RectangleObjectSnapshotForAdd, RectangleObjectType } from "../objects/rectangle";
import { EllipseObject, EllipseObjectType } from "../objects/ellipse";
import { ImageObject, ImageObjectType } from "../objects/image";
import { TileNavigatorContext } from "../../../components/tiles/hooks/use-tile-navigator-context";

// The drawing tile needs to be registered so the TileModel.create
// knows it is a supported tile type
import "../drawing-registration";

let content: DrawingContentModelType, drawingLayerProps, drawingLayer;

const kLocalImageUrl = "assets/logo_tw.png";

const getDrawingObject = (objectContent: DrawingContentModelType) => {
  drawingLayerProps = {
    model: TileModel.create({content: objectContent}),
    onSetCanAcceptDrop: (tileId?: string) => {
      throw new Error("Function not implemented.");
    }
  };
  render(
    <TileNavigatorContext.Provider value={{ reportVisibleBoundingBox: () => {}}}>
      <DrawingLayerView {...drawingLayerProps} />
    </TileNavigatorContext.Provider>
  );
  drawingLayer = screen.getByTestId("drawing-layer");
  return drawingLayer.firstChild;
};

describe("Drawing Layer Components", () => {
  describe("Freehand Line", () => {
    let line: LineObjectType;
    beforeEach(() => {
      line = LineObject.create({
        id: "123",
        x: 10, y: 10,
        deltaPoints: [{ dx: 1, dy: 1 }, { dx: 2, dy: 2 }],
        stroke: "#888888",
        fill: "none",
        strokeDashArray: "3,3",
        strokeWidth: 1
      });
      content = createDrawingContent({ objects: [line] });
    });

    it("adds a freehand line", () => {
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("moves a freehand line", () => {
      line.setDragPosition(5, 5);
      line.repositionObject();
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("deletes a freehand line", () => {
      content.deleteObjects([line.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("flips a freehand line horizontally", () => {
      content.flipHorizontal([line.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("flips a freehand line vertically", () => {
      content.flipVertical([line.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
  });

  describe("Vector line", () => {
    let vector: VectorObjectType;
    beforeEach(() => {
      vector = VectorObject.create({
        id: "234",
        x: 10, y: 10,
        dx: 10, dy: 10,
        stroke: "#888888",
        strokeDashArray: "3,3",
        strokeWidth: 1
      });
      content = createDrawingContent({ objects: [vector] });
    });
    it("adds a Vector line", () => {
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("moves a vector line", () => {
      vector.setDragPosition(5,5);
      vector.repositionObject();
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("deletes a vector line", () => {
      content.deleteObjects([vector.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("flips a Vector line horizontally", () => {
      content.flipHorizontal([vector.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("flips a Vector line vertically", () => {
      content.flipVertical([vector.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
  });

  describe("Vector arrow", () => {
    let vector: VectorObjectType;
    beforeEach(() => {
      vector = VectorObject.create({
        id: "235",
        x: 20, y:20,
        dx:20, dy:20,
        stroke: "#777777",
        strokeDashArray: "1,1",
        strokeWidth: 2,
        headShape: VectorEndShape.triangle,
        tailShape: VectorEndShape.triangle
      });
      content = createDrawingContent({ objects: [vector] });
    });
    it("adds a Vector arrow", () => {
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("moves a vector arrow", () => {
      vector.setDragPosition(5,5);
      vector.repositionObject();
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("changes vector to single arrow", () => {
      vector.setEndShapes(...endShapesForVectorType(VectorType.singleArrow));
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("changes vector to double arrow", () => {
      vector.setEndShapes(...endShapesForVectorType(VectorType.doubleArrow));
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("deletes a vector arrow", () => {
      content.deleteObjects([vector.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("flips a Vector arrow horizontally", () => {
      content.flipHorizontal([vector.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("flips a Vector arrow vertically", () => {
      content.flipVertical([vector.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
  });

  describe("Rectangle", () => {
    let rect: RectangleObjectType;
    beforeEach(() => {
      rect = RectangleObject.create({
        id: "345",
        x: 10, y: 10,
        width: 10, height: 10,
        fill: "#cccccc",
        stroke: "#888888",
        strokeDashArray: "3,3",
        strokeWidth: 1
      });
      content = createDrawingContent({ objects: [rect] });
    });
    it("adds a Rectangle", () => {
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("moves a rectangle", () => {
      rect.setDragPosition(5,5);
      rect.repositionObject();
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("deletes a rectangle", () => {
      content.deleteObjects([rect.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("flips a Rectangle horizontally", () => {
      content.flipHorizontal([rect.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("flips a Rectangle vertically", () => {
      content.flipVertical([rect.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
  });

  describe("Ellipse", () => {
    let ellipse: EllipseObjectType;
    beforeEach(() => {
      ellipse = EllipseObject.create({
        id: "456",
        x: 10, y: 10,
        rx: 10, ry: 10,
        fill: "#cccccc",
        stroke: "#888888",
        strokeDashArray: "3,3",
        strokeWidth: 1
      });
      content = createDrawingContent({ objects: [ellipse] });
    });
    it("adds a ellipse", () => {
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("moves a ellipse", () => {
      ellipse.setDragPosition(5,5);
      ellipse.repositionObject();
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("deletes a ellipse", () => {
      content.deleteObjects([ellipse.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("flips an ellipse horizontally", () => {
      content.flipHorizontal([ellipse.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("flips an ellipse vertically", () => {
      content.flipVertical([ellipse.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
  });

  // TODO: should test TextObject, but it fails
  // because the virual DOM doesn't implement getComputedTextLength

  describe("Group", () => {
    let rectangle: RectangleObjectType;
    let ellipse: EllipseObjectType;
    beforeEach(() => {
      rectangle = RectangleObject.create({
        id: "r",
        x: 10, y: 10,
        width: 10, height: 10,
        fill: "#cccccc",
        stroke: "#888888",
        strokeDashArray: "3,3",
        strokeWidth: 1
      });
      ellipse = EllipseObject.create({
        id: "e",
        x: 10, y: 10,
        rx: 10, ry: 10,
        fill: "#cccccc",
        stroke: "#888888",
        strokeDashArray: "3,3",
        strokeWidth: 1
      });
      content = createDrawingContent({ objects: [rectangle, ellipse] });
    });
    it("creates a group", () => {
      content.createGroup(["r", "e"]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("moves a group", () => {
      content.createGroup(["r", "e"]);
      expect(content.objects[0].type).toBe("group");
      content.objects[0].setDragPosition(5, 5);
      content.objects[0].repositionObject();
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("ungroups a group", () => {
      content.createGroup(["r", "e"]);
      const r2: RectangleObjectSnapshotForAdd = {
        type: "rectangle",
        id: "not-in-group",
        x: 10, y: 10,
        width: 10, height: 10,
        fill: "#cccccc",
        stroke: "#888888",
        strokeDashArray: "3,3",
        strokeWidth: 1
      };
      content.addObject(r2);
      content.ungroupGroups([content.objects[0].id, "not-in-group"]);
      expect(content.objects.length).toBe(3);
      expect(content.objects.map((obj) => obj.id)).toStrictEqual(["not-in-group", "r", "e"]);
    });
    it("deletes a group", () => {
      content.createGroup(["r", "e"]);
      content.deleteObjects([content.objects[0].id]);
      expect(content.objects.length).toBe(0);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("flips a group horizontally", () => {
      content.createGroup(["r", "e"]);
      content.flipHorizontal([content.objects[0].id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("flips a group vertically", () => {
      content.createGroup(["r", "e"]);
      content.flipVertical([content.objects[0].id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
  });

  describe("Image", () => {
    let image: ImageObjectType;
    beforeEach(() => {
      image = ImageObject.create({
        id: "567",
        url: kLocalImageUrl,
        x: 10, y: 10,
        width: 10, height: 10,
      });
      content = createDrawingContent({ objects: [image] });
    });
    it("adds an image", () => {
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("moves a image", () => {
      image.setDragPosition(5,5);
      image.repositionObject();
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("deletes a image", () => {
      content.deleteObjects([image.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("flips an image horizontally", () => {
      content.flipHorizontal([image.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("flips an image vertically", () => {
      content.flipVertical([image.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
  });
});

describe("Drawing Layer Zoom", () => {
  let rect: RectangleObjectType;
  beforeEach(() => {
    rect = RectangleObject.create({
      id: "345",
      x: 10, y: 10,
      width: 10, height: 10,
      fill: "#cccccc",
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1
    });
    content = createDrawingContent({ objects: [rect] });
  });

  it("zooms in", () => {
    content.setZoom(2);
    expect(getDrawingObject(content)).toMatchSnapshot();
  });
  it("zooms out", () => {
    content.setZoom(0.5);
    expect(getDrawingObject(content)).toMatchSnapshot();
  });
});
