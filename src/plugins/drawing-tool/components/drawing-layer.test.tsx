import { render, screen } from "@testing-library/react";
import React from "react";
import { ToolTileModel } from "../../../models/tools/tool-tile";
import { DrawingContentModel } from "../model/drawing-content";
import { DrawingLayerView } from "./drawing-layer";
import { EllipseDrawingObjectData, ImageDrawingObjectData, LineDrawingObjectData,
  RectangleDrawingObjectData, VectorDrawingObjectData } from "../model/drawing-objects";

// The starter tile needs to be registered so the ToolTileModel.create
// knows it is a supported tile type
import "../drawing-registration";


describe("Drawing Layer Components", () => {
  describe("Freehand Line", () => {
    it("adds a freehand line", () => {
      const lineData: LineDrawingObjectData = {
        type: "line",
        id: "123",
        x: 10, y: 10,
        deltaPoints: [{ dx: 1, dy: 1 }, { dx: 2, dy: 2 }],
        stroke: "#888888",
        strokeDashArray: "3,3",
        strokeWidth: 1
      };

      const content = DrawingContentModel.create({changes:[
        JSON.stringify({action: "create", data: lineData})
      ]});

      const drawingLayerProps = {
        model: ToolTileModel.create({content}),
        onSetCanAcceptDrop: (tileId?: string) => {
          throw new Error("Function not implemented.");
        }
      };
      render(<DrawingLayerView {...drawingLayerProps} />);
      const drawingLayer = screen.getByTestId("drawing-layer");
      const drawingObject = drawingLayer.firstChild;
      expect(drawingObject).toMatchSnapshot();
    });
  });

  describe("Vector line", () => {
    it("adds a Vector line", () => {
      const vectorData: VectorDrawingObjectData = {
        type: "vector",
        x: 10, y: 10,
        dx: 10, dy: 10,
        stroke: "#888888",
        strokeDashArray: "3,3",
        strokeWidth: 1
      };

      const content = DrawingContentModel.create({changes:[
        JSON.stringify({action: "create", data: vectorData})
      ]});

      const drawingLayerProps = {
        model: ToolTileModel.create({content}),
        onSetCanAcceptDrop: (tileId?: string) => {
          throw new Error("Function not implemented.");
        }
      };
      render(<DrawingLayerView {...drawingLayerProps} />);
      const drawingLayer = screen.getByTestId("drawing-layer");
      const drawingObject = drawingLayer.firstChild;
      expect(drawingObject).toMatchSnapshot();
    });
  });

  describe("Rectangle", () => {
    it("adds a Rectangle", () => {
      const rectData: RectangleDrawingObjectData = {
        type: "rectangle",
        x: 10, y: 10,
        width: 10, height: 10,
        fill: "#cccccc",
        stroke: "#888888",
        strokeDashArray: "3,3",
        strokeWidth: 1
      };

      const content = DrawingContentModel.create({changes:[
        JSON.stringify({action: "create", data: rectData})
      ]});

      const drawingLayerProps = {
        model: ToolTileModel.create({content}),
        onSetCanAcceptDrop: (tileId?: string) => {
          throw new Error("Function not implemented.");
        }
      };
      render(<DrawingLayerView {...drawingLayerProps} />);
      const drawingLayer = screen.getByTestId("drawing-layer");
      const drawingObject = drawingLayer.firstChild;
      expect(drawingObject).toMatchSnapshot();
    });
  });

  describe("Ellipse", () => {
    it("adds a ellipse", () => {
      const ellipseData: EllipseDrawingObjectData = {
        type: "ellipse",
        x: 10, y: 10,
        rx: 10, ry: 10,
        fill: "#cccccc",
        stroke: "#888888",
        strokeDashArray: "3,3",
        strokeWidth: 1
      };

      const content = DrawingContentModel.create({changes:[
        JSON.stringify({action: "create", data: ellipseData})
      ]});

      const drawingLayerProps = {
        model: ToolTileModel.create({content}),
        onSetCanAcceptDrop: (tileId?: string) => {
          throw new Error("Function not implemented.");
        }
      };
      render(<DrawingLayerView {...drawingLayerProps} />);
      const drawingLayer = screen.getByTestId("drawing-layer");
      const drawingObject = drawingLayer.firstChild;
      expect(drawingObject).toMatchSnapshot();
    });
  });

  describe("Image", () => {
    it("adds an image", () => {
      const imageData: ImageDrawingObjectData = {
        type: "image",
        url: "my/image/url",
        originalUrl: "my/image/originalUrl",
        x: 10, y: 10,
        width: 10, height: 10,
      };

      const content = DrawingContentModel.create({changes:[
        JSON.stringify({action: "create", data: imageData})
      ]});

      const drawingLayerProps = {
        model: ToolTileModel.create({content}),
        onSetCanAcceptDrop: (tileId?: string) => {
          throw new Error("Function not implemented.");
        }
      };
      render(<DrawingLayerView {...drawingLayerProps} />);
      const drawingLayer = screen.getByTestId("drawing-layer");
      const drawingObject = drawingLayer.firstChild;
      expect(drawingObject).toMatchSnapshot();
    });
  });
});
