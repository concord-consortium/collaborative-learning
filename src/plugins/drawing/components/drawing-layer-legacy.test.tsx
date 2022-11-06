import { render, screen } from "@testing-library/react";
import React from "react";
import { ToolTileModel } from "../../../models/tiles/tile-model";
import { DrawingContentModelType } from "../model/drawing-content";
import { DrawingLayerView } from "./drawing-layer";
import { DrawingToolDeletion, DrawingToolMove } from "../model/drawing-types";
import { LineObjectSnapshot } from "../objects/line";
import { VectorObjectSnapshot } from "../objects/vector";
import { RectangleObjectSnapshot } from "../objects/rectangle";
import { EllipseObjectSnapshot } from "../objects/ellipse";
import { ImageObjectSnapshot } from "../objects/image";
import { DrawingMigrator } from "../model/drawing-migrator";

// The drawing tile needs to be registered so the ToolTileModel.create
// knows it is a supported tile type
import "../drawing-registration";

let content, drawingLayerProps, drawingLayer;

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
    const lineData: LineObjectSnapshot = {
      type: "line",
      id: "123",
      x: 10, y: 10,
      deltaPoints: [{ dx: 1, dy: 1 }, { dx: 2, dy: 2 }],
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1
    };

    it("adds a freehand line", () => {
      content = DrawingMigrator.create({changes:[
        JSON.stringify({action: "create", data: lineData})
      ]});
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("moves a freehand line", () => {
      const moves: DrawingToolMove = [{ id: "123", destination: {x: 5, y: 5} }];
      content = DrawingMigrator.create({changes:[
        JSON.stringify({action: "create", data: lineData}),
        JSON.stringify({action: "move", data: moves})
      ]});
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("deletes a freehand line", () => {
      const deleteObject: DrawingToolDeletion = [ "123" ];
      content = DrawingMigrator.create({changes:[
        JSON.stringify({action: "create", data: lineData}),
        JSON.stringify({action: "delete", data: deleteObject})
      ]});
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
  });

  describe("Vector line", () => {
    const vectorData: VectorObjectSnapshot = {
      type: "vector",
      id: "234",
      x: 10, y: 10,
      dx: 10, dy: 10,
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1
    };
    it("adds a Vector line", () => {
      content = DrawingMigrator.create({changes:[
        JSON.stringify({action: "create", data: vectorData})
      ]});
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("moves a vector line", () => {
      const moves: DrawingToolMove = [{ id: "234", destination: {x: 5, y: 5} }];
      content = DrawingMigrator.create({changes:[
        JSON.stringify({action: "create", data: vectorData}),
        JSON.stringify({action: "move", data: moves})
      ]});
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("deletes a vector line", () => {
      const deleteObject: DrawingToolDeletion = [ "234" ];
      content = DrawingMigrator.create({changes:[
        JSON.stringify({action: "create", data: vectorData}),
        JSON.stringify({action: "delete", data: deleteObject})
      ]});
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
  });

  describe("Rectangle", () => {
    const rectData: RectangleObjectSnapshot = {
      type: "rectangle",
      id: "345",
      x: 10, y: 10,
      width: 10, height: 10,
      fill: "#cccccc",
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1
    };
    it("adds a Rectangle", () => {
      content = DrawingMigrator.create({changes:[
        JSON.stringify({action: "create", data: rectData})
      ]});
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("moves a rectangle", () => {
      const moves: DrawingToolMove = [{ id: "345", destination: {x: 5, y: 5} }];
      content = DrawingMigrator.create({changes:[
        JSON.stringify({action: "create", data: rectData}),
        JSON.stringify({action: "move", data: moves})
      ]});
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("deletes a rectangle", () => {
      const deleteObject: DrawingToolDeletion = [ "345" ];
      content = DrawingMigrator.create({changes:[
        JSON.stringify({action: "create", data: rectData}),
        JSON.stringify({action: "delete", data: deleteObject})
      ]});
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
  });

  describe("Ellipse", () => {
    const ellipseData: EllipseObjectSnapshot = {
      type: "ellipse",
      id: "456",
      x: 10, y: 10,
      rx: 10, ry: 10,
      fill: "#cccccc",
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1
    };
    it("adds a ellipse", () => {
      content = DrawingMigrator.create({changes:[
        JSON.stringify({action: "create", data: ellipseData})
      ]});
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("moves a ellipse", () => {
      const moves: DrawingToolMove = [{ id: "456", destination: {x: 5, y: 5} }];
      content = DrawingMigrator.create({changes:[
        JSON.stringify({action: "create", data: ellipseData}),
        JSON.stringify({action: "move", data: moves})
      ]});
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("deletes a ellipse", () => {
      const deleteObject: DrawingToolDeletion = [ "456" ];
      content = DrawingMigrator.create({changes:[
        JSON.stringify({action: "create", data: ellipseData}),
        JSON.stringify({action: "delete", data: deleteObject})
      ]});
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
  });

  describe("Image", () => {
    const imageData: ImageObjectSnapshot = {
      type: "image",
      id: "567",
      url: "my/image/url",
      x: 10, y: 10,
      width: 10, height: 10,
    };
    it("adds an image", () => {
      content = DrawingMigrator.create({changes:[
        JSON.stringify({action: "create", data: imageData})
      ]});
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("moves a image", () => {
      const moves: DrawingToolMove = [{ id: "567", destination: {x: 5, y: 5} }];
      content = DrawingMigrator.create({changes:[
        JSON.stringify({action: "create", data: imageData}),
        JSON.stringify({action: "move", data: moves})
      ]});
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
    it("deletes a image", () => {
      const deleteObject: DrawingToolDeletion = [ "567" ];
      content = DrawingMigrator.create({changes:[
        JSON.stringify({action: "create", data: imageData}),
        JSON.stringify({action: "delete", data: deleteObject})
      ]});
      expect(getDrawingObject(content)).toMatchSnapshot();
    });
  });
});
