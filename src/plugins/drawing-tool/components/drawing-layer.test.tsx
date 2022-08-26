import { render, screen } from "@testing-library/react";
import React from "react";
import { ToolTileModel } from "../../../models/tools/tool-tile";
import { createDrawingContent, DrawingContentModelType } from "../model/drawing-content";
import { DrawingLayerView } from "./drawing-layer";
import { LineObject, LineObjectType } from "../objects/line";
import { VectorObject, VectorObjectType } from "../objects/vector";
import { RectangleObject, RectangleObjectType } from "../objects/rectangle";
import { EllipseObject, EllipseObjectType } from "../objects/ellipse";
import { ImageObject, ImageObjectType } from "../objects/image";

// The drawing tile needs to be registered so the ToolTileModel.create
// knows it is a supported tile type
import "../drawing-registration";

let content: DrawingContentModelType, drawingLayerProps, drawingLayer;

const kLocalImageUrl = "assets/logo_tw.png";

const getDrawingObject = (objectContent: DrawingContentModelType) => {
  drawingLayerProps = {
    model: ToolTileModel.create({content: objectContent}),
    onSetCanAcceptDrop: (tileId?: string) => {
      throw new Error("Function not implemented.");
    }
  };
  render(<DrawingLayerView {...drawingLayerProps} />);
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
        strokeDashArray: "3,3",
        strokeWidth: 1
      });
      content = createDrawingContent({ objects: [line] });
    });

    it("adds a freehand line", () => {      
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("moves a freehand line", () => {
      line.setPosition(5, 5);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("deletes a freehand line", () => {
      content.deleteObjects([line.id]);
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
      vector.setPosition(5,5);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("deletes a vector line", () => {
      content.deleteObjects([vector.id]);
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
      rect.setPosition(5,5);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("deletes a rectangle", () => {
      content.deleteObjects([rect.id]);
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
      ellipse.setPosition(5,5);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("deletes a ellipse", () => {
      content.deleteObjects([ellipse.id]);
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
      image.setPosition(5,5);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("deletes a image", () => {
      content.deleteObjects([image.id]);
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
  });
});
